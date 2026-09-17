import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    // CRIT-6 FIX: Verify caller is an authenticated admin/teacher
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only teachers and admins can send warnings
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

    // Read bot token from DB (not from env — token is stored in system_settings)
    const { data: sysData } = await supabaseAdmin
      .from('system_settings')
      .select('telegram_config')
      .eq('id', 1)
      .maybeSingle();

    const botToken = sysData?.telegram_config?.token;
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
