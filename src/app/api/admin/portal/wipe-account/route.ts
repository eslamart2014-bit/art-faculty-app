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

    const filesToRemove: string[] = [];

    // 2. استخراج وحذف صورة البطاقة الجامعية من student_accounts
    try {
      const { data: sa } = await supabaseAdmin
        .from('student_accounts')
        .select('id_card_url')
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
        .maybeSingle();

      if (sa?.id_card_url && sa.id_card_url.includes('/artworks/')) {
        const p = sa.id_card_url.split('/artworks/')[1]?.split('?')[0];
        if (p) filesToRemove.push(decodeURIComponent(p));
      }
    } catch (e) {}

    // 3. استخراج وحذف كافة صور الأعمال الفنية من student_submissions
    try {
      const { data: subs } = await supabaseAdmin
        .from('student_submissions')
        .select('images')
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);

      (subs || []).forEach((s: any) => {
        const imgs = Array.isArray(s.images) ? s.images : [];
        imgs.forEach((img: any) => {
          const url = typeof img === 'string' ? img : (img?.url || '');
          if (url && url.includes('/artworks/')) {
            const p = url.split('/artworks/')[1]?.split('?')[0];
            if (p) filesToRemove.push(decodeURIComponent(p));
          }
        });
      });
    } catch (e) {}

    // 4. فحص مجلد الطالب في سحابة التخزين artworks
    try {
      const { data: studentFiles } = await supabaseAdmin.storage.from('artworks').list(`${student.id}`, { limit: 100 });
      for (const item of (studentFiles || [])) {
        if (item.id === null || !item.metadata) {
          // مجلد مقرر فرعي
          const { data: subFiles } = await supabaseAdmin.storage.from('artworks').list(`${student.id}/${item.name}`, { limit: 50 });
          (subFiles || []).forEach(f => filesToRemove.push(`${student.id}/${item.name}/${f.name}`));
        } else {
          filesToRemove.push(`${student.id}/${item.name}`);
        }
      }
    } catch (e) {}

    // 5. حذف الملفات من Storage
    if (filesToRemove.length > 0) {
      try {
        const uniqueFiles = Array.from(new Set(filesToRemove));
        await supabaseAdmin.storage.from('artworks').remove(uniqueFiles);
      } catch (e) {}
    }

    // 6. حذف الأعمال من جدول student_submissions
    try {
      await supabaseAdmin
        .from('student_submissions')
        .delete()
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
    } catch (e) {}

    // 7. تصفير روابط الصور في جدول evaluations للطالب
    try {
      await supabaseAdmin
        .from('evaluations')
        .update({ photo_url: null })
        .eq('student_id', student.id);
    } catch (e) {}

    // 8. فرمتة بيانات الحساب في جدول students
    await supabaseAdmin
      .from('students')
      .update({ telegram_browser_id: null })
      .eq('id', student.id);

    // 9. حذف الحساب من جدول student_accounts إن وجد
    try {
      await supabaseAdmin
        .from('student_accounts')
        .delete()
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
    } catch (e) {}

    // 10. حذف من المخزن المحلي
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
