import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. جلب حسابات الطلاب المسجلة
    const { data: dbAccounts, error: accErr } = await supabaseAdmin
      .from('student_accounts')
      .select('student_code, full_name, created_at, last_login_at, status')
      .order('created_at', { ascending: false });

    // 2. جلب بيانات الطلاب لاستكمال الأسماء إن كانت فارغة
    const { data: studentsList } = await supabaseAdmin
      .from('students')
      .select('student_code, full_name, telegram_browser_id');

    const studentMap = new Map<string, any>();
    (studentsList || []).forEach((st: any) => {
      if (st.student_code) {
        studentMap.set(st.student_code, st);
      }
    });

    const accountsMap = new Map<string, any>();

    // إضافة الحسابات من جدول student_accounts
    (dbAccounts || []).forEach((acc: any) => {
      if (acc.student_code) {
        const student = studentMap.get(acc.student_code);
        accountsMap.set(acc.student_code, {
          student_code: acc.student_code,
          full_name: acc.full_name || student?.full_name || 'طالب مسجل',
          created_at: acc.created_at || null,
          last_login_at: acc.last_login_at || null,
          status: acc.status || 'active'
        });
      }
    });

    // فحص الحسابات المسجلة عبر telegram_browser_id
    (studentsList || []).forEach((st: any) => {
      if (st.student_code && !accountsMap.has(st.student_code) && st.telegram_browser_id && st.telegram_browser_id.trim().length > 2) {
        try {
          const parsed = JSON.parse(st.telegram_browser_id);
          if (parsed && (parsed.is_pin_used || parsed.status === 'active' || parsed.pin_code)) {
            accountsMap.set(st.student_code, {
              student_code: st.student_code,
              full_name: st.full_name,
              created_at: parsed.activated_at || parsed.created_at || null,
              last_login_at: parsed.last_login_at || null,
              status: parsed.status || 'active'
            });
          }
        } catch (e) {}
      }
    });

    // فحص الحسابات المحلية الاحتياطية (localStore)
    const localAccs = localStore.getAllAccounts();
    localAccs.forEach((la: any) => {
      if (la.student_code && !accountsMap.has(la.student_code)) {
        const student = studentMap.get(la.student_code);
        accountsMap.set(la.student_code, {
          student_code: la.student_code,
          full_name: la.full_name || student?.full_name || 'طالب مسجل',
          created_at: la.created_at || la.activated_at || null,
          last_login_at: la.last_login_at || null,
          status: la.status || 'active'
        });
      }
    });

    const registeredStudents = Array.from(accountsMap.values());

    // ترتيب الحسابات بحسب أحدث تسجيل
    registeredStudents.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      count: registeredStudents.length,
      students: registeredStudents
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err: any) {
    console.error('Error fetching registered students:', err);
    return NextResponse.json({
      success: false,
      count: 0,
      students: [],
      error: err.message
    }, { status: 500 });
  }
}
