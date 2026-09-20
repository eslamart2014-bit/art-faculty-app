import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

function normalizeArabic(str: string = ''): string {
  return str
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatInstructorTitle(profile: any): string {
  if (!profile) return 'أستاذ / معيد المقرر';
  const name = (profile.full_name || '').trim();
  const degree = (profile.degree || '').trim();
  const role = (profile.role || '').trim();

  let prefix = '';
  if (name.startsWith('د.') || name.startsWith('د/') || name.startsWith('أ.د') || name.startsWith('م.') || name.startsWith('م/')) {
    prefix = '';
  } else if (degree.includes('دكتور') || degree.includes('أستاذ') || role.includes('مدرس') || role.includes('دكتور')) {
    prefix = 'د. ';
  } else if (role.includes('معيد') || degree.includes('معيد')) {
    prefix = 'م. ';
  } else if (role.includes('مساعد') || degree.includes('مساعد')) {
    prefix = 'م.م. ';
  }

  const degLabel = degree || (role.includes('معيد') ? 'معيد' : (role.includes('مدرس') ? 'مدرس' : 'مدرس المقرر'));
  return `${prefix}${name} (${degLabel})`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim();
  const pin = (searchParams.get('pin') || '').trim();
  const isImpersonate = searchParams.get('impersonate') === 'true';

  if (!code) {
    return NextResponse.json({ error: 'Missing student code' }, { status: 400 });
  }

  const cleanCode = formatStudentCode(code);

  try {
    // 1. جلب بيانات الطالب
    const { data: student, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section, telegram_browser_id')
      .or(`student_code.eq.${code},student_code.eq.${cleanCode}`)
      .maybeSingle();

    if (stErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // التحقق الأمني: التحقق من الرقم السري إذا كان الحساب مفعلاً
    let accountData: any = null;
    if (student.telegram_browser_id) {
      try {
        accountData = JSON.parse(student.telegram_browser_id);
      } catch (e) {}
    }

    const expectedPin = accountData?.pin_code;
    const isActivated = accountData?.is_pin_used || accountData?.status === 'active';

    if (!isImpersonate && isActivated && expectedPin) {
      if (!pin || pin !== expectedPin) {
        return NextResponse.json(
          { error: 'غير مصرح: يجب تسجيل الدخول بالرقم السري للوصول إلى لوحة بيانات الطالب.' },
          { status: 401 }
        );
      }
    }

    // كائن طالب آمن ومجرد من أي بيانات حساسة
    const safeStudent = {
      id: student.id,
      full_name: student.full_name,
      student_code: student.student_code,
      academic_year: student.academic_year,
      section: student.section,
    };

    // 2. جلب سجلات الحضور
    const { data: attendanceRecords } = await supabaseAdmin
      .from('attendance')
      .select('id, course_id, date, status')
      .eq('student_id', student.id)
      .order('date', { ascending: false });

    // 3. جلب التقييمات والأعمال المسجلة من الأساتذة بكامل تفاصيلها بما فيها صور الأعمال (photo_url)
    const { data: teacherEvals } = await supabaseAdmin
      .from('evaluations')
      .select('id, course_id, project_name, score, photo_url, created_at')
      .eq('student_id', student.id);

    // 4. جلب أعمال ومشاريع الطالب المرفوعة عبر البوابة
    let studentSubmissions: any[] = [];
    const { data: subData } = await supabaseAdmin
      .from('student_submissions')
      .select('*')
      .or(`student_code.eq.${student.student_code},student_code.eq.${cleanCode}`);
    if (subData) studentSubmissions = subData;

    // دمج التسليمات المحلية إن وجدت
    try {
      const localSubs = localStore.getSubmissions(student.student_code);
      if (localSubs && localSubs.length > 0) {
        localSubs.forEach((ls: any) => {
          if (!studentSubmissions.some((s) => s.id === ls.id)) {
            studentSubmissions.push(ls);
          }
        });
      }
    } catch (e) {}

    // دمج أعمال الطالب المقيدة في evaluations بصور (photo_url) مع submissions ليراها الطالب فورياً في البوابة
    if (teacherEvals && teacherEvals.length > 0) {
      teacherEvals.forEach((ev: any) => {
        if (ev.photo_url) {
          const exists = studentSubmissions.some(
            (s: any) => s.course_id === ev.course_id && (s.project_name || '').trim() === (ev.project_name || '').trim()
          );
          if (!exists) {
            const hasGradedScore = ev.score !== null && ev.score !== undefined;
            studentSubmissions.push({
              id: ev.id,
              student_code: student.student_code,
              student_name: student.full_name,
              course_id: ev.course_id,
              project_name: ev.project_name,
              images: [{ url: ev.photo_url }],
              status: hasGradedScore ? 'evaluated' : 'pending_evaluation',
              score: ev.score,
              created_at: ev.created_at || new Date().toISOString(),
            });
          }
        }
      });
    }

    // 5. جلب المقررات مع المعيدين والأساتذة
    const { data: allCourses } = await supabaseAdmin
      .from('courses')
      .select('id, name, academic_year, sections, course_type, custom_week_names, teacher_id');

    // جلب ملفات الأساتذة والمعيدين للحصول على درجاتهم الأكاديمية الدقيقة
    const teacherIds = Array.from(new Set((allCourses || []).map((c: any) => c.teacher_id).filter(Boolean)));
    let teacherProfilesMap: Record<string, any> = {};
    if (teacherIds.length > 0) {
      const { data: tProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role, degree')
        .in('id', teacherIds);
      (tProfiles || []).forEach((tp: any) => {
        teacherProfilesMap[tp.id] = tp;
      });
    }

    const normStudentYear = normalizeArabic(student.academic_year || '');
    const normStudentSec = normalizeArabic(student.section || '');

    const matchedCourses = (allCourses || []).filter((c: any) => {
      const hasAtt = (attendanceRecords || []).some((r: any) => r.course_id === c.id);
      const hasEval = (teacherEvals || []).some((e: any) => e.course_id === c.id);
      const hasSub = studentSubmissions.some((s: any) => s.course_id === c.id);
      if (hasAtt || hasEval || hasSub) return true;

      const normCourseYear = normalizeArabic(c.academic_year || '');
      const yearMatch =
        normCourseYear.includes(normStudentYear) ||
        normStudentYear.includes(normCourseYear);
      if (!yearMatch) return false;

      if (c.course_type === 'lectures' || !c.sections || c.sections.length === 0) return true;
      const secMatch = (c.sections || []).some((sec: string) => {
        const normSec = normalizeArabic(sec);
        return (
          normSec === 'عام' ||
          normSec === normStudentSec ||
          normSec.includes(normStudentSec) ||
          normStudentSec.includes(normSec)
        );
      });
      return secMatch;
    });

    // 6. تجميع الحضور لكل مقرر
    const attendanceByCourse = matchedCourses.map((course: any) => {
      const records = (attendanceRecords || []).filter((r: any) => r.course_id === course.id);
      const attended = records.filter((r: any) => r.status === 'حاضر').length;
      const absent = records.filter((r: any) => r.status === 'غائب').length;
      const excused = records.filter((r: any) => r.status === 'إذن' || r.status === 'عذر').length;
      const total = records.length;
      const rate = total > 0 ? Math.round((attended / total) * 100) : 100;
      const hasWarning = absent >= 3;

      return {
        courseId: course.id,
        courseName: course.name,
        totalLectures: total,
        attended,
        absent,
        excused,
        rate,
        hasWarning,
        records: records.map((r: any) => ({ date: r.date, status: r.status })),
      };
    });

    // 7. دمج المقررات بالمشاريع المعتمدة والمعيدين والمدرسين
    const projectsByCourse = matchedCourses.map((course: any) => {
      const evals = (teacherEvals || []).filter((e: any) => e.course_id === course.id);
      const subs = studentSubmissions.filter((s: any) => s.course_id === course.id);

      const prof = teacherProfilesMap[course.teacher_id];
      const instructorName = prof?.full_name || 'عضو هيئة التدريس';
      const instructorDegree = prof?.degree || prof?.role || 'مدرس المقرر';
      const instructorTitle = formatInstructorTitle(prof);

      // استخراج المشاريع المعتمدة التي حددها الأستاذ في custom_week_names.__projects__
      const rawAssigned = course.custom_week_names?.__projects__ || [];
      const assignedProjects = rawAssigned
        .filter((p: any) => !p.is_archived)
        .map((proj: any) => {
          const pTitle = (proj.title || proj.name || 'مشروع فني').trim();
          const pScore = proj.max_score || proj.maxScore || 10;
          const cameraMode = proj.camera_mode || '2d';
          const requiredPhotos = proj.required_photos || (cameraMode === '3d' ? 2 : 1);

          const sub = subs.find((s: any) => (s.project_name || '').trim() === pTitle);
          const ev = evals.find((e: any) => (e.project_name || '').trim() === pTitle);

          const isGraded = ev && ev.score !== null && ev.score !== undefined;
          const isSubmitted = !!sub || (ev && !!ev.photo_url);

          return {
            id: proj.id || pTitle,
            title: pTitle,
            maxScore: pScore,
            cameraMode,
            requiredPhotos,
            submission: sub || (ev?.photo_url ? { id: ev.id, images: [{ url: ev.photo_url }], project_name: pTitle, status: isGraded ? 'evaluated' : 'submitted' } : null),
            evaluation: ev || null,
            status: isGraded ? 'evaluated' : (isSubmitted ? 'submitted' : 'pending'),
          };
        });

      return {
        courseId: course.id,
        courseName: course.name,
        instructorName,
        instructorDegree,
        instructorTitle,
        evaluations: evals,
        submissions: subs,
        assignedProjects,
      };
    });

    // 8. جلب الشكاوى الخاصة بالطالب
    const { data: complaints } = await supabaseAdmin
      .from('student_complaints')
      .select('*')
      .eq('student_code', student.student_code)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      student: safeStudent,
      attendance: attendanceByCourse,
      projects: projectsByCourse,
      complaints: complaints || [],
      warnings: attendanceByCourse.filter((c: any) => c.hasWarning),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (err: any) {
    console.error('Dashboard data error:', err);
    return NextResponse.json({ error: err.message }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  }
}
