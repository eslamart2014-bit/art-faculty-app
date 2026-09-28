import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // جلب الحسابات وقائمة الطلاب بالتوازي الفوري (Promise.all)
    const [{ data: dbAccounts }, { data: studentsList }] = await Promise.all([
      supabaseAdmin
        .from('student_accounts')
        .select('student_code, full_name, created_at, last_login_at, status, activated_by, pin_issued_by, activated_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('students')
        .select('student_code, full_name, telegram_browser_id')
    ]);

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
        let telegramAccount: any = null;
        if (student?.telegram_browser_id) {
          try { telegramAccount = JSON.parse(student.telegram_browser_id); } catch (e) {}
        }

        const activatedBy = acc.activated_by || acc.pin_issued_by || telegramAccount?.activated_by || telegramAccount?.pin_issued_by || null;
        const activatedAt = acc.activated_at || acc.pin_issued_at || telegramAccount?.activated_at || telegramAccount?.pin_issued_at || null;
        const isActivated = acc.status === 'active' || telegramAccount?.status === 'active' || telegramAccount?.is_pin_used;
        const status = (acc.status === 'suspended' || telegramAccount?.status === 'suspended')
          ? 'suspended'
          : isActivated
            ? 'active'
            : (acc.status || telegramAccount?.status || 'pending');

        const createdAt = acc.created_at || telegramAccount?.created_at || telegramAccount?.activated_at || acc.last_login_at || null;

        accountsMap.set(acc.student_code, {
          student_code: acc.student_code,
          full_name: acc.full_name || student?.full_name || 'طالب مسجل',
          created_at: createdAt,
          last_login_at: acc.last_login_at || telegramAccount?.last_login_at || null,
          status: status,
          activated_by: activatedBy,
          activated_at: activatedAt
        });
      }
    });

    // فحص الحسابات المسجلة عبر telegram_browser_id
    (studentsList || []).forEach((st: any) => {
      if (st.student_code && st.telegram_browser_id && st.telegram_browser_id.trim().length > 2) {
        try {
          const parsed = JSON.parse(st.telegram_browser_id);
          if (parsed && (parsed.is_pin_used || parsed.status || parsed.pin_code || parsed.mobile || parsed.id_card_url)) {
            const existing = accountsMap.get(st.student_code);
            if (existing) {
              if (!existing.activated_by && (parsed.activated_by || parsed.pin_issued_by)) {
                existing.activated_by = parsed.activated_by || parsed.pin_issued_by;
              }
              if (!existing.activated_at && (parsed.activated_at || parsed.pin_issued_at)) {
                existing.activated_at = parsed.activated_at || parsed.pin_issued_at;
              }
              if (parsed.status === 'active' || parsed.is_pin_used) {
                if (existing.status !== 'suspended') existing.status = 'active';
              }
              if (!existing.created_at && (parsed.created_at || parsed.activated_at)) {
                existing.created_at = parsed.created_at || parsed.activated_at;
              }
            } else {
              const isAct = parsed.status === 'active' || parsed.is_pin_used;
              accountsMap.set(st.student_code, {
                student_code: st.student_code,
                full_name: st.full_name,
                created_at: parsed.created_at || parsed.activated_at || parsed.last_login_at || null,
                last_login_at: parsed.last_login_at || null,
                status: parsed.status === 'suspended' ? 'suspended' : isAct ? 'active' : (parsed.status || 'pending'),
                activated_by: parsed.activated_by || parsed.pin_issued_by || null,
                activated_at: parsed.activated_at || parsed.pin_issued_at || null
              });
            }
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
          status: la.status || 'active',
          activated_by: la.activated_by || la.pin_issued_by || null,
          activated_at: la.activated_at || null
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
