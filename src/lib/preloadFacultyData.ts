import { supabase } from "@/lib/supabase";
import { getLocalCache, setLocalCache } from "@/lib/syncEngine";

/**
 * محرك التخزين المحلي المسبق لأعضاء هيئة التدريس
 * يقوم بتنزيل المقررات وقوائم الطلاب وحفظها على ذاكرة الهاتف (localStorage / IndexedDB)
 * ليعمل التطبيق بسرعة 0ms وبدون الحاجة لإنترنت سريع داخل القاعات
 */
export async function preloadFacultyData(userId: string) {
  if (typeof window === "undefined" || !navigator.onLine || !userId) return;

  try {
    // 1. تحميل إعدادات النظام ومصطلحات الترم في الخلفية
    supabase
      .from("system_settings")
      .select("term1_start, term2_start, term1_end, term2_end, is_maintenance_mode, maintenance_message")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLocalCache("cached_system_settings", data);
      });

    // 2. تحميل خريطة أسماء الأساتذة والزملاء
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

    // 3. تحميل المقررات الخاصة بالدكتور (المباشرة والمشتركة)
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

    // 4. تحميل كشوف الطلاب للفرق الدراسية المرتبطة بمقررات الدكتور
    const academicYears = Array.from(
      new Set(activeCourses.map((c) => c.academic_year).filter(Boolean))
    );

    await Promise.all(
      academicYears.map(async (year) => {
        const { data: students } = await supabase
          .from("students")
          .select("id, full_name, student_code, academic_year, section")
          .eq("academic_year", year)
          .eq("is_active", true);
        if (students && students.length > 0) {
          setLocalCache(`cached_students_${year}`, students);
        }
      })
    );

    // 5. تهيئة دفاتر الحضور والتقييمات مسبقاً لكل مقرر
    for (const course of activeCourses) {
      try {
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
      } catch (err: any) {
        // حماية عند وصول المتصفح لسقف الذاكرة (خصوصاً Safari iOS)
        if (err?.name === "QuotaExceededError" || err?.code === 22) {
          console.warn("Storage quota limit reached, keeping existing cache.");
          break;
        }
      }
    }
  } catch (e) {
    console.warn("Preload worker completed with notice:", e);
  }
}

/**
 * التنزيل الفوري الشامل لحزمة البيانات بدون إنترنت
 * يتم استدعاؤه بنقرة واحدة من عضو هيئة التدريس لتخزين كل ما يحتاجه
 */
export async function forceDownloadFacultyOfflinePack(
  userId: string,
  onProgress?: (step: string, percent: number) => void
): Promise<{ success: boolean; coursesCount: number; studentsCount: number; error?: string }> {
  if (typeof window === "undefined" || !userId) {
    return { success: false, coursesCount: 0, studentsCount: 0, error: "تعذر بدء التحميل بدون بيئة متصفح صالحة" };
  }

  try {
    onProgress?.("جاري الاتصال بالنظام وتحديث إعدادات الفصل الدراسي...", 15);

    // 1. الإعدادات وقوائم الأساتذة
    const [settingsRes, profilesRes, coursesRes] = await Promise.all([
      supabase
        .from("system_settings")
        .select("term1_start, term2_start, term1_end, term2_end, is_maintenance_mode, maintenance_message")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name, degree"),
      supabase
        .from("courses")
        .select("*")
        .or(`teacher_id.eq.${userId},shared_with.cs.{${userId}}`)
        .order("created_at", { ascending: false })
    ]);

    if (settingsRes.data) setLocalCache("cached_system_settings", settingsRes.data);
    if (profilesRes.data) {
      const map: Record<string, string> = {};
      profilesRes.data.forEach((p) => { map[p.id] = p.full_name; });
      setLocalCache("cached_profiles_map", map);
    }

    onProgress?.("تم تنزيل قائمة المقررات، جاري فحص الفرق والشعب...", 35);
    const courses = coursesRes.data || [];
    const activeCourses = courses.filter((c) =>
      !c.custom_week_names?.__archived &&
      !(c.custom_week_names?.__hidden_for || []).includes(userId)
    );
    setLocalCache(`cached_courses_${userId}`, activeCourses);

    // 2. جلب قوائم طلاب الفرق الدراسية
    const academicYears = Array.from(new Set(activeCourses.map((c) => c.academic_year).filter(Boolean)));
    onProgress?.(`جاري تنزيل كشوف الطلاب لـ (${academicYears.length}) فرق دراسية...`, 60);

    let totalStudentsLoaded = 0;
    await Promise.all(
      academicYears.map(async (year) => {
        const { data: students } = await supabase
          .from("students")
          .select("id, full_name, student_code, academic_year, section")
          .eq("academic_year", year)
          .eq("is_active", true);
        if (students && students.length > 0) {
          totalStudentsLoaded += students.length;
          setLocalCache(`cached_students_${year}`, students);
        }
      })
    );

    // 3. تهيئة وتثبيت دفاتر الحضور والتقييمات لكل مقرر محلياً
    onProgress?.("جاري تجهيز وتثبيت دفاتر الحضور والتقييمات لكل مقرر...", 85);
    for (const course of activeCourses) {
      try {
        const yearStudents = getLocalCache(`cached_students_${course.academic_year}`) || [];
        let courseStudents = yearStudents;
        if (course.course_type === "sections" && Array.isArray(course.sections) && course.sections.length > 0) {
          courseStudents = yearStudents.filter((s: any) => course.sections.includes(s.section));
        }

        const attKey = `cache_attendance_${course.id}`;
        const existingAtt = getLocalCache(attKey) || {};
        setLocalCache(attKey, {
          ...existingAtt,
          course,
          students: courseStudents,
          makeupStudents: existingAtt.makeupStudents || [],
          attendance: existingAtt.attendance || [],
          totalWeeksCount: existingAtt.totalWeeksCount || 15
        });

        const evalKey = `cache_evaluations_${course.id}`;
        const existingEval = getLocalCache(evalKey) || {};
        const projects = ((course.custom_week_names as any)?.__projects__ || []).filter((p: any) => !p.is_archived);
        setLocalCache(evalKey, {
          ...existingEval,
          course,
          projects: existingEval.projects?.length ? existingEval.projects : projects,
          totalCourseStudents: courseStudents.length,
          projectStats: existingEval.projectStats || {}
        });
      } catch (err: any) {
        if (err?.name === "QuotaExceededError" || err?.code === 22) {
          console.warn("Quota limit reached during full download.");
          break;
        }
      }
    }

    // 4. تحميل مسبق لواجهات المقررات والصفحات لتعمل أوفلاين 100% حتى من اختصار كروم
    onProgress?.("جاري تخزين واجهات المقررات محلياً لتعمل بدون نت...", 92);
    try {
      await Promise.all(
        activeCourses.map(async (c) => {
          fetch(`/course/${c.id}`).catch(() => {});
          fetch(`/course/${c.id}/attendance`).catch(() => {});
          fetch(`/course/${c.id}/evaluations`).catch(() => {});
        })
      );
    } catch (e) {}

    // حفظ بيانات الحزمة وتوقيتها لعرضها في الواجهة
    const packMeta = {
      timestamp: new Date().toISOString(),
      coursesCount: activeCourses.length,
      studentsCount: totalStudentsLoaded
    };
    setLocalCache(`cached_offline_pack_meta_${userId}`, packMeta);

    onProgress?.("تم التثبيت بنجاح! التطبيق جاهز الآن للعمل بأقصى سرعة بدون نت.", 100);

    return {
      success: true,
      coursesCount: activeCourses.length,
      studentsCount: totalStudentsLoaded
    };
  } catch (err: any) {
    console.error("Failed to build offline pack:", err);
    return { success: false, coursesCount: 0, studentsCount: 0, error: err.message || "حدث خطأ غير متوقع" };
  }
}
