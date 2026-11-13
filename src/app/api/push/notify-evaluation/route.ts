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
    let courseProjects: any[] = [];
    if (course_id) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('name, custom_week_names')
        .eq('id', course_id)
        .maybeSingle();
      if (course?.name) courseName = course.name;
      courseProjects = course?.custom_week_names?.__projects__ || [];
    }

    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, student_code, full_name, telegram_id')
      .eq('id', student_id)
      .maybeSingle();

    if (!student?.student_code) {
      return NextResponse.json({ success: false, message: 'Student code not found' });
    }

    let isUploadRequiredBeforeScore = false;
    if (course_id && courseProjects.length > 0) {
      const matchedProj = courseProjects.find((p: any) => (p.name || p.title || '').trim() === project_name.trim());
      if (matchedProj && matchedProj.portal_enabled !== false && matchedProj.is_active !== false) {
        const [{ data: evRecord }, { data: subData }] = await Promise.all([
          supabaseAdmin.from('evaluations').select('photo_url').eq('course_id', course_id).eq('student_id', student_id).eq('project_name', project_name).maybeSingle(),
          supabaseAdmin.from('student_submissions').select('images').eq('course_id', course_id).eq('student_code', student.student_code).eq('project_name', project_name).maybeSingle(),
        ]);
        const subImgs = Array.isArray(subData?.images) ? subData.images : [];
        const hasValidImg = subImgs.length > 0 || !!evRecord?.photo_url;
        if (matchedProj.multi_stage_enabled) {
          const s2Enabled = matchedProj.stage2_enabled !== false;
          const s1Enabled = matchedProj.stage1_enabled !== false;
          const hasS2 = subImgs.some((i: any) => typeof i === 'object' && i?.stage === 'stage2');
          const hasS1 = subImgs.some((i: any) => typeof i === 'string' || i?.stage === 'stage1' || !i?.stage) || (!!evRecord?.photo_url && subImgs.length === 0);
          const satisfied = s2Enabled ? hasS2 : (s1Enabled ? hasS1 : hasValidImg);
          if (!satisfied) isUploadRequiredBeforeScore = true;
        } else if (!hasValidImg) {
          isUploadRequiredBeforeScore = true;
        }
      }
    }

    const scoreDisplay = !isUploadRequiredBeforeScore && score !== undefined && score !== null
      ? ` (الدرجة: ${score})`
      : ' — ارفع صورة المشروع على البوابة لإظهار درجتك';
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
