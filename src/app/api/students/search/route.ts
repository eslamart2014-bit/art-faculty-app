import { supabaseAdmin } from '@/lib/supabase';
import { noStoreJson } from '@/lib/serverAuth';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const LEVEL_FILTERS: Record<string, string> = {
  'الفرقة الأولى': 'اول',
  'الفرقة الاولي': 'اول',
  'الفرقة الأولي': 'اول',
  'اول': 'اول',
  'أول': 'اول',
  'الفرقة الثانية': 'ثاني',
  'الثانية': 'ثاني',
  'ثاني': 'ثاني',
  'الفرقة الثالثة': 'ثالث',
  'الثالثة': 'ثالث',
  'ثالث': 'ثالث',
  'الفرقة الرابعة': 'رابع',
  'الرابعة': 'رابع',
  'رابع': 'رابع',
};

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`student-search:${ip}`, 30, 60_000)) {
    return noStoreJson({ error: 'عدد محاولات البحث كبير، يرجى المحاولة بعد قليل', students: [] }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get('q') || searchParams.get('query') || '').trim();
  const level = (searchParams.get('level') || '').trim();

  const query = rawQuery.replace(/[%_,().*\\:'"]/g, '').replace(/\s+/g, ' ').slice(0, 60);
  const levelKey = level && level !== 'الكل' ? LEVEL_FILTERS[level] : null;

  if (!query && !levelKey) {
    return noStoreJson({ students: [] });
  }
  if (query && query.length < 2) {
    return noStoreJson({ students: [] });
  }

  try {
    let dbQuery = supabaseAdmin
      .from('students')
      .select('full_name, student_code, academic_year, section')
      .limit(10);

    if (levelKey) {
      dbQuery = dbQuery.ilike('academic_year', `%${levelKey}%`);
    }

    if (query) {
      if (/^\d+$/.test(query)) {
        dbQuery = dbQuery.ilike('student_code', `%${query}%`);
      } else {
        dbQuery = dbQuery.ilike('full_name', `%${query}%`);
      }
    }

    const { data, error } = await dbQuery.order('student_code', { ascending: true });

    if (error) {
      console.error('Students search error:', error.message);
      return noStoreJson({ error: 'تعذر تنفيذ البحث', students: [] }, { status: 500 });
    }

    return noStoreJson({ students: data || [] });
  } catch (err: any) {
    console.error('Search unexpected error:', err);
    return noStoreJson({ error: 'تعذر تنفيذ البحث', students: [] }, { status: 500 });
  }
}
