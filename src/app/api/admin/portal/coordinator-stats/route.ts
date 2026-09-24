import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // جلب الحسابات وسجلات الاعتماد بالتوازي الفوري (Promise.all)
    const [{ data: dbAccounts }, { data: studentsWithBrowserId }] = await Promise.all([
      supabaseAdmin
        .from('student_accounts')
        .select('student_code, activated_by, pin_issued_by, status, is_pin_used'),
      supabaseAdmin
        .from('students')
        .select('student_code, telegram_browser_id')
        .not('telegram_browser_id', 'is', null)
    ]);

    const coordinatorCounts: Record<string, number> = {};
    let totalActivated = 0;

    const countCoordinator = (coordName?: string) => {
      const name = (coordName && coordName.trim()) ? coordName.trim() : 'منسق النظام (غير محدد)';
      coordinatorCounts[name] = (coordinatorCounts[name] || 0) + 1;
      totalActivated++;
    };

    const processedCodes = new Set<string>();

    (dbAccounts || []).forEach((acc: any) => {
      if (acc.student_code) {
        processedCodes.add(acc.student_code);
        if (acc.status === 'active' || acc.is_pin_used) {
          countCoordinator(acc.activated_by || acc.pin_issued_by);
        }
      }
    });

    (studentsWithBrowserId || []).forEach((st: any) => {
      if (st.student_code && !processedCodes.has(st.student_code) && st.telegram_browser_id) {
        try {
          const parsed = JSON.parse(st.telegram_browser_id);
          if (parsed && (parsed.status === 'active' || parsed.is_pin_used)) {
            processedCodes.add(st.student_code);
            countCoordinator(parsed.activated_by || parsed.pin_issued_by);
          }
        } catch (e) {}
      }
    });

    // تحويل الكائن إلى مصفوفة مرتبة تنازلياً بالأعلى نشاطاً
    const statsList = Object.entries(coordinatorCounts)
      .map(([name, count]) => ({
        coordinator_name: name,
        count,
        percentage: totalActivated > 0 ? Math.round((count / totalActivated) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      totalActivated,
      coordinators: statsList
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err: any) {
    console.error('Error fetching coordinator stats:', err);
    return NextResponse.json({
      success: false,
      totalActivated: 0,
      coordinators: [],
      error: err.message
    }, { status: 500 });
  }
}
