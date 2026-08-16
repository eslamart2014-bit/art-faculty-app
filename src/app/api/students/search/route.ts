import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Use anon key (public) since students table is readable by all
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const level = searchParams.get('level') || '';

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ students: [] });
  }

  try {
    const trimmed = query.trim();
    let dbQuery = supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section');

    // If numeric - search by student code
    if (/^\d+$/.test(trimmed)) {
      dbQuery = dbQuery.eq('student_code', trimmed);
    } else {
      // Search by name
      dbQuery = dbQuery.ilike('full_name', `%${trimmed}%`);
    }

    // Apply level filter if set (and not "الكل")
    if (level && level !== 'الكل' && level !== '') {
      dbQuery = dbQuery.ilike('academic_year', `%${level.replace('السنة ', '')}%`);
    }

    const { data, error } = await dbQuery.limit(30);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: error.message, students: [] }, { status: 500 });
    }

    return NextResponse.json({ students: data || [] });
  } catch (err: any) {
    console.error('Search exception:', err);
    return NextResponse.json({ error: err.message, students: [] }, { status: 500 });
  }
}
