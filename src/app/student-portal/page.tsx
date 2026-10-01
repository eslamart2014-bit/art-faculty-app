"use client";

import { useEffect, useState } from "react";
import Login from "@/components/Login";

export default function StudentPortalUnifiedPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // إذا كان الطالب مسجل دخول بالفعل، ينقله مباشرة إلى لوحة تحكمه
      const studentSession = localStorage.getItem("fania_student_session");
      if (studentSession) {
        try {
          const parsed = JSON.parse(studentSession);
          if (parsed?.student_code) {
            setIsRedirecting(true);
            window.location.replace("/system");
            return;
          }
        } catch (e) {}
      }

      // إذا كان عضو هيئة تدريس مسجل دخول، ينقله إلى لوحة المقررات
      const facultyProfile = localStorage.getItem("cached_profile");
      if (facultyProfile) {
        setIsRedirecting(true);
        window.location.replace("/");
        return;
      }
    }
  }, []);

  if (isRedirecting) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0a0e17",
        color: "#38bdf8",
        fontFamily: "system-ui, sans-serif",
        direction: "rtl"
      }}>
        <div style={{ width: "42px", height: "42px", border: "3px solid #1e293b", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: "16px" }} />
        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#f1f5f9" }}>جاري توجيهك إلى لوحة التحكم...</div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>نظام فنية الموحد</div>
      </div>
    );
  }

  // نفس شاشة تسجيل الدخول المدمجة والموحدة للنظام بالكامل
  return (
    <Login 
      onLogin={(user) => {
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }} 
    />
  );
}
