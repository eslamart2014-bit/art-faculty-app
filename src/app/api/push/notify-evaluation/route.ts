import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';
import { sendPushToStudents } from '@/lib/telegram/push';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.student_id || !body.project_name) {
      return NextResponse.json({ success: false, message: 'student_id and project_name are required' }, { status: 400 });
    }

    const { student_id, course_id, project_name, score } = body;

    let courseName = 'المقرر';
    if (course_id) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('name')
        .eq('id', course_id)
        .maybeSingle();
      if (course?.name) courseName = course.name;
    }

    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, student_code, full_name, telegram_id')
      .eq('id', student_id)
      .maybeSingle();

    if (!student?.student_code) {
      return NextResponse.json({ success: false, message: 'Student code not found' });
    }

    const scoreDisplay = score !== undefined && score !== null ? ` (الدرجة: ${score})` : '';
    const evalTag = `eval_${student.student_code}_${project_name}_${course_id || 'course'}`;
    const evalBody = `🎨 تم رصد تقييم مشروع "${project_name}" بمقرر ${courseName}${scoreDisplay}`;

    const pushResult = await sendPushToStudents([student.student_code], {
      title: '🎨 رصد تقييم جديد',
      body: evalBody,
      type: 'grade',
      id: evalTag,
      tag: evalTag,
      telegramHtml: `<b>${evalBody}</b>`,
    });

    return NextResponse.json({ success: true, result: pushResult });
  } catch (error: any) {
    console.error('[notify-evaluation]', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
