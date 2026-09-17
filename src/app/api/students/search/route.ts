import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const level = (searchParams.get('level') || '').trim();

  // إذا لم يكن هناك استعلام ولا فرقة محددة
  if (!query && (!level || level === 'الكل')) {
    return NextResponse.json({ students: [] });
  }

  try {
    let dbQuery = supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section');

    // 1. فلترة بالفرقة الدراسية (مطابقة تامة لكافة الفرق الأربعة)
    if (level && level !== 'الكل') {
      if (level.includes('أول') || level.includes('اول')) {
        dbQuery = dbQuery.ilike('academic_year', '%اول%');
      } else if (level.includes('ثان') || level.includes('تاني')) {
        dbQuery = dbQuery.ilike('academic_year', '%ثاني%');
      } else if (level.includes('ثالث') || level.includes('تالت')) {
        dbQuery = dbQuery.ilike('academic_year', '%ثالث%');
      } else if (level.includes('رابع')) {
        dbQuery = dbQuery.ilike('academic_year', '%رابع%');
      } else {
        const clean = level.replace('الفرقة ', '').replace('السنة ', '').trim();
        dbQuery = dbQuery.ilike('academic_year', `%${clean}%`);
      }
    }

    // 2. فلترة بالبحث (اسم أو كود)
    if (query) {
      if (/^\d+$/.test(query)) {
        // بحث برقم الكود
        dbQuery = dbQuery.ilike('student_code', `%${query}%`);
      } else {
        // بحث باسم الطالب
        dbQuery = dbQuery.ilike('full_name', `%${query}%`);
      }
    }

    const { data, error } = await dbQuery
      .order('student_code', { ascending: true })
      .limit(30);

    if (error) {
      console.error('Students search error:', error);
      return NextResponse.json({ error: error.message, students: [] }, { status: 500 });
    }

    return NextResponse.json({ students: data || [] });
  } catch (err: any) {
    console.error('Search unexpected error:', err);
    return NextResponse.json({ error: err.message, students: [] }, { status: 500 });
  }
}
