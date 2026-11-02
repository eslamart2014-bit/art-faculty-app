import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToStudents } from '@/lib/push';

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
    const pushResult = await sendPushToStudents([student.student_code], {
      title: '🎨 تم رصد تقييم جديد لأعمالك',
      body: `تم رصد تقييم مشروع "${project_name}" بمقرر ${courseName}${scoreDisplay}`,
      type: 'grade',
      id: evalTag,
      tag: evalTag,
    });

    // Dispatch direct Telegram message if student has telegram_id
    if (student.telegram_id) {
      try {
        const { data: sysData } = await supabaseAdmin
          .from('system_settings')
          .select('telegram_config')
          .eq('id', 1)
          .limit(1)
          .maybeSingle();

        const botToken = sysData?.telegram_config?.token || process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
          const tgMsg = `🎨 <b>رصد تقييم جديد — قسم التربية الفنية</b>\n\nمرحباً <b>${student.full_name}</b> 👨‍🎓\nتم رصد تقييم عملك لمشروع:\n📋 <b>${project_name}</b>\n📚 المقرر: <b>${courseName}</b>\n${score !== undefined && score !== null ? `⭐️ الدرجة: <b>${score}</b>\n` : ''}\n<i>يمكنك الاطلاع على تفاصيل أعمالك عبر بوابة فنية 🚀</i>`;

          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: student.telegram_id,
              text: tgMsg,
              parse_mode: 'HTML'
            })
          }).catch(() => {});
        }
      } catch (tgErr) {
        console.error('[notify-evaluation] telegram error:', tgErr);
      }
    }

    return NextResponse.json({ success: true, result: pushResult });
  } catch (error: any) {
    console.error('[notify-evaluation]', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
