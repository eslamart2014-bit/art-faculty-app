import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // تنفيذ كافة استعلامات الإحصائيات بالتوازي الفوري (Promise.all)
    const [
      { count: totalStudents },
      { data: dbAccounts },
      { data: studentsWithBrowserId },
      { count: totalSubs }
    ] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('student_accounts').select('student_code, id_card_verified, status'),
      supabaseAdmin.from('students').select('student_code, telegram_browser_id').not('telegram_browser_id', 'is', null),
      supabaseAdmin.from('student_submissions').select('id', { count: 'exact', head: true })
    ]);

    // Consolidate unique registered student codes
    const registeredCodes = new Set<string>();
    let verifiedCardsCount = 0;

    (dbAccounts || []).forEach((acc: any) => {
      if (acc.student_code) {
        registeredCodes.add(acc.student_code);
        if (acc.id_card_verified) verifiedCardsCount++;
      }
    });

    (studentsWithBrowserId || []).forEach((st: any) => {
      if (st.student_code && st.telegram_browser_id && st.telegram_browser_id.trim().length > 2) {
        try {
          const parsed = JSON.parse(st.telegram_browser_id || '{}');
          if (parsed && (parsed.student_code || parsed.mobile || parsed.pin_code || parsed.status)) {
            if (!registeredCodes.has(st.student_code)) {
              registeredCodes.add(st.student_code);
              if (parsed.id_card_verified) verifiedCardsCount++;
            }
          }
        } catch (e) {}
      }
    });

    // LocalStore fallback
    const localAccs = localStore.getAllAccounts();
    localAccs.forEach((la: any) => {
      if (la.student_code && !registeredCodes.has(la.student_code)) {
        registeredCodes.add(la.student_code);
        if (la.id_card_verified) verifiedCardsCount++;
      }
    });

    return NextResponse.json({
      success: true,
      totalStudents: totalStudents || 0,
      registeredAccounts: registeredCodes.size,
      verifiedCards: verifiedCardsCount,
      submissionsCount: totalSubs || 0,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err: any) {
    console.error('Portal stats error:', err);
    return NextResponse.json({
      success: false,
      totalStudents: 0,
      registeredAccounts: 0,
      verifiedCards: 0,
      submissionsCount: 0,
      error: err.message,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }
}
