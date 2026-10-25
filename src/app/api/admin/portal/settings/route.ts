import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCoordinator } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const guard = await requireCoordinator(request);
  if (!guard.ok) return guard.response;

  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('telegram_config')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      settings: {
        hide_warnings_tab: !!data?.telegram_config?.hide_warnings_tab,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Error fetching portal settings:', err);
    return NextResponse.json({ error: err.message || 'Error fetching settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireCoordinator(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { hide_warnings_tab } = body;

    // Fetch existing telegram_config to preserve other settings
    const { data: current } = await supabaseAdmin
      .from('system_settings')
      .select('telegram_config')
      .eq('id', 1)
      .maybeSingle();

    const merged = {
      ...(current?.telegram_config || {}),
      hide_warnings_tab: Boolean(hide_warnings_tab),
    };

    const { error } = await supabaseAdmin
      .from('system_settings')
      .update({ telegram_config: merged })
      .eq('id', 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      settings: {
        hide_warnings_tab: Boolean(hide_warnings_tab),
      },
    });
  } catch (err: any) {
    console.error('Error updating portal settings:', err);
    return NextResponse.json({ error: err.message || 'Error updating settings' }, { status: 500 });
  }
}
