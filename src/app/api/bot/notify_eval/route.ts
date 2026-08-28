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
    const { studentId, projectName, score, projectShowScore } = await request.json();
    if (!studentId || !projectName) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { data: sysSettings } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).single();
    const botToken = sysSettings?.telegram_config?.botInfo?.token;
    const globalShowScores = sysSettings?.telegram_config?.show_project_scores_to_students !== false;
    
    if (!botToken) return NextResponse.json({ error: 'No bot token' }, { status: 400 });

    const { data: student } = await supabase.from('students').select('telegram_id').eq('id', studentId).single();
    if (!student || !student.telegram_id) return NextResponse.json({ success: true, count: 0 });

    const canShowScore = globalShowScores && projectShowScore !== false;
    
    const msg = canShowScore
      ? `🎉 <b>تم رصد وتقييم عملك من خلال الأستاذ!</b>\n\n📝 <b>المشروع:</b> ${projectName}\n⭐️ <b>الدرجة المرصودة:</b> <b>${score}</b>\n\n<i>يمكنك الاطلاع على تفاصيل التقييم عبر زر (معرض أعمالي).</i>`
      : `🎉 <b>تم اعتماد وتقييم عملك بنجاح!</b>\n\n📝 <b>المشروع:</b> ${projectName}\n✅ <b>الحالة:</b> معتمد ومقيّم.\n\n<i>يمكنك متابعة أعمالك عبر زر (معرض أعمالي).</i>`;

    await sendTelegramMessage(botToken, student.telegram_id, msg);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
