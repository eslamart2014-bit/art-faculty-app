import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: profiles } = await supabase.from('profiles').select('*').not('telegram_id', 'is', null);
  console.log('Profiles with Telegram:', profiles);

  for (const p of profiles || []) {
    const { data: students } = await supabase.from('students').select('*').eq('telegram_id', p.telegram_id);
    if (students && students.length > 0) {
      console.log(`Found ${students.length} students linked to Admin ${p.full_name} (${p.telegram_id})`);
      await supabase.from('students').update({ telegram_id: null, telegram_username: null, telegram_first_name: null }).eq('telegram_id', p.telegram_id);
      console.log('Cleaned up student links!');
    }
  }
}

main().catch(console.error);
