import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const level = (searchParams.get('level') || '').trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ students: [] });
  }

  // Use anon key - students table is public readable
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing env vars', students: [] }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let dbQuery = supabase
      .from('students')
      .select('id, full_name, student_code, academic_year, section');

    if (/^\d+$/.test(query)) {
      // Numeric search: match student_code that contains the query
      // e.g. searching "1" matches "001", "011", "100", "1" etc.
      dbQuery = dbQuery.ilike('student_code', `%${query}%`);
    } else {
      // Name search
      dbQuery = dbQuery.ilike('full_name', `%${query}%`);
    }

    // Apply level filter
    if (level && level !== 'الكل' && level !== '') {
      const levelNum = level.replace('السنة ', '').trim();
      dbQuery = dbQuery.ilike('academic_year', `%${levelNum}%`);
    }

    const { data, error } = await dbQuery.limit(30);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message, students: [] }, { status: 500 });
    }

    return NextResponse.json({ students: data || [] });
  } catch (err: any) {
    console.error('Search error:', err);
    return NextResponse.json({ error: err.message, students: [] }, { status: 500 });
  }
}
