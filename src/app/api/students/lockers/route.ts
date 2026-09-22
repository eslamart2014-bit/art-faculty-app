import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { lockerStore } from '@/lib/lockerStore';

export const dynamic = 'force-dynamic';

function normalizeCohort(raw: string): string {
  if (!raw) return '';
  const s = raw.replace(/الفرقة\s*/, '').trim();
  if (s.includes('اول') || s.includes('أول')) return 'الاولي';
  if (s.includes('ثان')) return 'الثانية';
  if (s.includes('ثالث')) return 'الثالثة';
  if (s.includes('رابع')) return 'الرابعة';
  return s;
}

// 1. GET: فحص حالة تسكين الطالب
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim();
  const name = (searchParams.get('name') || '').trim();

  if (!code && !name) {
    return NextResponse.json({ error: 'يرجى تقديم كود أو اسم الطالب' }, { status: 400 });
  }

  try {
    await lockerStore.ensureLoaded();
    const result = lockerStore.getStudentLockerStatus(code || name);
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء فحص الدواليب' }, { status: 500 });
  }
}

// 2. POST: البحث الذكي عن زملاء الدفعة أو تقديم طلب الحجز
export async function POST(request: Request) {
  try {
    await lockerStore.ensureLoaded();
    const body = await request.json();
    const action = body.action || 'book';

    // أ) البحث الذكي عن زملاء نفس الفرقة غير المسجلين
    if (action === 'search_peers') {
      const { cohort, query, excludeCodes = [] } = body;
      const cleanQuery = (query || '').trim();

      // استعلام الطلاب من نفس الفرقة
      let dbQuery = supabaseAdmin
        .from('students')
        .select('student_code, full_name, academic_year')
        .limit(30);

      const norm = normalizeCohort(cohort);
      if (norm) {
        dbQuery = dbQuery.or(`academic_year.eq.${norm},academic_year.ilike.%${norm}%`);
      }

      if (cleanQuery) {
        dbQuery = dbQuery.or(`full_name.ilike.%${cleanQuery}%,student_code.ilike.%${cleanQuery}%`);
      }

      const { data: peers, error } = await dbQuery;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // فلترة الطلاب: استبعاد من هم محجوزين مسبقاً في دواليب أو في قائمة الانتظار
      const availablePeers = (peers || []).filter(student => {
        // استبعاد المستبعدين مسبقاً في الطلب الحالي
        if (excludeCodes.includes(student.student_code)) return false;

        // فحص هل الطالب مسكن في أي دولاب
        const status = lockerStore.getStudentLockerStatus(student.student_code);
        return status.status === 'none';
      });

      return NextResponse.json({
        success: true,
        peers: availablePeers.slice(0, 15)
      });
    }

    // ب) تقديم طلب حجز دولاب
    if (action === 'book') {
      const {
        cohort,
        representative_phone,
        student_names,
        student_codes,
        preferred_letter
      } = body;

      if (!cohort || !representative_phone || !student_names || student_names.length === 0) {
        return NextResponse.json({
          error: 'البيانات غير مكتملة (الفرقة، رقم الهاتف، وأسماء الطلاب مطلوبة)'
        }, { status: 400 });
      }

      const result = await lockerStore.bookLocker({
        cohort,
        representative_phone,
        student_names,
        student_codes: student_codes || [],
        preferred_letter
      });

      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        isWaitlist: result.isWaitlist,
        booking: result.booking || null,
        waitlist: result.waitlist || null,
        locker: result.locker || null,
        message: result.message
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ بالخادم' }, { status: 500 });
  }
}
