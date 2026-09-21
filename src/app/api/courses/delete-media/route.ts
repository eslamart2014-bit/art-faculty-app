import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { course_id } = await request.json();

    if (!course_id) {
      return NextResponse.json({ error: 'يرجى تحديد كود المقرر' }, { status: 400 });
    }

    const filesToRemove: string[] = [];

    // 1. استخراج الصور من جدول student_submissions
    try {
      const { data: subs } = await supabaseAdmin
        .from('student_submissions')
        .select('images')
        .eq('course_id', course_id);

      (subs || []).forEach((s: any) => {
        const imgs = Array.isArray(s.images) ? s.images : [];
        imgs.forEach((img: any) => {
          const url = typeof img === 'string' ? img : (img?.url || '');
          if (url && url.includes('/artworks/')) {
            const path = url.split('/artworks/')[1]?.split('?')[0];
            if (path) filesToRemove.push(decodeURIComponent(path));
          }
        });
      });
    } catch (e) {}

    // 2. استخراج الصور من جدول evaluations
    try {
      const { data: evals } = await supabaseAdmin
        .from('evaluations')
        .select('photo_url')
        .eq('course_id', course_id);

      (evals || []).forEach((ev: any) => {
        if (ev.photo_url && ev.photo_url.includes('/artworks/')) {
          const path = ev.photo_url.split('/artworks/')[1]?.split('?')[0];
          if (path) filesToRemove.push(decodeURIComponent(path));
        }
      });
    } catch (e) {}

    // 3. مسح المجلدات المرتبطة بالمقرر في سحابة التخزين artworks
    try {
      const { data: rootItems } = await supabaseAdmin.storage.from('artworks').list('', { limit: 100 });
      for (const item of (rootItems || [])) {
        if (item.id === null || !item.metadata) {
          const studentFolder = item.name;
          const { data: subItems } = await supabaseAdmin.storage.from('artworks').list(`${studentFolder}/${course_id}`, { limit: 50 });
          if (subItems && subItems.length > 0) {
            subItems.forEach(f => {
              filesToRemove.push(`${studentFolder}/${course_id}/${f.name}`);
            });
          }
        }
      }
    } catch (e) {}

    // 4. تنفيذ الحذف الفعلي من Storage
    if (filesToRemove.length > 0) {
      const uniqueFiles = Array.from(new Set(filesToRemove));
      await supabaseAdmin.storage.from('artworks').remove(uniqueFiles);
    }

    // 5. حذف سجلات التسليمات من جدول student_submissions
    try {
      await supabaseAdmin
        .from('student_submissions')
        .delete()
        .eq('course_id', course_id);
    } catch (e) {}

    // 6. تصفير روابط الصور في جدول evaluations للمقرر
    try {
      await supabaseAdmin
        .from('evaluations')
        .update({ photo_url: null })
        .eq('course_id', course_id);
    } catch (e) {}

    return NextResponse.json({
      success: true,
      deletedFilesCount: filesToRemove.length,
      message: 'تم حذف وتفريغ كافة صور وسجلات المقرر من سحابة التخزين بنجاح.',
    });
  } catch (err: any) {
    console.error('Delete course media error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
