import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { student_code, pin_code, device_info } = await request.json();

    if (!student_code || !pin_code) {
      return NextResponse.json(
        { error: 'يرجى إدخال الكود والرقم السري' },
        { status: 400 }
      );
    }

    const cleanCode = formatStudentCode(student_code);
    const cleanPin = pin_code.trim();

    // جلب الحساب
    let account: any = null;
    try {
      const { data } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
        .maybeSingle();
      account = data;
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

    // التحقق من الرقم السري
    if (account.pin_code !== cleanPin) {
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

    return NextResponse.json({
      success: true,
      message: 'تم تفعيل حسابك بنجاح ومرحباً بك في منظومة فنية!',
      student: updatedAccount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
