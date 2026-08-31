import { NextResponse } from 'next/server';


export async function POST(req: Request) {
  try {
    const { warnings, courseName, limit } = await req.json();

    if (!warnings || !Array.isArray(warnings) || warnings.length === 0) {
      return NextResponse.json({ error: 'Missing warnings list' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    let successCount = 0;
    
    for (const w of warnings) {
      if (!w.telegram_id) continue;

      const message = `⚠️ *إنذار غياب* ⚠️\n\nعزيزي الطالب / *${w.full_name}*\n\nنلفت انتباهك إلى تجاوزك لنسبة الغياب المقررة في مقرر:\n📚 *${courseName}*\n\nعدد مرات الغياب: *${w.absences}* (الحد الأقصى: ${limit})\n\nيرجى مراجعة أستاذ المقرر لتسوية موقفك وتجنب الحرمان.`;

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: w.telegram_id,
            text: message,
            parse_mode: 'Markdown'
          })
        });
        successCount++;
      } catch (err) {
        console.error('Failed to notify student', w.id, err);
      }
    }

    return NextResponse.json({ success: true, count: successCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
