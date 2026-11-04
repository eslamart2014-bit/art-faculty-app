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

    const { courseId, projectName, startDate, endDate } = await request.json();
    if (!courseId || !projectName) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const botToken = await getActiveTelegramBotToken();
    if (!botToken) return NextResponse.json({ error: 'No bot token' }, { status: 400 });

    const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    let query = supabase
      .from('students')
      .select('telegram_id, full_name')
      .eq('academic_year', course.academic_year)
      .not('telegram_id', 'is', null);

    if (course.course_type === 'sections' && Array.isArray(course.sections) && course.sections.length > 0) {
      query = query.in('section', course.sections);
    }

    const { data: students } = await query;
    if (!students || students.length === 0) return NextResponse.json({ success: true, count: 0 });

    let message = `📢 <b>إعلان مشروع جديد — قسم التربية الفنية</b>\n\n`;
    message += `تم إضافة وتفعيل مشروع <b>( ${projectName} )</b> في مقرر <b>( ${course.name} )</b>.\n`;

    if (startDate) {
      message += `\n📅 متاح للتسليم من: ${new Date(startDate).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`;
    }
    if (endDate) {
      message += `\n⏳ آخر موعد للتسليم: ${new Date(endDate).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`;
    }

    message += `\n\n<i>اضغط على زر (🎨 الدخول لبوابة فنية) بالأسفل لتصوير وتسليم المشروع في الموعد المحدد 👇</i>`;

    const replyMarkup = getStudentTelegramButtons();
    let successCount = 0;
    const chunkSize = 15;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (s) => {
          if (s.telegram_id) {
            const ok = await sendTelegramMessage(botToken, s.telegram_id, message, replyMarkup);
            if (ok) successCount++;
          }
        })
      );
      if (i + chunkSize < students.length) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    return NextResponse.json({ success: true, count: successCount });
  } catch (error: any) {
    console.error('notify_course error:', error);
    return NextResponse.json({ error: 'تعذر إرسال الإشعارات' }, { status: 500 });
  }
}
