import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, academic_year, course_type, sections, teacher_id } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: 'اسم المقرر مطلوب' }, { status: 400 });
    }
    if (!academic_year) {
      return NextResponse.json({ success: false, message: 'الفرقة الدراسية مطلوبة' }, { status: 400 });
    }

    const newCourseData = {
      name: name.trim(),
      academic_year,
      course_type: course_type || 'sections',
      sections: course_type === 'sections' ? (sections || []) : [],
      teacher_id: teacher_id || null,
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
