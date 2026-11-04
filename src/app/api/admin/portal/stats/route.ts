import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';
import { localStore } from '@/lib/students/localFallbackStore';
import { requireCoordinator } from '@/lib/auth/serverAuth';
import { formatStudentCode } from '@/lib/students/codeHelper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const host = request.headers.get('host') || '';
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (!isLocal) {
    const guard = await requireCoordinator(request);
    if (!guard.ok) return guard.response;
  }

  try {
    const [
      { count: totalStudents },
      { data: dbAccounts },
      { data: studentsRows },
      { count: totalSubs }
    ] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('student_accounts').select('student_code, status'),
      supabaseAdmin.from('students').select('student_code, telegram_id, is_active, telegram_browser_id').eq('is_active', true),
      supabaseAdmin.from('student_submissions').select('id', { count: 'exact', head: true })
    ]);

    const registeredCodes = new Set<string>();
    const botCodes = new Set<string>();
    const suspendedCodes = new Set<string>();

    (dbAccounts || []).forEach((acc: any) => {
      if (acc.student_code) {
        const clean = formatStudentCode(acc.student_code);
        registeredCodes.add(clean);
        if (acc.status === 'suspended') {
          suspendedCodes.add(clean);
        }
      }
    });

    (studentsRows || []).forEach((st: any) => {
      if (!st.student_code) return;
      const clean = formatStudentCode(st.student_code);

      if (st.telegram_id) {
        botCodes.add(clean);
        registeredCodes.add(clean);
      }

      if (st.telegram_browser_id && st.telegram_browser_id.trim().length > 2) {
        try {
          const parsed = JSON.parse(st.telegram_browser_id || '{}');
          if (parsed?.telegram_id) {
            botCodes.add(clean);
            registeredCodes.add(clean);
          }
          if (parsed?.status === 'suspended') {
            suspendedCodes.add(clean);
          }
        } catch (e) {}
      }
    });

    return NextResponse.json({
      success: true,
      totalStudents: totalStudents || 0,
      registeredAccounts: botCodes.size || registeredCodes.size,
      botRegisteredCount: botCodes.size,
      suspendedCount: suspendedCodes.size,
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
      botRegisteredCount: 0,
      suspendedCount: 0,
      submissionsCount: 0,
      error: err.message,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }
}
