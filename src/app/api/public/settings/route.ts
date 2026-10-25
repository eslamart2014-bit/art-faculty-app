import { supabaseAdmin } from '@/lib/supabase';
import { noStoreJson } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('term1_start, term2_start, term1_end, term2_end, is_maintenance_mode, maintenance_message, telegram_config')
      .eq('id', 1)
      .maybeSingle();

    const cfg = data?.telegram_config || {};

    return noStoreJson({
      term1_start: data?.term1_start ?? null,
      term2_start: data?.term2_start ?? null,
      term1_end: data?.term1_end ?? null,
      term2_end: data?.term2_end ?? null,
      is_maintenance_mode: Boolean(data?.is_maintenance_mode),
      maintenance_message: typeof data?.maintenance_message === 'string' ? data.maintenance_message : null,
      maintenance_scope: typeof cfg.maintenance_scope === 'string' ? cfg.maintenance_scope : 'faculty',
    });
  } catch (err) {
    console.error('public settings error:', err);
    return noStoreJson({ error: 'تعذر تحميل الإعدادات' }, { status: 500 });
  }
}
