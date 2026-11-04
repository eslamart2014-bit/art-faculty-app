import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';
import { formatStudentCode, generatePinCode, getStudentCodeVariants, buildStudentCodeFilter } from '@/lib/students/codeHelper';
import { compareDHashes } from '@/lib/students/imageCompressor';
import { localStore } from '@/lib/students/localFallbackStore';
import { requireCoordinator, noStoreJson } from '@/lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const guard = await requireCoordinator(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim();

  if (!code || !/^[A-Za-z0-9\-_]{1,20}$/.test(code)) {
    return noStoreJson({ error: 'كود الطالب غير صالح' }, { status: 400 });
  }

  const cleanCode = formatStudentCode(code);
  const variants = getStudentCodeVariants(cleanCode || code);
  const filter = buildStudentCodeFilter(variants);

  try {
    // 1. جلب بيانات الطالب الأصلية
    const { data: student, error: stErr } = await supabaseAdmin
      .from('students')
      .select('*')
      .or(filter)
      .limit(1)
      .maybeSingle();

    if (stErr || !student) {
      return NextResponse.json({ error: 'طالب غير موجود بالمنظومة' }, { status: 404 });
    }

    // 2. جلب الحساب في بوابة فنية / بوت تليجرام
    const accVariants = getStudentCodeVariants(student.student_code || cleanCode);
    const accFilter = buildStudentCodeFilter(accVariants);
    let account: any = null;
    try {
      const { data } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .or(accFilter)
        .limit(1)
        .maybeSingle();
      account = data;
    } catch (e) {}

    let telegramAccount: any = null;
    if (student.telegram_browser_id) {
      try {
        telegramAccount = JSON.parse(student.telegram_browser_id);
      } catch (e) {}
    }

    const isSuspended =
      student.is_active === false ||
      account?.status === 'suspended' ||
      telegramAccount?.status === 'suspended';

    const tgId = student.telegram_id
      ? String(student.telegram_id)
      : (telegramAccount?.telegram_id ? String(telegramAccount.telegram_id) : null);

    if (!account) {
      account = telegramAccount;
      if (!account) {
        for (const v of accVariants) {
          const f = localStore.getAccount(v);
          if (f) { account = f; break; }
        }
      }
      if (!account && (tgId || isSuspended)) {
        account = {
          student_code: student.student_code,
          full_name: student.full_name,
          telegram_id: tgId,
          status: isSuspended ? 'suspended' : 'active',
          created_at: student.created_at || new Date().toISOString()
        };
      }
    }

    if (account) {
      account = {
        ...(telegramAccount || {}),
        ...account,
        telegram_id: tgId,
        telegram_username: telegramAccount?.telegram_username || null,
        telegram_first_name: telegramAccount?.telegram_first_name || null,
        linked_at: telegramAccount?.linked_at || account.created_at || student.created_at || null,
        last_login_at: telegramAccount?.last_login_at || account.last_login_at || null,
        status: isSuspended ? 'suspended' : 'active'
      };
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

    // 4. جلب أعمال ومشاريع الطالب من student_submissions ومن evaluations
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

    try {
      const { data: evals } = await supabaseAdmin
        .from('evaluations')
        .select('id, course_id, project_name, score, photo_url, ai_status, created_at')
        .eq('student_id', student.id);

      if (evals && evals.length > 0) {
        evals.forEach((ev: any) => {
          if (ev.photo_url) {
            const alreadyInSubs = studentSubmissions.some((s: any) =>
              s.project_name === ev.project_name && s.course_id === ev.course_id
            );
            if (!alreadyInSubs) {
              const dhashClean = (ev.ai_status || '').replace(/^hash:/i, '').trim();
              const photoClean = ev.photo_url.startsWith('AgAC') ? `/api/media/${ev.photo_url}` : ev.photo_url;
              studentSubmissions.push({
                id: ev.id,
                student_code: student.student_code,
                student_name: student.full_name,
                course_id: ev.course_id,
                project_name: ev.project_name,
                images: [{ url: photoClean, dhash: dhashClean }],
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

    // 5. محرك الذكاء الاصطناعي لفحص تشابه اللوحات الفنية (AI Art Plagiarism Engine)
    const plagiarismMatches: any[] = [];
    if (studentSubmissions && studentSubmissions.length > 0) {
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

      try {
        const { data: otherEvals } = await supabaseAdmin
          .from('evaluations')
          .select('id, course_id, project_name, photo_url, ai_status, created_at, students(full_name, student_code)')
          .not('photo_url', 'is', null)
          .neq('student_id', student.id);

        if (otherEvals && otherEvals.length > 0) {
          otherEvals.forEach((oEv: any) => {
            const oCode = (oEv.students as any)?.student_code;
            if (oCode && !otherSubmissions.some((os: any) => os.student_code === oCode && os.project_name === oEv.project_name)) {
              const oPhotoClean = oEv.photo_url.startsWith('AgAC') ? `/api/media/${oEv.photo_url}` : oEv.photo_url;
              const oDhashClean = (oEv.ai_status || '').replace(/^hash:/i, '').trim();
              otherSubmissions.push({
                id: oEv.id,
                student_code: oCode,
                student_name: (oEv.students as any)?.full_name || 'طالب',
                course_id: oEv.course_id,
                course_name: 'مقرر دراسي',
                project_name: oEv.project_name,
                images: [{ url: oPhotoClean, dhash: oDhashClean }],
                created_at: oEv.created_at || new Date().toISOString(),
              });
            }
          });
        }
      } catch (e) {}

      if (otherSubmissions && otherSubmissions.length > 0) {
        studentSubmissions.forEach((mySub: any) => {
          const myImages = Array.isArray(mySub.images) ? mySub.images : [];
          myImages.forEach((myImg: any, myIdx: number) => {
            const myDhash = (myImg.dhash || '').replace(/^hash:/i, '').trim();
            if (!myDhash) return;
            otherSubmissions.forEach((otherSub: any) => {
              const otherImages = Array.isArray(otherSub.images) ? otherSub.images : [];
              otherImages.forEach((otherImg: any, otherIdx: number) => {
                const otherDhash = (otherImg.dhash || '').replace(/^hash:/i, '').trim();
                if (!otherDhash) return;
                const comparison = compareDHashes(myDhash, otherDhash);
                if (comparison.similarityPercent >= 80) {
                  const myCleanUrl = myImg.url && myImg.url.startsWith('AgAC') ? `/api/media/${myImg.url}` : myImg.url;
                  const otherCleanUrl = otherImg.url && otherImg.url.startsWith('AgAC') ? `/api/media/${otherImg.url}` : otherImg.url;
                  plagiarismMatches.push({
                    myProject: mySub.project_name,
                    myCourse: mySub.course_name,
                    myImageUrl: myCleanUrl,
                    myImageIndex: myIdx + 1,
                    matchedStudentName: otherSub.student_name,
                    matchedStudentCode: otherSub.student_code,
                    matchedProject: otherSub.project_name,
                    matchedImageUrl: otherCleanUrl,
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
      isRegistered: Boolean(tgId || account),
      account: account || null,
      auditLogs: auditLogs || [],
      submissions: studentSubmissions || [],
      plagiarismMatches,
    });
  } catch (err: any) {
    console.error('Admin portal inspection error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireCoordinator(request);
  if (!guard.ok) return guard.response;

  try {
    const { action, student_code, extra } = await request.json();
    if (typeof student_code !== 'string' || !/^[A-Za-z0-9\-_]{1,20}$/.test(student_code.trim())) {
      return noStoreJson({ error: 'يرجى تحديد كود طالب صالح' }, { status: 400 });
    }
    const cleanCode = formatStudentCode(student_code);
    const variants = getStudentCodeVariants(cleanCode || student_code);
    const filter = buildStudentCodeFilter(variants);

    if ((action === 'delete_account' || action === 'wipe_account') && !guard.ctx.isAdmin) {
      return noStoreJson({ error: 'صلاحية حذف الحساب مقصورة على الإدارة' }, { status: 403 });
    }

    // 1. تعليق أو تفعيل الحساب
    if (action === 'toggle_status' || action === 'activate_account') {
      const newStatus = action === 'activate_account' ? 'active' : (extra?.status || 'active');

      try {
        await supabaseAdmin
          .from('student_accounts')
          .update({ status: newStatus })
          .or(filter);
      } catch (e) {}

      try {
        const { data: st } = await supabaseAdmin
          .from('students')
          .select('id, student_code, telegram_browser_id')
          .or(filter)
          .limit(1)
          .maybeSingle();

        if (st) {
          let parsed: any = {};
          if (st.telegram_browser_id) {
            try { parsed = JSON.parse(st.telegram_browser_id); } catch (e) {}
          }
          parsed.student_code = st.student_code;
          parsed.status = newStatus;
          await supabaseAdmin
            .from('students')
            .update({
              is_active: newStatus !== 'suspended',
              telegram_browser_id: JSON.stringify(parsed)
            })
            .eq('id', st.id);
        }
      } catch (e) {}

      try {
        const localAcc = localStore.getAccount(cleanCode) || localStore.getAccount(student_code);
        if (localAcc) {
          localAcc.status = newStatus;
          localStore.upsertAccount(localAcc);
        }
      } catch (e) {}

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
          ? 'تم تعليق وقفل حساب الطالب بنجاح ⛔ (لا يمكن للطالب الدخول عبر البوت حتى يتم إلغاء التعليق)'
          : 'تم تفعيل الحساب وإلغاء التعليق بنجاح ✅'
      });
    }

    // 2. تصفير وحذف أعمال ومشاريع الطالب لإتاحة إعادة الرفع
    if (action === 'reset_submissions') {
      const { error } = await supabaseAdmin
        .from('student_submissions')
        .delete()
        .or(filter);

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

    // 3. حذف وتصفير حساب الطالب من البوت بالكامل وفك ربط تليجرام
    if (action === 'delete_account' || action === 'wipe_account') {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, full_name, student_code')
        .or(filter)
        .limit(1)
        .maybeSingle();

      if (!student) {
        return NextResponse.json({ error: 'الطالب غير موجود في المنظومة' }, { status: 404 });
      }

      try {
        await supabaseAdmin
          .from('students')
          .update({
            telegram_id: null,
            is_active: true,
            telegram_browser_id: null
          })
          .eq('id', student.id);
      } catch (e) {}

      try {
        await supabaseAdmin
          .from('student_accounts')
          .delete()
          .or(filter);
      } catch (e) {}

      try {
        localStore.deleteAccount(cleanCode);
        localStore.deleteAccount(student_code);
      } catch (e) {}

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
        message: `تم حذف حساب الطالب (${student.full_name}) وفك ربط تليجرام بنجاح 🗑️ يمكن للطالب التسجيل من جديد عبر البوت.`
      });
    }

    return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
