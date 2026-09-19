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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim();
  const pin = (searchParams.get('pin') || '').trim();

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

    if (isActivated && expectedPin) {
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

    // 2. جلب سجلات الحضور أولاً
    const { data: attendanceRecords } = await supabaseAdmin
      .from('attendance')
      .select('id, course_id, date, status')
      .eq('student_id', student.id)
      .order('date', { ascending: false });

    // 3. جلب التقييمات المسجلة من الأساتذة
    const { data: teacherEvals } = await supabaseAdmin
      .from('evaluations')
      .select('course_id, project_name, score')
      .eq('student_id', student.id);

    // 4. جلب أعمال ومشاريع الطالب المرفوعة
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

    // 5. جلب المقررات التابعة لفرقة وسكشن الطالب مع المشاريع المعتمدة (custom_week_names)
    const { data: allCourses } = await supabaseAdmin
      .from('courses')
      .select('id, name, academic_year, sections, course_type, custom_week_names');

    const normStudentYear = normalizeArabic(student.academic_year || '');
    const normStudentSec = normalizeArabic(student.section || '');

    const matchedCourses = (allCourses || []).filter((c: any) => {
      // إذا كان للطالب أي سجل حضور أو تقييم أو تسليم في هذا المقرر، أدرجه فورياً
      const hasAtt = (attendanceRecords || []).some((r: any) => r.course_id === c.id);
      const hasEval = (teacherEvals || []).some((e: any) => e.course_id === c.id);
      const hasSub = studentSubmissions.some((s: any) => s.course_id === c.id);
      if (hasAtt || hasEval || hasSub) return true;

      // مطابقة الفرقة الأكاديمية مع تطبيع الحروف العربية
      const normCourseYear = normalizeArabic(c.academic_year || '');
      const yearMatch =
        normCourseYear.includes(normStudentYear) ||
        normStudentYear.includes(normCourseYear);
      if (!yearMatch) return false;

      // مطابقة السكشن
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

    // 7. دمج المقررات بالمشاريع المعتمدة والمرفوعة والتقييمات
    const projectsByCourse = matchedCourses.map((course: any) => {
      const evals = (teacherEvals || []).filter((e: any) => e.course_id === course.id);
      const subs = studentSubmissions.filter((s: any) => s.course_id === course.id);

      // استخراج المشاريع المعتمدة التي حددها الأستاذ في custom_week_names.__projects__
      const rawAssigned = course.custom_week_names?.__projects__ || [];
      const assignedProjects = rawAssigned.map((proj: any) => {
        const pTitle = proj.title || proj.name || 'مشروع';
        const pScore = proj.max_score || proj.maxScore || 10;
        const sub = subs.find((s: any) => s.project_name === pTitle);
        const ev = evals.find((e: any) => e.project_name === pTitle);

        return {
          id: proj.id || pTitle,
          title: pTitle,
          maxScore: pScore,
          submission: sub || null,
          evaluation: ev || null,
          status: ev ? 'evaluated' : (sub ? 'submitted' : 'pending'),
        };
      });

      return {
        courseId: course.id,
        courseName: course.name,
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
    });
  } catch (err: any) {
    console.error('Dashboard data error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
