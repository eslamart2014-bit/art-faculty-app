import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveTelegramBotToken, getStudentTelegramButtons } from '@/lib/telegram/push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || (profile.role !== 'مدير' && profile.role !== 'معلم')) {
      return NextResponse.json({ error: 'Forbidden — Staff only' }, { status: 403 });
    }

    const { warnings, courseName, limit } = await req.json();

    if (!warnings || !Array.isArray(warnings) || warnings.length === 0) {
      return NextResponse.json({ error: 'Missing warnings list' }, { status: 400 });
    }

    const botToken = await getActiveTelegramBotToken();
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const replyMarkup = getStudentTelegramButtons();
    let successCount = 0;

    for (let i = 0; i < warnings.length; i++) {
      const w = warnings[i];
      if (!w.telegram_id) continue;

      const message =
        `⚠️ <b>إنذار غياب — قسم التربية الفنية</b> ⚠️\n\n` +
        `عزيزي الطالب / <b>${w.full_name}</b>\n\n` +
        `نلفت انتباهك إلى تجاوزك لنسبة الغياب المقررة في مقرر:\n` +
        `📚 <b>${courseName}</b>\n\n` +
        `❌ عدد مرات الغياب: <b>${w.absences}</b> (الحد الأقصى: ${limit})\n\n` +
        `<i>يرجى مراجعة أستاذ المقرر لتسوية موقفك وتجنب الحرمان، أو متابعة سجل حضورك عبر بوابة فنية بالأسفل 👇</i>`;

      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: w.telegram_id,
            text: message,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          }),
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error('Failed to notify student', w.id, err);
      }

      if ((i + 1) % 15 === 0) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    return NextResponse.json({ success: true, count: successCount });
  } catch (error: any) {
    console.error('notify_warning error:', error);
    return NextResponse.json({ error: 'تعذر إرسال الإشعار' }, { status: 500 });
  }
}
