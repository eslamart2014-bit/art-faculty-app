import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instructorId = searchParams.get('instructor_id');
  const courseId = searchParams.get('course_id');
  const projectName = searchParams.get('project_name');
  const searchQuery = (searchParams.get('q') || '').trim();
  const includeGraduates = searchParams.get('include_graduates') === 'true';

  try {
    // 1. استرجاع قائمة الأساتذة والمعيدين (إذا لم يُحدد معيد أو لطلب القائمة)
    const { data: instructors, error: instErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, email, degree')
      .order('full_name', { ascending: true });

    if (instErr) {
      console.error('Error fetching instructors:', instErr);
    }

    // إذا لم يتم تحديد مدرس/معيد، نكتفي بإرجاع قائمة المدرسين لاختيار الحساب
    if (!instructorId) {
      return NextResponse.json({
        instructors: instructors || [],
        courses: [],
        submissions: []
      });
    }

    // 2. التحقق من هوية المعيد واسترجاع مقرراته الخاصة فقط (كل معيد ومقرراته فقط)
    const { data: allCourses, error: cErr } = await supabaseAdmin
      .from('courses')
      .select('*')
      .order('name', { ascending: true });

    if (cErr) {
      console.error('Error fetching courses:', cErr);
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const currentInstructor = (instructors || []).find((i: any) => i.id === instructorId);
    const isAdmin = currentInstructor?.role === 'مدير';

    // فلترة المقررات الخاصة بهذا المعيد فقط (المالك أو المشارك معه)، بينما المدير تتاح له كافة المقررات
    // مع استبعاد المقررات المحذوفة أو المؤرشفة تماماً
    const myCourses = (allCourses || [])
      .filter((c: any) => {
        // استبعاد أي مقرر تم نقله للأرشيف أو حذفه
        if (c.custom_week_names?.__archived === true) return false;
        if (Array.isArray(c.custom_week_names?.__hidden_for) && c.custom_week_names.__hidden_for.includes(instructorId)) return false;

        if (isAdmin) return true;
        const isOwner = c.teacher_id === instructorId;
        const isShared = Array.isArray(c.shared_with) && c.shared_with.includes(instructorId);
        return isOwner || isShared;
      })
      .map((c: any) => {
        // تصفية المشاريع داخل المقرر لاستبعاد المشاريع المؤرشفة أو المحذوفة
        const activeProjects = (c.custom_week_names?.__projects__ || []).filter(
          (p: any) => !p.is_archived && p.is_active !== false
        );
        return {
          ...c,
          custom_week_names: {
            ...(c.custom_week_names || {}),
            __projects__: activeProjects
          }
        };
      });

    const myCourseIds = myCourses.map((c: any) => c.id);
    const myAcademicYears = Array.from(new Set(myCourses.map((c: any) => c.academic_year).filter(Boolean)));

    // قائمة المفاتيح للمشاريع النشطة وغير المؤرشفة
    const activeProjectMap = new Set<string>();
    myCourses.forEach((c: any) => {
      (c.custom_week_names?.__projects__ || []).forEach((p: any) => {
        const pName = (p.name || p.title || '').trim();
        if (pName) {
          activeProjectMap.add(`${c.id}:::${pName}`);
        }
      });
    });

    // 3. حالة البحث الذكي عن طالب (مقتصرة حصراً على الفرق والمقررات المسندة للمعيد، أو عامة للمدير)
    if (searchQuery) {
      let stQuery = supabaseAdmin
        .from('students')
        .select('id, full_name, student_code, academic_year, section');

      if (!includeGraduates) {
        stQuery = stQuery.eq('is_active', true);
      }

      // حصر البحث في الفرق الدراسية المسندة للمعيد ما لم يكن مديراً
      if (!isAdmin && myAcademicYears.length > 0) {
        stQuery = stQuery.in('academic_year', myAcademicYears);
      }

      if (/^\d+$/.test(searchQuery)) {
        stQuery = stQuery.ilike('student_code', `%${searchQuery}%`);
      } else {
        stQuery = stQuery.ilike('full_name', `%${searchQuery}%`);
      }

      const { data: foundStudents } = await stQuery.limit(15);
      const studentResults: any[] = [];

      if (foundStudents && foundStudents.length > 0) {
        for (const st of foundStudents) {
          // جلب صورة بطاقة الهوية وحالة الحساب
          let accountInfo: any = null;
          try {
            const { data: acc } = await supabaseAdmin
              .from('student_accounts')
              .select('id_card_url, status, mobile')
              .eq('student_code', st.student_code)
              .maybeSingle();
            accountInfo = acc;
          } catch (e) {}

          if (!accountInfo) {
            accountInfo = localStore.getAccount(st.student_code);
          }

          // جلب أعمال الطالب في مقررات هذا المعيد فقط
          let studentSubs: any[] = [];
          try {
            const { data: subs } = await supabaseAdmin
              .from('student_submissions')
              .select('*')
              .eq('student_code', st.student_code)
              .in('course_id', myCourseIds);
            studentSubs = subs || [];
          } catch (e) {}

          const localSubs = localStore.getSubmissions(st.student_code)
            .filter((s: any) => myCourseIds.includes(s.course_id));

          // دمج التسليمات وتصفيتها حصرياً للمشاريع والمقررات النشطة غير المحذوفة
          const allStudentSubs = [...studentSubs];
          localSubs.forEach(ls => {
            if (!allStudentSubs.some(s => s.course_id === ls.course_id && s.project_name === ls.project_name)) {
              allStudentSubs.push(ls);
            }
          });

          const validStudentSubs = allStudentSubs.filter((s: any) => {
            const pName = (s.project_name || '').trim();
            return activeProjectMap.has(`${s.course_id}:::${pName}`);
          });

          // أيضاً فحص جدول evaluations لمقررات هذا المعيد وتصفيتها للمشاريع النشطة
          let evalRecords: any[] = [];
          try {
            const { data: evals } = await supabaseAdmin
              .from('evaluations')
              .select('*')
              .eq('student_id', st.id)
              .in('course_id', myCourseIds);
            evalRecords = evals || [];
          } catch (e) {}

          const validEvalRecords = (evalRecords || []).filter((e: any) => {
            const pName = (e.project_name || '').trim();
            return activeProjectMap.has(`${e.course_id}:::${pName}`);
          });

          studentResults.push({
            student: st,
            account: accountInfo,
            submissions: validStudentSubs,
            evaluations: validEvalRecords,
          });
        }
      }

      return NextResponse.json({
        instructors: instructors || [],
        courses: myCourses,
        searchResults: studentResults,
      });
    }

    // 4. استرجاع أعمال مشروع محدد داخل مقرر المعيد
    let submissions: any[] = [];

    if (courseId && projectName) {
      const cleanProjectName = projectName.trim();
      const reqKey = `${courseId}:::${cleanProjectName}`;

      // تحقق أمني صارم: هل المقرر يخص هذا المعيد ونشط، وهل المشروع نشط وغير مؤرشف؟
      if (!myCourseIds.includes(courseId) || !activeProjectMap.has(reqKey)) {
        return NextResponse.json({
          instructors: instructors || [],
          courses: myCourses,
          submissions: []
        });
      }

      // جلب الأعمال من student_submissions
      try {
        const { data: subs } = await supabaseAdmin
          .from('student_submissions')
          .select('*')
          .eq('course_id', courseId)
          .eq('project_name', projectName)
          .order('created_at', { ascending: false });
        submissions = subs || [];
      } catch (e) {}

      // جلب من التخزين المحلي كـ Fallback
      const localSubs = localStore.getAllSubmissions()
        .filter((s: any) => s.course_id === courseId && s.project_name === projectName);

      localSubs.forEach(ls => {
        if (!submissions.some(s => s.student_code === ls.student_code)) {
          submissions.push(ls);
        }
      });

      // جلب صور الأعمال المسجلة في جدول evaluations لنفس المقرر والمشروع
      try {
        const { data: legacyEvals } = await supabaseAdmin
          .from('evaluations')
          .select('*, students(full_name, student_code, section, academic_year)')
          .eq('course_id', courseId)
          .eq('project_name', projectName)
          .not('photo_url', 'is', null);

        if (legacyEvals && legacyEvals.length > 0) {
          legacyEvals.forEach((ev: any) => {
            const code = ev.students?.student_code;
            if (code && !submissions.some(s => s.student_code === code)) {
              submissions.push({
                id: ev.id,
                student_code: code,
                student_name: ev.students?.full_name || 'طالب',
                section: ev.students?.section || '1',
                academic_year: ev.students?.academic_year || '',
                course_id: courseId,
                project_name: projectName,
                images: [{ url: ev.photo_url, dhash: ev.ai_status || '' }],
                status: ev.score !== null ? 'graded' : 'pending_evaluation',
                score: ev.score,
                created_at: ev.created_at,
              });
            }
          });
        }
      } catch (e) {}
    }

    // عزل صور وأعمال الخريجين واستبعادهم من العرض ما لم يتم طلبهم صراحة
    if (!includeGraduates && submissions.length > 0) {
      const studentCodes = Array.from(new Set(submissions.map(s => s.student_code)));
      const { data: activeStudents } = await supabaseAdmin
        .from('students')
        .select('student_code')
        .in('student_code', studentCodes)
        .eq('is_active', true);
      const activeCodeSet = new Set((activeStudents || []).map(s => s.student_code));
      submissions = submissions.filter(s => activeCodeSet.has(s.student_code));
    }

    return NextResponse.json({
      instructors: instructors || [],
      courses: myCourses,
      submissions,
    });
  } catch (err: any) {
    console.error('Instructor API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
