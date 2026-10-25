import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';
import { noStoreJson, setStudentSession } from '@/lib/serverAuth';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(`student-verify-pin:${ip}`, 20, 60_000)) {
      return noStoreJson({ error: 'عدد المحاولات كبير، يرجى المحاولة بعد قليل' }, { status: 429 });
    }

    const { student_code, pin_code, device_info } = await request.json();

    if (typeof student_code !== 'string' || !/^[A-Za-z0-9\-_]{1,20}$/.test(student_code.trim()) || !pin_code) {
      return noStoreJson({ error: 'يرجى إدخال الكود والرقم السري' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(String(student_code).trim());
    const cleanPin = String(pin_code)
      .replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .trim()
      .toLowerCase();
    const codeCandidates = Array.from(new Set([String(student_code).trim(), cleanCode].filter(Boolean)));

    // جلب الحساب
    let account: any = null;
    let studentRecord: any = null;
    try {
      const { data } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .in('student_code', codeCandidates)
        .maybeSingle();
      account = data;
    } catch (e) {}

    try {
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('id, full_name, student_code, academic_year, section, telegram_browser_id')
        .in('student_code', codeCandidates)
        .maybeSingle();
      if (st) {
        studentRecord = st;
        if (!account && st.telegram_browser_id) {
          try {
            account = JSON.parse(st.telegram_browser_id);
          } catch (e) {}
        }
      }
    } catch (e) {}

    if (!account) {
      account = localStore.getAccount(cleanCode);
    }

    if (!account) {
      return NextResponse.json(
        { error: 'لم يتم العثور على حساب مسجل بهذا الكود' },
        { status: 404 }
      );
    }

    // فحص القفل المؤقت ضد هجمات التخمين (Brute-force protection)
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(account.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `تم قفل محاولات التحقق لهذا الحساب مؤقتاً! يرجى الانتظار (${remainingMinutes}) دقيقة ثم المحاولة مجدداً.` },
        { status: 429 }
      );
    }

    // استخراج الأرقام السرية المعتمدة من جدول الحسابات فقط
    const expectedPins = [
      (account.pin_code || '').replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().toLowerCase(),
    ].filter(Boolean);

    const isPinCorrect = expectedPins.length > 0 && cleanPin.length > 0 && expectedPins.includes(cleanPin);

    if (expectedPins.length === 0) {
      return noStoreJson(
        { error: 'لا يوجد رقم سري معتمد لهذا الحساب. يرجى مراجعة منسق المنظومة لإعادة تعيينه.' },
        { status: 409 }
      );
    }

    // التحقق من الرقم السري
    if (!isPinCorrect) {
      const failed = (account.failed_attempts || 0) + 1;
      let lockUpdate: any = { failed_attempts: failed };
      let warnMessage = `الرقم السري غير صحيح! (المحاولة ${failed} من 5)`;

      if (failed >= 5) {
        lockUpdate.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        warnMessage = 'تم قفل محاولات التحقق مؤقتاً لمدة 15 دقيقة لتكرار المحاولات الخاطئة!';
      }

      await supabaseAdmin
        .from('student_accounts')
        .update(lockUpdate)
        .eq('id', account.id);

      localStore.saveAccount({ ...account, ...lockUpdate });

      return NextResponse.json(
        { error: warnMessage },
        { status: 401 }
      );
    }

    // تحديث الحساب ليصبح مفعلاً بالكامل
    let updatedAccount: any = null;
    try {
      const res = await supabaseAdmin
        .from('student_accounts')
        .update({
          is_pin_used: true,
          status: 'active',
          last_login_at: new Date().toISOString(),
          failed_attempts: 0,
          locked_until: null,
        })
        .eq('id', account.id)
        .select('*')
        .single();
      updatedAccount = res.data;
    } catch (e) {}

    if (!updatedAccount) {
      account.is_pin_used = true;
      account.status = 'active';
      account.last_login_at = new Date().toISOString();
      localStore.upsertAccount(account);
      updatedAccount = account;
    }

    // NOTE: لم نعد نكرّر بيانات الحساب داخل students.telegram_browser_id.

    // تسجيل في الأوديت لوج
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: account.student_code,
        action: 'pin_verified_and_activated',
        device_id: device_info?.deviceId,
        user_agent: device_info?.userAgent,
        details: { activatedAt: new Date().toISOString() },
      });
    } catch (e) {}

    const safeStudent = {
      id: account.student_id || studentRecord?.id || null,
      full_name: account.full_name || studentRecord?.full_name || '',
      student_code: account.student_code || studentRecord?.student_code || cleanCode,
      academic_year: account.academic_year || studentRecord?.academic_year || '',
      section: account.section || studentRecord?.section || '',
      mobile: account.mobile || null,
      status: 'active',
    };

    const response = noStoreJson({
      success: true,
      message: 'تم تفعيل حسابك بنجاح ومرحباً بك في منظومة فنية!',
      student: safeStudent,
    });
    setStudentSession(response, safeStudent.student_code);
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
