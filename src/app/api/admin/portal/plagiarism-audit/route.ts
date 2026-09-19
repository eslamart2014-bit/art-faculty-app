import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { auditArtworkDuplicates } from '@/lib/artDuplicateDetector';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let allSubs: any[] = [];

    // 1. جلب التسليمات من جدول student_submissions
    try {
      const { data } = await supabaseAdmin
        .from('student_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) allSubs = data;
    } catch (e) {}

    // دمج التسليمات المحلية إن وجدت
    const localAll = localStore.getAllSubmissions();
    if (localAll && localAll.length > 0) {
      localAll.forEach((ls: any) => {
        if (!allSubs.some(s => s.id === ls.id)) {
          allSubs.push(ls);
        }
      });
    }

    // 2. تحليل التطابق عبر محرك الفحص الذكي للتربية الفنية
    const duplicates = auditArtworkDuplicates(allSubs);

    return NextResponse.json({
      success: true,
      totalSubmissionsScanned: allSubs.length,
      suspiciousMatchesCount: duplicates.length,
      matches: duplicates,
    });
  } catch (err: any) {
    console.error('Plagiarism audit error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
