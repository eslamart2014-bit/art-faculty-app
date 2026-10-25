import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStaff } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { name, academic_year, course_type, sections } = body;
    const teacher_id = guard.ctx.isAdmin && body.teacher_id ? String(body.teacher_id) : guard.ctx.user.id;

    if (typeof name !== 'string' || !name.trim() || name.length > 200) {
      return NextResponse.json({ success: false, message: 'اسم المقرر مطلوب' }, { status: 400 });
    }
    if (typeof academic_year !== 'string' || !academic_year.trim()) {
      return NextResponse.json({ success: false, message: 'الفرقة الدراسية مطلوبة' }, { status: 400 });
    }

    const normalizedType = course_type === 'lectures' ? 'lectures' : 'sections';
    const newCourseData = {
      name: name.trim(),
      academic_year: academic_year.trim().slice(0, 60),
      course_type: normalizedType,
      sections: normalizedType === 'sections' && Array.isArray(sections)
        ? sections.map((s: unknown) => String(s).slice(0, 30)).slice(0, 50)
        : [],
      teacher_id,
      custom_week_names: {},
      makeup_students: [],
      excluded_students: [],
      student_section_overrides: {},
      shared_with: []
    };

    const { data, error } = await supabaseAdmin
      .from('courses')
      .insert(newCourseData)
      .select()
      .single();

    if (error) {
      console.error('Error saving course via admin client:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'تم حفظ المقرر بنجاح',
      course: data
    });
  } catch (err: any) {
    console.error('Course save route unexpected error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
