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
        .select('id, course_id, project_name, score, max_score, photo_url, created_at')
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
    const cleanCode = formatStudentCode(student_code);

    if (action === 'toggle_status') {
      // تعليق أو تفعيل الحساب
      const newStatus = extra?.status || 'active'; // 'active' or 'suspended'
      const { data, error } = await supabaseAdmin
        .from('student_accounts')
        .update({ status: newStatus })
        .eq('student_code', cleanCode)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: `تم تعديل حالة الحساب إلى ${newStatus === 'suspended' ? 'معلق' : 'نشط'}` });
    }

    if (action === 'reset_submissions') {
      // فورمات وحذف مشاريع الطالب المرفوعة لإتاحة إعادة الرفع
      const { error } = await supabaseAdmin
        .from('student_submissions')
        .delete()
        .eq('student_code', cleanCode);

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

    if (action === 'reset_pin') {
      // إعادة توليد رقم سري جديد
      const newPin = generatePinCode();
      const { data, error } = await supabaseAdmin
        .from('student_accounts')
        .update({
          pin_code: newPin,
          is_pin_used: false,
          pin_issued_by: 'إدارة النظام (إعادة تعيين)',
          pin_issued_at: new Date().toISOString(),
        })
        .eq('student_code', cleanCode)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: 'تم إعادة تعيين الرقم السري بنجاح', newPin });
    }

    return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
