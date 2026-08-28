import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendTelegramMessage(botToken: string, chatId: string | number, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { courseId, projectName, startDate, endDate } = await request.json();
    if (!courseId || !projectName) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { data: sysSettings } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).single();
    const botToken = sysSettings?.telegram_config?.botInfo?.token;
    if (!botToken) return NextResponse.json({ error: 'No bot token' }, { status: 400 });

    const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    // Fetch students that match this course
    let query = supabase.from('students').select('telegram_id').eq('academic_year', course.academic_year).not('telegram_id', 'is', null);
    if (course.course_type === 'sections' && Array.isArray(course.sections) && course.sections.length > 0) {
      query = query.in('section', course.sections);
    }

    const { data: students } = await query;
    if (!students || students.length === 0) return NextResponse.json({ success: true, count: 0 });

    let message = `📢 <b>إعلان مشروع جديد!</b>\n\n`;
    message += `تم إضافة وتفعيل مشروع <b>( ${projectName} )</b> في مقرر <b>( ${course.name} )</b>.\n`;
    
    if (startDate) {
      message += `\n📅 متاح للتسليم من: ${new Date(startDate).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`;
    }
    if (endDate) {
      message += `\n⏳ آخر موعد للتسليم: ${new Date(endDate).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`;
    }
    
    message += `\n\nيرجى الدخول من القائمة لتسليم المشروع في الوقت المحدد.`;

    // Send notifications in parallel batches to avoid taking too long
    let successCount = 0;
    const chunkSize = 10;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (s) => {
        if (s.telegram_id) {
          const ok = await sendTelegramMessage(botToken, s.telegram_id, message);
          if (ok) successCount++;
        }
      }));
    }

    return NextResponse.json({ success: true, count: successCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
