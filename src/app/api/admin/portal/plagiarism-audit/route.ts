import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { auditArtworkDuplicates } from '@/lib/artDuplicateDetector';
import { localStore } from '@/lib/localFallbackStore';
import { requireCoordinator } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

function normalizeImgUrl(url: string | undefined): string {
  if (!url) return '';
  const u = url.trim();
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image/') || u.startsWith('/')) {
    return u;
  }
  if (/^AgAC[A-Za-z0-9_\-]+$/.test(u)) {
    return `/api/media/${u}`;
  }
  return u;
}

export async function GET(request: Request) {
  const guard = await requireCoordinator(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const thresholdParam = searchParams.get('threshold');
    const threshold = thresholdParam ? Math.max(60, Math.min(100, Number(thresholdParam))) : 80;

    let allSubs: any[] = [];

    // جلب أسماء المقررات لتزيين تقرير التطابق
    let courseMap = new Map<string, string>();
    try {
      const { data: courses } = await supabaseAdmin.from('courses').select('id, name');
      if (courses) {
        courses.forEach((c: any) => courseMap.set(c.id, c.name));
      }
    } catch (e) {}

    // 1. جلب التسليمات من جدول student_submissions
    try {
      const { data } = await supabaseAdmin
        .from('student_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        allSubs = data.map((sub: any) => ({
          ...sub,
          course_name: sub.course_name || courseMap.get(sub.course_id) || 'مقرر دراسي',
          images: Array.isArray(sub.images)
            ? sub.images.map((img: any) => ({
                ...img,
                url: normalizeImgUrl(img.url),
                dhash: (img.dhash || '').replace(/^hash:/i, '').trim(),
              }))
            : [],
        }));
      }
    } catch (e) {}

    // دمج التسليمات المحلية إن وجدت
    const localAll = localStore.getAllSubmissions();
    if (localAll && localAll.length > 0) {
      localAll.forEach((ls: any) => {
        if (!allSubs.some(s => s.id === ls.id)) {
          allSubs.push({
            ...ls,
            course_name: ls.course_name || courseMap.get(ls.course_id) || 'مقرر دراسي',
            images: Array.isArray(ls.images)
              ? ls.images.map((img: any) => ({
                  ...img,
                  url: normalizeImgUrl(img.url),
                  dhash: (img.dhash || '').replace(/^hash:/i, '').trim(),
                }))
              : [],
          });
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
            const dhashClean = (ev.ai_status || '').replace(/^hash:/i, '').trim();
            allSubs.push({
              id: ev.id,
              student_code: code,
              student_name: ev.students?.full_name || 'طالب',
              course_id: ev.course_id,
              course_name: courseMap.get(ev.course_id) || 'مقرر دراسي',
              project_name: ev.project_name || 'مشروع',
              images: [{ url: normalizeImgUrl(ev.photo_url), dhash: dhashClean }],
              created_at: ev.created_at || new Date().toISOString(),
            });
          }
        });
      }
    } catch (e) {}

    // 2. تحليل التطابق عبر محرك الفحص الذكي للتربية الفنية
    const duplicates = auditArtworkDuplicates(allSubs, threshold);

    return NextResponse.json({
      success: true,
      threshold,
      totalSubmissionsScanned: allSubs.length,
      suspiciousMatchesCount: duplicates.length,
      matches: duplicates,
    });
  } catch (err: any) {
    console.error('Plagiarism audit error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
