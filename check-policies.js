const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zyjwxzkxkwkkpfdipmoc.supabase.co';
const supabaseServiceKey = 'sb_secret_smkPlpE534fA2prJsA731Q_hJX3ldCX';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies');
  if (error) {
    console.log('Cannot use RPC. Let me just use postgres directly, wait no I dont have pg connection string.');
  }
}

checkPolicies();
