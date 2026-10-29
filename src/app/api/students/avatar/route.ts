import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode, getStudentCodeVariants } from '@/lib/codeHelper';
import { uploadImageToStorage } from '@/lib/telegramStorage';
import { noStoreJson } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const student_code = typeof body.code === 'string' ? body.code.trim() : (typeof body.student_code === 'string' ? body.student_code.trim() : '');
    const image = typeof body.image === 'string' ? body.image : '';

    if (!student_code) {
      return noStoreJson({ error: 'كود الطالب غير محدد' }, { status: 400 });
    }

    if (!image || !image.startsWith('data:image')) {
      return noStoreJson({ error: 'صورة غير صالحة' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(student_code);
    const codeVariants = getStudentCodeVariants(cleanCode);

    // 1. العثور على سجل الطالب في قاعدة البيانات
    const { data: student, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, telegram_browser_id')
      .in('student_code', codeVariants)
      .maybeSingle();

    if (stErr || !student) {
      return noStoreJson({ error: 'لم يتم العثور على سجل الطالب' }, { status: 404 });
    }

    // 2. الرفع إلى سيرفر التليجرام (وسحابة التخزين الاحتياطية)
    const caption = `📸 صورة شخصية للطالب: ${student.full_name} (${student.student_code})`;
    const storagePath = `avatars/${student.student_code}_${Date.now()}.webp`;

    const uploadRes = await uploadImageToStorage(
      image,
      caption,
      undefined,
      undefined,
      storagePath
    );

    if (!uploadRes.success || !uploadRes.url) {
      return noStoreJson({ error: uploadRes.error || 'تعذر حفظ الصورة على سيرفر التليجرام' }, { status: 502 });
    }

    const avatarUrl = uploadRes.url;

    // 3. تحديث حقل telegram_browser_id بحفظ رابط الصورة الشخصية
    let browserData: any = {};
    if (student.telegram_browser_id) {
      try {
        browserData = JSON.parse(student.telegram_browser_id);
      } catch (e) {}
    }
    browserData.avatar_url = avatarUrl;
    browserData.avatar_updated_at = new Date().toISOString();

    await supabaseAdmin
      .from('students')
      .update({ telegram_browser_id: JSON.stringify(browserData) })
      .eq('id', student.id);

    return noStoreJson({
      success: true,
      avatar_url: avatarUrl,
      source: uploadRes.source,
      message: 'تم حفظ وتعيين صورتك الشخصية بنجاح على سيرفر المنظومة! ✅'
    });
  } catch (err: any) {
    console.error('[avatar POST] Error:', err);
    return noStoreJson({ error: err.message || 'حدث خطأ أثناء معالجة الصورة' }, { status: 500 });
  }
}
