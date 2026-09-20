import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Total students in college roster
    const { count: totalStudents, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id', { count: 'exact', head: true });

    // 2. Accounts in student_accounts table
    const { data: dbAccounts } = await supabaseAdmin
      .from('student_accounts')
      .select('student_code, id_card_verified, status');

    // 3. Accounts in students table with telegram_browser_id
    const { data: studentsWithBrowserId } = await supabaseAdmin
      .from('students')
      .select('student_code, telegram_browser_id')
      .not('telegram_browser_id', 'is', null);

    // 4. Submissions count
    const { count: totalSubs } = await supabaseAdmin
      .from('student_submissions')
      .select('id', { count: 'exact', head: true });

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
