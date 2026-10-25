import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { action, course_id, name, custom_week_names, shared_with } = body;

    if (typeof course_id !== 'string' || !course_id || course_id.length > 64) {
      return NextResponse.json({ success: false, message: 'معرف المقرر مطلوب' }, { status: 400 });
    }

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('teacher_id, shared_with')
      .eq('id', course_id)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ success: false, message: 'المقرر غير موجود' }, { status: 404 });
    }

    const isOwner = course.teacher_id === guard.ctx.user.id;
    const isShared = Array.isArray(course.shared_with) && course.shared_with.includes(guard.ctx.user.id);
    const canManage = guard.ctx.isAdmin || isOwner || isShared;

    if (!canManage) {
      return NextResponse.json({ success: false, message: 'غير مصرح بإدارة هذا المقرر' }, { status: 403 });
    }
    if ((action === 'update_shared' || action === 'delete') && !guard.ctx.isAdmin && !isOwner) {
      return NextResponse.json({ success: false, message: 'هذا الإجراء مقصور على صاحب المقرر أو الإدارة' }, { status: 403 });
    }

    if (action === 'rename') {
      if (typeof name !== 'string' || !name.trim() || name.length > 200) {
        return NextResponse.json({ success: false, message: 'الاسم الجديد مطلوب' }, { status: 400 });
      }
      const { error } = await supabaseAdmin
        .from('courses')
        .update({ name: name.trim() })
        .eq('id', course_id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'تم تغيير اسم المقرر بنجاح' });
    }

    if (action === 'update_custom') {
      if (!custom_week_names || typeof custom_week_names !== 'object' || Array.isArray(custom_week_names)) {
        return NextResponse.json({ success: false, message: 'بيانات المقرر غير صالحة' }, { status: 400 });
      }
      if (JSON.stringify(custom_week_names).length > 2 * 1024 * 1024) {
        return NextResponse.json({ success: false, message: 'حجم بيانات المقرر أكبر من الحد المسموح' }, { status: 413 });
      }
      const { error } = await supabaseAdmin
        .from('courses')
        .update({ custom_week_names })
        .eq('id', course_id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'تم تحديث بيانات المقرر بنجاح' });
    }

    if (action === 'update_shared') {
      const ids = Array.isArray(shared_with)
        ? Array.from(new Set(shared_with.map((id: unknown) => String(id)).filter((id: string) => /^[A-Za-z0-9\-]{1,64}$/.test(id)))).slice(0, 50)
        : [];
      const { error } = await supabaseAdmin
        .from('courses')
        .update({ shared_with: ids })
        .eq('id', course_id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'تم تحديث المشاركة بنجاح' });
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from('courses')
        .delete()
        .eq('id', course_id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'تم حذف المقرر بنجاح' });
    }

    return NextResponse.json({ success: false, message: 'إجراء غير مدعوم' }, { status: 400 });
  } catch (err: any) {
    console.error('Course manage route error:', err);
    return NextResponse.json({ success: false, message: 'تعذر تنفيذ العملية' }, { status: 500 });
  }
}
