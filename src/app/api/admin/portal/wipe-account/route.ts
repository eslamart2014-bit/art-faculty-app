import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { student_code, reason } = await request.json();

    if (!student_code) {
      return NextResponse.json({ error: 'يرجى تحديد كود الطالب' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(student_code);

    // 1. جلب الطالب للتحقق من وجوده
    const { data: student, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, telegram_browser_id')
      .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
      .maybeSingle();

    if (stErr || !student) {
      return NextResponse.json({ error: 'الطالب غير موجود في المنظومة' }, { status: 404 });
    }

    // 2. فرمتة بيانات الحساب في جدول students
    await supabaseAdmin
      .from('students')
      .update({ telegram_browser_id: null })
      .eq('id', student.id);

    // 3. حذف الحساب من جدول student_accounts إن وجد
    try {
      await supabaseAdmin
        .from('student_accounts')
        .delete()
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
    } catch (e) {}

    // 4. حذف من المخزن المحلي
    try {
      localStore.deleteAccount(cleanCode);
      localStore.deleteAccount(student_code);
    } catch (e) {}

    // 5. تسجيل العملية في سجل الأمان (Audit Log)
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: student.student_code,
        action: 'account_wiped_by_admin',
        details: {
          student_name: student.full_name,
          reason: reason || 'فرمتة وإعادة تعيين الحساب بسبب شبهة احتيال أو انتحال صفة',
          wiped_at: new Date().toISOString(),
        }
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: `تمت فرمتة وإلغاء تفعيل حساب الطالب (${student.full_name}) بنجاح! يمكن للطالب الآن التسجيل بهاتفه وهويته من الصفر.`,
    });
  } catch (err: any) {
    console.error('Wipe account error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
