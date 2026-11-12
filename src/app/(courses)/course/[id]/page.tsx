"use client";

import { useEffect, useState, use } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, GraduationCap, Shield, Star, Users } from "lucide-react";
import { supabase } from "@/lib/core/supabase";

export default function CourseDashboard({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  
  const resolvedParams = use(params);

  
  const getCachedCourse = () => {
    if (typeof window === 'undefined') return undefined;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("cached_courses_")) {
          const list = JSON.parse(localStorage.getItem(k) || "[]");
          const found = list.find((c: any) => c.id === resolvedParams.id);
          if (found) return found;
        }
      }
      const attCache = localStorage.getItem(`cache_attendance_${resolvedParams.id}`);
      if (attCache) {
        const parsed = JSON.parse(attCache);
        if (parsed.course) return parsed.course;
      }
      const evalCache = localStorage.getItem(`cache_evaluations_${resolvedParams.id}`);
      if (evalCache) {
        const parsed = JSON.parse(evalCache);
        if (parsed.course) return parsed.course;
      }
    } catch(e) {}
    return undefined;
  };

  const fetcher = async () => {
    const { data, error } = await supabase.from("courses").select("*").eq("id", resolvedParams.id).single();
    if (error) throw error;
    return data;
  };
  const [initialCourse] = useState(getCachedCourse);
  const { data: course, error } = useSWR(`course_${resolvedParams.id}`, fetcher, {
    fallbackData: initialCourse,
    revalidateOnFocus: false
  });
  const loading = !course && !error;

  useEffect(() => {
    // Only alert if there is no cached course data at all
    if (error && !course) {
      alert("تعذر تحميل بيانات المقرر، يرجى التأكد من الاتصال بالإنترنت أول مرة.");
      router.push("/");
    }
  }, [error, course]);
  ;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column", background: "var(--background)" }}>
        <div className="loader-circle"></div>
        <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "12px" }}>جاري تحميل المقرر...</div>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      {/* App Bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 20px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        direction: "rtl"
      }}>
        <div style={{ flex: 1 }}>
          <button
            type="button"
            className="hide-on-mobile btn-compact"
            onClick={() => router.push("/")}
            style={{
              background: "var(--surface-hover)",
              border: "1px solid var(--border-light)",
              color: "var(--text)",
              padding: "6px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              margin: 0
            }}
          >
            <ArrowRight size={15} strokeWidth={1.5} />
            <span>عودة</span>
          </button>
        </div>
        <div style={{ flex: 2, textAlign: "center", color: "var(--accent-ink)", fontWeight: 600, fontSize: "16px" }}>
          إدارة المقرر
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto", direction: "rtl" }}>

        {/* Course Info Card */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border-light)",
          borderTop: "3px solid var(--primary)",
          borderRadius: "16px",
          padding: "20px",
          marginBottom: "24px",
          textAlign: "center"
        }}>
          <h2 style={{ margin: "0 0 10px 0", color: "var(--text)", fontSize: "20px", fontWeight: 600 }}>{course.name}</h2>
          <div className="tabular-nums" style={{ color: "var(--text-secondary)", fontSize: "13px", display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <GraduationCap size={15} strokeWidth={1.5} color="var(--accent-ink)" />
              <span>الفرقة: {course.academic_year}</span>
            </span>
            <span style={{ color: "var(--border-light)" }}>|</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              {course.course_type === "lectures" ? (
                <>
                  <BookOpen size={15} strokeWidth={1.5} color="var(--accent-ink)" />
                  <span>محاضرات</span>
                </>
              ) : (
                <>
                  <Users size={15} strokeWidth={1.5} color="var(--accent-ink)" />
                  <span>سكاشن: {course.sections.length}</span>
                </>
              )}
            </span>
          </div>
        </div>

        <h3 style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500, marginBottom: "14px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
          اختر المهمة
        </h3>

        {/* Dashboard Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

          <button
            type="button"
            onClick={() => router.push(`/course/${course.id}/attendance`)}
            style={{
              background: "var(--surface)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "var(--text)",
              padding: "22px 12px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color 0.15s var(--ease-out), background 0.15s var(--ease-out)",
              margin: 0
            }}
          >
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success-ink)" }}>
              <ClipboardCheck size={22} strokeWidth={1.5} />
            </div>
            <span style={{ color: "var(--success-ink)" }}>تسجيل حضور</span>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/course/${course.id}/evaluations`)}
            style={{
              background: "var(--surface)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "var(--text)",
              padding: "22px 12px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color 0.15s var(--ease-out), background 0.15s var(--ease-out)",
              margin: 0
            }}
          >
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--warning-ink)" }}>
              <Star size={22} strokeWidth={1.5} />
            </div>
            <span style={{ color: "var(--warning-ink)" }}>تقييم</span>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/course/${course.id}/reports`)}
            style={{
              background: "var(--surface)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              color: "var(--text)",
              padding: "22px 12px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color 0.15s var(--ease-out), background 0.15s var(--ease-out)",
              margin: 0
            }}
          >
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-ink)" }}>
              <BarChart3 size={22} strokeWidth={1.5} />
            </div>
            <span style={{ color: "var(--accent-ink)" }}>تقارير</span>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/course/${course.id}/control`)}
            style={{
              background: "var(--surface)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--text)",
              padding: "22px 12px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color 0.15s var(--ease-out), background 0.15s var(--ease-out)",
              margin: 0
            }}
          >
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--error-ink)" }}>
              <Shield size={22} strokeWidth={1.5} />
            </div>
            <span style={{ color: "var(--error-ink)" }}>بوابة الكنترول</span>
          </button>

        </div>
      </div>
    </div>
  );
}
