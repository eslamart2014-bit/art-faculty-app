import { supabase } from "@/lib/supabase";
import { getLocalCache, setLocalCache } from "@/lib/syncEngine";

// Background worker that downloads courses, students, and settings locally
// so that the entire app operates at 0ms with zero loading screens
export async function preloadFacultyData(userId: string) {
  if (typeof window === "undefined" || !navigator.onLine || !userId) return;

  try {
    // 1. Preload system settings in background
    supabase
      .from("system_settings")
      .select("term1_start, term2_start, term1_end, term2_end, telegram_config")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLocalCache("cached_system_settings", data);
      });

    // 2. Preload teacher profiles map in background
    supabase
      .from("profiles")
      .select("id, full_name, degree")
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p) => { map[p.id] = p.full_name; });
          setLocalCache("cached_profiles_map", map);
        }
      });

    // 3. Preload all active & shared courses for this user
    const { data: courses } = await supabase
      .from("courses")
      .select("*")
      .or(`teacher_id.eq.${userId},shared_with.cs.{${userId}}`)
      .order("created_at", { ascending: false });

    if (!courses || courses.length === 0) return;

    const activeCourses = courses.filter((c) =>
      !c.custom_week_names?.__archived &&
      !(c.custom_week_names?.__hidden_for || []).includes(userId)
    );

    setLocalCache(`cached_courses_${userId}`, activeCourses);

    // 4. Preload students for each unique academic year present in courses
    const academicYears = Array.from(
      new Set(activeCourses.map((c) => c.academic_year).filter(Boolean))
    );

    for (const year of academicYears) {
      const { data: students } = await supabase
        .from("students")
        .select("id, full_name, student_code, academic_year, section")
        .eq("academic_year", year)
        .eq("is_active", true);

      if (students && students.length > 0) {
        setLocalCache(`cached_students_${year}`, students);
      }
    }

    // 5. Pre-warm attendance & evaluations local cache for each course
    for (const course of activeCourses) {
      const attKey = `cache_attendance_${course.id}`;
      const existingAtt = getLocalCache(attKey);

      const yearStudents = getLocalCache(`cached_students_${course.academic_year}`) || [];
      let courseStudents = yearStudents;
      if (course.course_type === "sections" && Array.isArray(course.sections) && course.sections.length > 0) {
        courseStudents = yearStudents.filter((s: any) => course.sections.includes(s.section));
      }

      if (!existingAtt) {
        setLocalCache(attKey, {
          course,
          students: courseStudents,
          makeupStudents: [],
          attendance: [],
          totalWeeksCount: 15
        });
      } else if (!existingAtt.course) {
        existingAtt.course = course;
        if (!existingAtt.students || existingAtt.students.length === 0) {
          existingAtt.students = courseStudents;
        }
        setLocalCache(attKey, existingAtt);
      }

      const evalKey = `cache_evaluations_${course.id}`;
      const existingEval = getLocalCache(evalKey);
      if (!existingEval) {
        const projects = (
          (course.custom_week_names as any)?.__projects__ || []
        ).filter((p: any) => !p.is_archived);

        setLocalCache(evalKey, {
          course,
          projects,
          totalCourseStudents: courseStudents.length,
          projectStats: {}
        });
      } else if (!existingEval.course) {
        existingEval.course = course;
        setLocalCache(evalKey, existingEval);
      }
    }
  } catch (e) {
    // Non-blocking background worker
    console.warn("Preload worker completed with notice:", e);
  }
}
