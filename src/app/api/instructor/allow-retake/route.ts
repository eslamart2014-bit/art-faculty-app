import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { instructor_id, student_code, course_id, project_name } = body;

    if (!instructor_id || !student_code || !course_id || !project_name) {
      return NextResponse.json(
        { error: 'بيانات غير مكتملة (يرجى تحديد المعيد، كود الطالب، المقرر، والمشروع)' },
        { status: 400 }
      );
    }

    // 1. التحقق من أمان وصلاحية المدرس على هذا المقرر حصراً (كل معيد ومقرراته فقط)
    const { data: course, error: cErr } = await supabaseAdmin
      .from('courses')
      .select('id, name, teacher_id, shared_with')
      .eq('id', course_id)
      .maybeSingle();

    if (cErr || !course) {
      return NextResponse.json({ error: 'المقرر غير موجود' }, { status: 404 });
    }

    const effectiveInstructorId = instructor_id || course.teacher_id;
    const isOwner = course.teacher_id === effectiveInstructorId;
    const isShared = Array.isArray(course.shared_with) && course.shared_with.includes(effectiveInstructorId);

    if (!isOwner && !isShared) {
      return NextResponse.json(
        { error: 'غير مصرح: هذا المقرر ليس مسنداً إليك، ولا يحق لك تعديل تسليماته.' },
        { status: 403 }
      );
    }

    // 2. فحص واستخراج أي صور مرتبطة بالتسليم لحذفها من سحابة التخزين artworks
    try {
      const filesToRemove: string[] = [];

      const { data: subToDelete } = await supabaseAdmin
        .from('student_submissions')
        .select('images')
        .eq('student_code', student_code)
        .eq('course_id', course_id)
        .eq('project_name', project_name)
        .maybeSingle();

      if (subToDelete?.images) {
        const imgs = Array.isArray(subToDelete.images) ? subToDelete.images : [];
        imgs.forEach((img: any) => {
          const url = typeof img === 'string' ? img : (img?.url || '');
          if (url && url.includes('/artworks/')) {
            const path = url.split('/artworks/')[1]?.split('?')[0];
            if (path) filesToRemove.push(decodeURIComponent(path));
          }
        });
      }

      const { data: stData } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('student_code', student_code)
        .maybeSingle();

      if (stData?.id) {
        const { data: evalToDelete } = await supabaseAdmin
          .from('evaluations')
          .select('photo_url')
          .eq('student_id', stData.id)
          .eq('course_id', course_id)
          .eq('project_name', project_name)
          .maybeSingle();

        if (evalToDelete?.photo_url && evalToDelete.photo_url.includes('/artworks/')) {
          const path = evalToDelete.photo_url.split('/artworks/')[1]?.split('?')[0];
          if (path) filesToRemove.push(decodeURIComponent(path));
        }

        // 3. تصفير أو حذف صورة العمل الفني والدرجة لـ null في جدول evaluations
        await supabaseAdmin
          .from('evaluations')
          .update({ photo_url: null, ai_status: null, score: null })
          .eq('student_id', stData.id)
          .eq('course_id', course_id)
          .eq('project_name', project_name);
      }

      if (filesToRemove.length > 0) {
        try {
          await supabaseAdmin.storage.from('artworks').remove(filesToRemove);
        } catch (storageErr) {
          console.warn('Storage remove error:', storageErr);
        }
      }
    } catch (cleanupErr) {
      console.warn('Media cleanup error:', cleanupErr);
    }

    // 4. حذف التسليم القديم نهائياً من جدول student_submissions
    try {
      await supabaseAdmin
        .from('student_submissions')
        .delete()
        .eq('student_code', student_code)
        .eq('course_id', course_id)
        .eq('project_name', project_name);
    } catch (e) {
      console.warn('Delete submission error:', e);
    }

    // حذف من المخزن المحلي كـ Fallback
    localStore.deleteSubmission(student_code, course_id, project_name);

    // 5. توثيق حركة السماح في سجل الأوديت (Audit Log)
    try {
      const { data: instProfile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', effectiveInstructorId)
        .maybeSingle();

      const instName = instProfile?.full_name || 'أستاذ المقرر';

      localStore.addAuditLog({
        action: 'ALLOW_RETAKE_ARTWORK',
        student_code,
        details: `المدرس (${instName}) سمح للطالب بإعادة تصوير ورفع مشروع (${project_name}) بمقرر (${course.name})`,
        ip_address: 'portal_instructor',
      });

      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code,
        action: 'ALLOW_RETAKE_ARTWORK',
        details: `المدرس (${instName}) سمح للطالب بإعادة تصوير ورفع مشروع (${project_name}) بمقرر (${course.name})`,
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: `تم فك القفل وحذف العمل القديم بنجاح! يمكن للطالب (${student_code}) الآن فتح الكاميرا في بوابته وإعادة تصوير مشروع (${project_name}).`,
    });
  } catch (err: any) {
    console.error('Allow retake error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
