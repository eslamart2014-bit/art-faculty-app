import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const { data: sysData, error } = await supabase
      .from('system_settings')
      .select('telegram_config')
      .eq('id', 1)
      .maybeSingle();

    if (error || !sysData?.telegram_config?.botInfo?.username) {
      return NextResponse.json({ username: null });
    }

    return NextResponse.json({ username: sysData.telegram_config.botInfo.username });
  } catch (err) {
    return NextResponse.json({ username: null });
  }
}
