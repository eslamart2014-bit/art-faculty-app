import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const level = searchParams.get('level');

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'يرجى كتابة حرفين على الأقل' }, { status: 400 });
  }

  try {
    let dbQuery = supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section');
      
    if (!isNaN(Number(query))) {
      dbQuery = dbQuery.or(`student_code.eq.${query},full_name.ilike.%${query}%`);
    } else {
      dbQuery = dbQuery.ilike('full_name', `%${query}%`);
    }

    if (level && level !== 'الكل') {
      const cleanLevel = level.replace('الفرقة ', '');
      dbQuery = dbQuery.ilike('academic_year', `%${cleanLevel}%`);
    }

    const { data, error } = await dbQuery.limit(20);

    if (error) throw error;

    return NextResponse.json({ students: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
