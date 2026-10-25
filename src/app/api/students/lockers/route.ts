import { supabaseAdmin } from '@/lib/supabase';
import { lockerStore } from '@/lib/lockerStore';
import { getStudentCodeVariants } from '@/lib/codeHelper';
import { getStudentSession, noStoreJson } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

function sanitizeSearchTerm(value: unknown): string {
  return String(value || '')
    .replace(/[%_,().*\\:'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

async function getSessionStudent(request: Request) {
  const session = getStudentSession(request);
  if (!session) return null;
  const { data } = await supabaseAdmin
    .from('students')
    .select('id, student_code, full_name, academic_year')
    .in('student_code', getStudentCodeVariants(session.code))
    .maybeSingle();
  return data || null;
}

export async function GET(request: Request) {
  const student = await getSessionStudent(request);
  if (!student) {
    return noStoreJson({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
  }

  try {
    await lockerStore.ensureLoaded();
    const result = lockerStore.getStudentLockerStatus({
      code: student.student_code,
      name: student.full_name,
    });
    return noStoreJson({ success: true, data: result });
  } catch (err: any) {
    return noStoreJson({ error: 'حدث خطأ أثناء فحص الدواليب' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const student = await getSessionStudent(request);
  if (!student) {
    return noStoreJson({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
  }

  try {
    await lockerStore.ensureLoaded();
    const body = await request.json();
    const action = body.action || 'book';

    if (action === 'search_peers') {
      const term = sanitizeSearchTerm(body.query);
      const excludeCodes = Array.isArray(body.excludeCodes)
        ? body.excludeCodes.filter((c: unknown) => typeof c === 'string').slice(0, 20)
        : [];

      let dbQuery = supabaseAdmin
        .from('students')
        .select('student_code, full_name, academic_year')
        .eq('academic_year', student.academic_year)
        .limit(30);

      if (term) {
        if (/^\d+$/.test(term)) {
          dbQuery = dbQuery.ilike('student_code', `%${term}%`);
        } else {
          dbQuery = dbQuery.ilike('full_name', `%${term}%`);
        }
      }

      const { data: peers, error } = await dbQuery;
      if (error) {
        return noStoreJson({ error: 'تعذر البحث عن الزملاء' }, { status: 500 });
      }

      const availablePeers = (peers || []).filter((peer: any) => {
        if (peer.student_code === student.student_code) return false;
        if (excludeCodes.includes(peer.student_code)) return false;
        const status = lockerStore.getStudentLockerStatus({
          code: peer.student_code,
          name: peer.full_name,
        });
        return status.status === 'none';
      });

      return noStoreJson({ success: true, peers: availablePeers.slice(0, 15) });
    }

    if (action === 'book') {
      const { representative_phone, student_names, student_codes, preferred_letter } = body;

      if (
        !Array.isArray(student_names) ||
        student_names.length !== 4 ||
        !Array.isArray(student_codes) ||
        student_codes.length !== 4
      ) {
        return noStoreJson(
          { error: 'يشترط تسجيل 4 طلاب بالتمام والكمال للدولاب الواحد (مقدم الطلب + 3 زملاء)' },
          { status: 400 }
        );
      }

      const cleanNames = student_names.map((n: unknown) => String(n || '').trim().slice(0, 80));
      const cleanCodes = student_codes.map((c: unknown) => String(c || '').trim().slice(0, 20));

      if (cleanNames.some((n: string) => !n) || cleanCodes.some((c: string) => !/^[A-Za-z0-9\-_]+$/.test(c))) {
        return noStoreJson({ error: 'بيانات الطلاب غير صالحة' }, { status: 400 });
      }

      const ownVariants = getStudentCodeVariants(student.student_code);
      if (!cleanCodes.some((c: string) => ownVariants.includes(c))) {
        return noStoreJson({ error: 'لا يمكنك حجز دولاب دون إدراج كودك ضمن الطلاب الأربعة' }, { status: 403 });
      }

      const phone = String(representative_phone || '').replace(/[^\d]/g, '');
      if (!/^01\d{9}$/.test(phone)) {
        return noStoreJson({ error: 'رقم هاتف الممثل غير صالح' }, { status: 400 });
      }

      const result = await lockerStore.bookLocker({
        cohort: student.academic_year,
        representative_phone: phone,
        student_names: cleanNames,
        student_codes: cleanCodes,
        preferred_letter: typeof preferred_letter === 'string' ? preferred_letter.slice(0, 2) : undefined,
      });

      if (!result.success) {
        return noStoreJson({ error: result.message }, { status: 400 });
      }

      return noStoreJson({
        success: true,
        isWaitlist: result.isWaitlist,
        booking: result.booking || null,
        waitlist: result.waitlist || null,
        locker: result.locker || null,
        message: result.message,
      });
    }

    return noStoreJson({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    return noStoreJson({ error: 'حدث خطأ بالخادم' }, { status: 500 });
  }
}
