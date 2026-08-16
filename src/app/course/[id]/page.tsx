"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CourseDashboard({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const resolvedParams = use(params);

  useEffect(() => {
    fetchCourse();
  }, [resolvedParams.id]);

  const fetchCourse = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", resolvedParams.id)
      .single();

    if (data && !error) {
      setCourse(data);
    } else {
      console.error("Error fetching course", error);
      alert("تعذر تحميل بيانات المقرر");
      router.push("/");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column" }}>
        <div className="loader-circle"></div>
        <div style={{ color: "#ccc", fontSize: "14px", marginTop: "10px" }}>جاري تحميل المقرر...</div>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* App Bar (Simplified for Course Page) */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px",
        background: "rgba(0,0,0,0.5)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        direction: "rtl"
      }}>
        <div style={{ flex: 1 }}>
          <button 
            className="hide-on-mobile"
            onClick={() => router.push("/")} 
            style={{ 
              background: "rgba(255,255,255,0.1)", 
              border: "none", 
              color: "#fff", 
              padding: "8px 15px", 
              borderRadius: "20px", 
              cursor: "pointer",
              fontWeight: "bold"
            }}>
            🡲 عودة
          </button>
        </div>
        <div style={{ flex: 2, textAlign: "center", color: "var(--primary)", fontWeight: "bold", fontSize: "16px" }}>
          إدارة المقرر
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          {/* Options like edit/delete could go here later */}
        </div>
      </div>

      <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto", direction: "rtl" }}>
        
        {/* Course Info Card */}
        <div style={{
          background: "linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(30, 136, 229, 0.05))",
          border: "1px solid rgba(33, 150, 243, 0.3)",
          borderRadius: "15px",
          padding: "20px",
          marginBottom: "25px",
          textAlign: "center"
        }}>
          <h2 style={{ margin: "0 0 10px 0", color: "#fff", fontSize: "22px" }}>{course.name}</h2>
          <div style={{ color: "var(--text-muted)", fontSize: "14px", display: "flex", justifyContent: "center", gap: "15px" }}>
            <span>🎓 الفرقة: {course.academic_year}</span>
            <span>|</span>
            <span>{course.course_type === "lectures" ? "📖 محاضرات" : `🏫 سكاشن: ${course.sections.length}`}</span>
          </div>
        </div>

        <h3 style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "15px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
          اختر المهمة:
        </h3>

        {/* Dashboard Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          
          <button 
            onClick={() => router.push(`/course/${course.id}/attendance`)}
            style={{
              background: "rgba(76, 175, 80, 0.1)",
              border: "1px solid rgba(76, 175, 80, 0.4)",
              color: "#4CAF50",
              padding: "25px 10px",
              borderRadius: "15px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              fontSize: "16px",
              transition: "transform 0.2s"
            }}>
            <span style={{ fontSize: "35px" }}>📝</span>
            تسجيل حضور
          </button>

          <button 
            onClick={() => router.push(`/course/${course.id}/evaluations`)}
            style={{
              background: "rgba(255, 152, 0, 0.1)",
              border: "1px solid rgba(255, 152, 0, 0.4)",
              color: "#FF9800",
              padding: "25px 10px",
              borderRadius: "15px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              fontSize: "16px",
              transition: "transform 0.2s"
            }}>
            <span style={{ fontSize: "35px" }}>⭐</span>
            تقييم
          </button>

          <button 
            onClick={() => router.push(`/course/${course.id}/reports`)}
            style={{
              background: "rgba(103, 58, 183, 0.1)",
              border: "1px solid rgba(103, 58, 183, 0.4)",
              color: "#673AB7",
              padding: "25px 10px",
              borderRadius: "15px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              fontSize: "16px",
              transition: "transform 0.2s"
            }}>
            <span style={{ fontSize: "35px" }}>📊</span>
            تقارير
          </button>

          <button 
            onClick={() => router.push(`/course/${course.id}/control`)}
            style={{
              background: "rgba(244, 67, 54, 0.1)",
              border: "1px solid rgba(244, 67, 54, 0.4)",
              color: "#F44336",
              padding: "25px 10px",
              borderRadius: "15px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              fontSize: "16px",
              transition: "transform 0.2s"
            }}>
            <span style={{ fontSize: "35px" }}>🛡️</span>
            بوابة الكنترول
          </button>

        </div>
      </div>
    </div>
  );
}
