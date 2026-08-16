const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zyjwxzkxkwkkpfdipmoc.supabase.co';
const supabaseServiceKey = 'sb_secret_smkPlpE534fA2prJsA731Q_hJX3ldCX';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  console.log('Users in Auth:', users.users.map(u => ({ id: u.id, email: u.email })));
}

check();
