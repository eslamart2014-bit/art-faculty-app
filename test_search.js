const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zyjwxzkxkwkkpfdipmoc.supabase.co';
const supabaseKey = 'sb_publishable_icyal0PmeqMePWyzT9QJuA_mqezDg3f';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSearch(query) {
  console.log('Testing search for:', query);
  
  let dbQuery = supabase.from('students').select('id, full_name, student_code, academic_year, section');
  
  if (/^\d+$/.test(query.trim())) {
    dbQuery = dbQuery.eq('student_code', query.trim());
  } else {
    dbQuery = dbQuery.ilike('full_name', `%${query.trim()}%`);
  }
  
  const { data, error } = await dbQuery.limit(5);
  
  if (error) {
    console.error('ERROR:', JSON.stringify(error, null, 2));
  } else {
    console.log('RESULTS:', data?.length, 'students found');
    if (data && data.length > 0) console.log('First:', data[0]);
  }
}

// Test with a name that likely exists
testSearch('ا').then(() => testSearch('1'));
