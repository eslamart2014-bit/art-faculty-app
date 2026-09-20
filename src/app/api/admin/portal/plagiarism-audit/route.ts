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

    // 2. دمج كافة الصور المسجلة في جدول evaluations عبر قاعدة البيانات بالكامل
    try {
      const { data: legacyEvals } = await supabaseAdmin
        .from('evaluations')
        .select('id, course_id, project_name, photo_url, ai_status, created_at, students(full_name, student_code, academic_year)')
        .not('photo_url', 'is', null);

      if (legacyEvals && legacyEvals.length > 0) {
        legacyEvals.forEach((ev: any) => {
          const code = ev.students?.student_code;
          if (code && !allSubs.some(s => s.student_code === code && s.project_name === ev.project_name)) {
            allSubs.push({
              id: ev.id,
              student_code: code,
              student_name: ev.students?.full_name || 'طالب',
              course_id: ev.course_id,
              course_name: 'مقرر دراسي',
              project_name: ev.project_name || 'مشروع',
              images: [{ url: ev.photo_url, dhash: ev.ai_status || '' }],
              created_at: ev.created_at || new Date().toISOString(),
            });
          }
        });
      }
    } catch (e) {}

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
