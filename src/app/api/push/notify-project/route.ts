import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToStudents } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.course_id || !body.project_name) {
      return NextResponse.json({ success: false, message: 'course_id and project_name are required' }, { status: 400 });
    }

    const { course_id, project_name, max_score } = body;

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id, name, academic_year')
      .eq('id', course_id)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    // Fetch all students in this course's academic year
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('student_code')
      .eq('academic_year', course.academic_year)
      .eq('is_active', true);

    const codes = (students || []).map((s: any) => s.student_code).filter(Boolean);
    if (codes.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No students found for course' });
    }

    const maxScoreText = max_score ? ` (من ${max_score} درجة)` : '';
    const projTag = `proj_${course_id}_${project_name}`;
    const pushResult = await sendPushToStudents(codes, {
      title: '📌 تم إضافة مشروع جديد مطلوب تسليمه',
      body: `تم إضافة مشروع جديد "${project_name}" بمقرر ${course.name}${maxScoreText}`,
      type: 'project',
      id: projTag,
      tag: projTag,
    });

    return NextResponse.json({ success: true, result: pushResult });
  } catch (error: any) {
    console.error('[notify-project]', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
