import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode, generatePinCode } from '@/lib/codeHelper';
import { compareDHashes } from '@/lib/imageCompressor';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'inspect';
  const code = (searchParams.get('code') || '').trim();

  if (!code) {
    return NextResponse.json({ error: 'Missing student code' }, { status: 400 });
  }

  const cleanCode = formatStudentCode(code);

  try {
    // 1. جلب بيانات الطالب الأصلية
    const { data: student, error: stErr } = await supabaseAdmin
      .from('students')
      .select('*')
      .or(`student_code.eq.${code},student_code.eq.${cleanCode}`)
      .maybeSingle();

    if (stErr || !student) {
      return NextResponse.json({ error: 'طالب غير موجود بالمنظومة' }, { status: 404 });
    }

    // 2. جلب الحساب في بوابة فنية
    let account: any = null;
    try {
      const { data } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .eq('student_code', student.student_code)
        .maybeSingle();
      account = data;
    } catch (e) {}

    // التحقق من الحساب المخزن في جدول students (telegram_browser_id)
    if (!account && student.telegram_browser_id) {
      try {
        account = JSON.parse(student.telegram_browser_id);
      } catch (e) {}
    }

    if (!account) {
      account = localStore.getAccount(student.student_code);
    }

    // 3. جلب سجل النشاط والتدقيق الأمني
    let auditLogs: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('portal_audit_logs')
        .select('*')
        .eq('student_code', student.student_code)
        .order('created_at', { ascending: false })
        .limit(30);
      auditLogs = data || [];
    } catch (e) {}

    if (auditLogs.length === 0) {
      auditLogs = localStore.getAuditLogs(student.student_code);
    }

    // 4. التحقق الأمني من تعدد الأجهزة ومشاركة الهواتف
    let deviceSecurity: any = {
      totalDevices: 0,
      multipleDevicesDetected: false,
      devices: [],
      sharedPhonesWithStudents: [],
    };

    if (account && account.devices && Array.isArray(account.devices)) {
      deviceSecurity.devices = account.devices;
      deviceSecurity.totalDevices = account.devices.length;
      deviceSecurity.multipleDevicesDetected = account.devices.length > 1;

      // فحص مشاركة الهواتف: البحث عن أي طالب آخر سجل من نفس الـ deviceId
      const deviceIds = account.devices.map((d: any) => d.deviceId).filter(Boolean);
      if (deviceIds.length > 0) {
        let allAccounts: any[] = [];
        try {
          const res = await supabaseAdmin
            .from('student_accounts')
            .select('student_code, full_name, devices')
            .neq('student_code', student.student_code);
          allAccounts = res.data || [];
        } catch (e) {}

        // جلب الحسابات أيضاً من جدول students لمن سجلوا عبر telegram_browser_id
        try {
          const { data: stAll } = await supabaseAdmin
            .from('students')
            .select('student_code, full_name, telegram_browser_id')
            .neq('student_code', student.student_code)
            .not('telegram_browser_id', 'is', null);

          (stAll || []).forEach((stItem: any) => {
            if (!allAccounts.some(a => a.student_code === stItem.student_code)) {
              try {
                const parsed = JSON.parse(stItem.telegram_browser_id);
                if (parsed && parsed.devices) {
                  allAccounts.push({
                    student_code: stItem.student_code,
                    full_name: stItem.full_name,
                    devices: parsed.devices,
                  });
                }
              } catch (e) {}
            }
          });
        } catch (e) {}

        if (allAccounts.length === 0) {
          allAccounts = localStore.getAllAccounts().filter(a => a.student_code !== student.student_code);
        }

        const sharedList: any[] = [];
        allAccounts.forEach((other: any) => {
          if (Array.isArray(other.devices)) {
            const hasSharedDevice = other.devices.some((od: any) =>
              deviceIds.includes(od.deviceId)
            );
            if (hasSharedDevice) {
              sharedList.push({
                student_code: other.student_code,
                full_name: other.full_name,
              });
            }
          }
        });
        deviceSecurity.sharedPhonesWithStudents = sharedList;
      }
    }

    // 5. جلب أعمال ومشاريع الطالب من student_submissions ومن evaluations
    let studentSubmissions: any[] = [];
    try {
      const res = await supabaseAdmin
        .from('student_submissions')
        .select('*')
        .eq('student_code', student.student_code);
      studentSubmissions = res.data || [];
    } catch (e) {}

    if (studentSubmissions.length === 0) {
      studentSubmissions = localStore.getSubmissions(student.student_code);
    }

    // دمج أعمال الطالب المسجلة في evaluations بصور أو تقييمات
    try {
      const { data: evals } = await supabaseAdmin
        .from('evaluations')
        .select('id, course_id, project_name, score, photo_url, created_at')
        .eq('student_id', student.id);

      if (evals && evals.length > 0) {
        evals.forEach((ev: any) => {
          if (ev.photo_url) {
            const alreadyInSubs = studentSubmissions.some((s: any) =>
              s.project_name === ev.project_name && s.course_id === ev.course_id
            );
            if (!alreadyInSubs) {
              studentSubmissions.push({
                id: ev.id,
                student_code: student.student_code,
                student_name: student.full_name,
                course_id: ev.course_id,
                project_name: ev.project_name,
                images: [{ url: ev.photo_url }],
                status: 'evaluated',
                score: ev.score,
                max_score: ev.max_score,
                created_at: ev.created_at || new Date().toISOString(),
              });
            }
          }
        });
      }
    } catch (e) {}

    // 6. محرك الذكاء الاصطناعي لفحص تشابه اللوحات الفنية (AI Art Plagiarism Engine)
    const plagiarismMatches: any[] = [];
    if (studentSubmissions && studentSubmissions.length > 0) {
      // جلب جميع تسليمات الطلاب الآخرين للمقارنة
      let otherSubmissions: any[] = [];
      try {
        const res = await supabaseAdmin
          .from('student_submissions')
          .select('*')
          .neq('student_code', student.student_code);
        otherSubmissions = res.data || [];
      } catch (e) {}

      if (otherSubmissions.length === 0) {
        otherSubmissions = localStore.getAllSubmissions().filter(
          (s: any) => s.student_code !== student.student_code
        );
      }

      if (otherSubmissions && otherSubmissions.length > 0) {
        studentSubmissions.forEach((mySub: any) => {
          const myImages = Array.isArray(mySub.images) ? mySub.images : [];

          myImages.forEach((myImg: any, myIdx: number) => {
            if (!myImg.dhash) return;

            otherSubmissions.forEach((otherSub: any) => {
              const otherImages = Array.isArray(otherSub.images) ? otherSub.images : [];

              otherImages.forEach((otherImg: any, otherIdx: number) => {
                if (!otherImg.dhash) return;

                const comparison = compareDHashes(myImg.dhash, otherImg.dhash);
                // إذا كانت نسبة التشابه 80% فأكثر، نعتبرها شبهة تطابق أو سرقة عمل
                if (comparison.similarityPercent >= 80) {
                  plagiarismMatches.push({
                    myProject: mySub.project_name,
                    myCourse: mySub.course_name,
                    myImageUrl: myImg.url,
                    myImageIndex: myIdx + 1,
                    matchedStudentName: otherSub.student_name,
                    matchedStudentCode: otherSub.student_code,
                    matchedProject: otherSub.project_name,
                    matchedImageUrl: otherImg.url,
                    matchedImageIndex: otherIdx + 1,
                    similarityPercent: comparison.similarityPercent,
                    hammingDistance: comparison.distance,
                  });
                }
              });
            });
          });
        });
      }
    }

    return NextResponse.json({
      student,
      isRegistered: !!account,
      account: account || null,
      auditLogs: auditLogs || [],
      deviceSecurity,
      submissions: studentSubmissions || [],
      plagiarismMatches,
    });
  } catch (err: any) {
    console.error('Admin portal inspection error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, student_code, extra } = await request.json();
    if (!student_code) {
      return NextResponse.json({ error: 'يرجى تحديد كود الطالب' }, { status: 400 });
    }
    const cleanCode = formatStudentCode(student_code);

    // 1. تعليق أو تفعيل الحساب
    if (action === 'toggle_status') {
      const newStatus = extra?.status || 'active'; // 'active' or 'suspended'

      // تحديث في student_accounts
      try {
        await supabaseAdmin
          .from('student_accounts')
          .update({ status: newStatus })
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
      } catch (e) {}

      // تحديث في students.telegram_browser_id
      try {
        const { data: st } = await supabaseAdmin
          .from('students')
          .select('id, telegram_browser_id')
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
          .maybeSingle();

        if (st && st.telegram_browser_id) {
          try {
            const parsed = JSON.parse(st.telegram_browser_id);
            parsed.status = newStatus;
            await supabaseAdmin
              .from('students')
              .update({ telegram_browser_id: JSON.stringify(parsed) })
              .eq('id', st.id);
          } catch (e) {}
        }
      } catch (e) {}

      // تحديث في المخزن المحلي
      try {
        const localAcc = localStore.getAccount(cleanCode) || localStore.getAccount(student_code);
        if (localAcc) {
          localAcc.status = newStatus;
          localStore.upsertAccount(localAcc);
        }
      } catch (e) {}

      // تسجيل العملية في سجل الأمان
      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: cleanCode,
          action: newStatus === 'suspended' ? 'account_suspended' : 'account_unsuspended',
          details: { status: newStatus, timestamp: new Date().toISOString() },
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        status: newStatus,
        message: newStatus === 'suspended' 
          ? 'تم تعليق وقفل حساب الطالب بنجاح 🔒 (لا يمكن للطالب الدخول حتى يتم إلغاء التعليق)' 
          : 'تم تفعيل الحساب وإلغاء التعليق بنجاح ✅'
      });
    }

    // 2. تصفير وحذف أعمال ومشاريع الطالب لإتاحة إعادة الرفع
    if (action === 'reset_submissions') {
      const { error } = await supabaseAdmin
        .from('student_submissions')
        .delete()
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: cleanCode,
          action: 'admin_reset_submissions',
          details: { resetAt: new Date().toISOString() },
        });
      } catch (e) {}

      return NextResponse.json({ success: true, message: 'تم تصفير أعمال ومشاريع الطالب بنجاح، ويمكنه الآن تصويرها ورفعها من جديد.' });
    }

    // 3. إعادة توليد رقم سري جديد
    if (action === 'reset_pin') {
      const newPin = generatePinCode();

      try {
        await supabaseAdmin
          .from('student_accounts')
          .update({
            pin_code: newPin,
            is_pin_used: false,
            pin_issued_by: 'إدارة النظام (إعادة تعيين)',
            pin_issued_at: new Date().toISOString(),
          })
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
      } catch (e) {}

      try {
        const { data: st } = await supabaseAdmin
          .from('students')
          .select('id, telegram_browser_id')
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
          .maybeSingle();

        if (st && st.telegram_browser_id) {
          try {
            const parsed = JSON.parse(st.telegram_browser_id);
            parsed.pin_code = newPin;
            parsed.is_pin_used = false;
            parsed.pin_issued_by = 'إدارة النظام (إعادة تعيين)';
            parsed.pin_issued_at = new Date().toISOString();
            await supabaseAdmin
              .from('students')
              .update({ telegram_browser_id: JSON.stringify(parsed) })
              .eq('id', st.id);
          } catch (e) {}
        }
      } catch (e) {}

      try {
        const localAcc = localStore.getAccount(cleanCode) || localStore.getAccount(student_code);
        if (localAcc) {
          localAcc.pin_code = newPin;
          localAcc.is_pin_used = false;
          localStore.upsertAccount(localAcc);
        }
      } catch (e) {}

      return NextResponse.json({ success: true, message: `تم إعادة تعيين الرقم السري بنجاح: ${newPin}`, newPin });
    }

    // 4. حذف وتصفير حساب الطالب من البوابة بالكامل
    if (action === 'delete_account' || action === 'wipe_account') {
      // جلب بيانات الطالب
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, full_name, student_code')
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
        .maybeSingle();

      if (!student) {
        return NextResponse.json({ error: 'الطالب غير موجود في المنظومة' }, { status: 404 });
      }

      // حذف الأعمال المرفوعة
      try {
        await supabaseAdmin
          .from('student_submissions')
          .delete()
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
      } catch (e) {}

      // تصفير روابط الصور في جدول evaluations
      try {
        await supabaseAdmin
          .from('evaluations')
          .update({ photo_url: null })
          .eq('student_id', student.id);
      } catch (e) {}

      // تصفير بيانات الحساب في جدول students
      try {
        await supabaseAdmin
          .from('students')
          .update({ telegram_browser_id: null })
          .eq('id', student.id);
      } catch (e) {}

      // حذف الحساب من جدول student_accounts
      try {
        await supabaseAdmin
          .from('student_accounts')
          .delete()
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
      } catch (e) {}

      // حذف من المخزن المحلي
      try {
        localStore.deleteAccount(cleanCode);
        localStore.deleteAccount(student_code);
      } catch (e) {}

      // تسجيل العملية في سجل الأمان
      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: student.student_code,
          action: 'account_deleted_by_admin',
          details: {
            student_name: student.full_name,
            deleted_at: new Date().toISOString(),
          }
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: `تم حذف حساب الطالب (${student.full_name}) من البوابة بنجاح! أصبح الحساب غير مسجل ويمكن للطالب التسجيل من جديد.`
      });
    }

    return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
