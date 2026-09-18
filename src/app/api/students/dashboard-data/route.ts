import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';

export const dynamic = 'force-dynamic';

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

    // 2. جلب المقررات التابعة لفرقة وسكشن الطالب
    const { data: allCourses } = await supabaseAdmin
      .from('courses')
      .select('id, name, academic_year, sections, course_type');

    const matchedCourses = (allCourses || []).filter((c: any) => {
      const yearMatch = c.academic_year?.includes(student.academic_year) ||
                        student.academic_year?.includes(c.academic_year);
      if (!yearMatch) return false;
      if (c.course_type === 'lectures' || !c.sections || c.sections.length === 0) return true;
      return c.sections.includes(student.section) || c.sections.includes('عام');
    });

    // 3. جلب سجلات الحضور
    const { data: attendanceRecords } = await supabaseAdmin
      .from('attendance')
      .select('id, course_id, date, status')
      .eq('student_id', student.id)
      .order('date', { ascending: false });

    // تجميع الحضور لكل مقرر
    const attendanceByCourse = matchedCourses.map((course: any) => {
      const records = (attendanceRecords || []).filter((r: any) => r.course_id === course.id);
      const attended = records.filter((r: any) => r.status === 'حاضر').length;
      const absent = records.filter((r: any) => r.status === 'غائب').length;
      const excused = records.filter((r: any) => r.status === 'إذن' || r.status === 'عذر').length;
      const total = records.length;
      const rate = total > 0 ? Math.round((attended / total) * 100) : 100;

      // هل يستحق إنذار غياب؟ (3 غيابات أو أكثر)
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

    // 4. جلب التقييمات المسجلة من الأستاذ
    const { data: teacherEvals } = await supabaseAdmin
      .from('evaluations')
      .select('course_id, project_name, score')
      .eq('student_id', student.id);

    // 5. جلب أعمال ومشاريع الطالب المرفوعة
    const { data: studentSubmissions } = await supabaseAdmin
      .from('student_submissions')
      .select('*')
      .eq('student_code', student.student_code);

    // دمج المقررات بالمشاريع المتاحة والمرفوعة
    const projectsByCourse = matchedCourses.map((course: any) => {
      const evals = (teacherEvals || []).filter((e: any) => e.course_id === course.id);
      const subs = (studentSubmissions || []).filter((s: any) => s.course_id === course.id);

      return {
        courseId: course.id,
        courseName: course.name,
        evaluations: evals,
        submissions: subs,
      };
    });

    // 6. جلب الشكاوى الخاصة بالطالب
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
