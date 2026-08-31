import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ telegram_id: null, telegram_link_token: null })
    .ilike('full_name', '%يوسف جامع%')
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully unlinked:', data);
  }
}

main().catch(console.error);
