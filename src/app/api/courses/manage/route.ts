import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, course_id, name, custom_week_names, shared_with } = body;

    if (!course_id) {
      return NextResponse.json({ success: false, message: 'معرف المقرر مطلوب' }, { status: 400 });
    }

    if (action === 'rename') {
      if (!name || !name.trim()) {
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
      const { error } = await supabaseAdmin
        .from('courses')
        .update({ custom_week_names: custom_week_names || {} })
        .eq('id', course_id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'تم تحديث بيانات المقرر بنجاح' });
    }

    if (action === 'update_shared') {
      const { error } = await supabaseAdmin
        .from('courses')
        .update({ shared_with: shared_with || [] })
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
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
