require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const query = "احمد";
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, student_code, academic_year, section')
    .or(`full_name.ilike.%${query}%,student_code.ilike.%${query}%`)
    .limit(10);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
