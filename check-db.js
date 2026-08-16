const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zyjwxzkxkwkkpfdipmoc.supabase.co';
const supabaseServiceKey = 'sb_secret_smkPlpE534fA2prJsA731Q_hJX3ldCX';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*');
  console.log('Profiles in DB:', data);
  if (error) console.error('Error:', error);
}

check();
