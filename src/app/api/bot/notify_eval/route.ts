import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveTelegramBotToken, getStudentTelegramButtons } from '@/lib/telegram/push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendTelegramMessage(botToken: string, chatId: string | number, text: string, replyMarkup: any) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!callerProfile || (callerProfile.role !== 'مدير' && callerProfile.role !== 'معلم')) {
      return NextResponse.json({ error: 'Forbidden — Staff only' }, { status: 403 });
    }

    const { studentId, courseId, projectName, score, projectShowScore } = await request.json();
    if (!studentId || !projectName) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { data: sysSettings } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).maybeSingle();
    const botToken = await getActiveTelegramBotToken();
    const globalShowScores = sysSettings?.telegram_config?.show_project_scores_to_students !== false;

    if (!botToken) return NextResponse.json({ error: 'No bot token' }, { status: 400 });

    const { data: student } = await supabase.from('students').select('id, student_code, telegram_id, full_name').eq('id', studentId).single();
    if (!student || !student.telegram_id) return NextResponse.json({ success: true, count: 0 });

    let isUploadRequiredBeforeScore = false;
    try {
      let evQuery = supabase.from('evaluations').select('course_id, photo_url').eq('student_id', studentId).eq('project_name', projectName);
      if (courseId) evQuery = evQuery.eq('course_id', courseId);
      const { data: evRecord } = await evQuery.limit(1).maybeSingle();
      const targetCourseId = courseId || evRecord?.course_id;

      if (targetCourseId) {
        const [{ data: courseData }, { data: subData }] = await Promise.all([
          supabase.from('courses').select('custom_week_names').eq('id', targetCourseId).maybeSingle(),
          supabase.from('student_submissions').select('images').eq('course_id', targetCourseId).eq('student_code', student.student_code).eq('project_name', projectName).maybeSingle(),
        ]);
        const projectsList = courseData?.custom_week_names?.__projects__ || [];
        const matchedProj = projectsList.find((p: any) => (p.name || p.title || '').trim() === projectName.trim());
        if (matchedProj && matchedProj.portal_enabled !== false && matchedProj.is_active !== false) {
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
    } catch {}

    const canShowScore = globalShowScores && projectShowScore !== false && !isUploadRequiredBeforeScore;

    const msg = isUploadRequiredBeforeScore
      ? `🎨 <b>تم رصد تقييم عملك — قسم التربية الفنية</b>\n\nمرحباً <b>${student.full_name || 'عزيزي الطالب'}</b> 👨‍🎓\n📝 <b>المشروع:</b> ${projectName}\n🔒 <b>الدرجة المرصودة:</b> <b>مخفية مؤقتاً (تظهر فور رفع صورة المشروع)</b>\n\n⚠️ <b>شرط أساسي لظهور الدرجة:</b> قم بالدخول لبوابة فنية وتصوير ورفع المشروع أولاً لتظهر لك درجتك فوراً 👇`
      : canShowScore
      ? `🎉 <b>تم رصد وتقييم عملك — قسم التربية الفنية</b>\n\nمرحباً <b>${student.full_name || 'عزيزي الطالب'}</b> 👨‍🎓\n📝 <b>المشروع:</b> ${projectName}\n⭐️ <b>الدرجة المرصودة:</b> <b>${score}</b>\n\n<i>اضغط على زر (🎨 الدخول لبوابة فنية) للاطلاع على التفاصيل 👇</i>`
      : `🎉 <b>تم اعتماد وتقييم عملك بنجاح!</b>\n\nمرحباً <b>${student.full_name || 'عزيزي الطالب'}</b> 👨‍🎓\n📝 <b>المشروع:</b> ${projectName}\n✅ <b>الحالة:</b> معتمد ومقيّم.\n\n<i>اضغط على زر (🎨 الدخول لبوابة فنية) لمتابعة أعمالك 👇</i>`;

    await sendTelegramMessage(botToken, student.telegram_id, msg, getStudentTelegramButtons());

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('notify_eval error:', error);
    return NextResponse.json({ error: 'تعذر إرسال الإشعار' }, { status: 500 });
  }
}
