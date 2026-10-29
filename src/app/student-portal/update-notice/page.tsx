"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StudentMigrationNotice, { MigrationStudentInfo } from "@/components/StudentMigrationNotice";

export default function StudentUpdateNoticePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<MigrationStudentInfo | null>(null);
  const [apkInfo, setApkInfo] = useState<{ downloadUrl: string; version: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryCode = searchParams.get("code");
  // وضع المعاينة والتجربة مخصص فقط للمسؤولين عند وجود بارامتر المعاينة صراحة
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isTestParam = searchParams.get("test_update") === "1" || searchParams.get("preview") === "1" || searchParams.get("preview_update") === "1";
      let isAdminUser = false;
      try {
        const p = localStorage.getItem("cached_profile");
        if (p) {
          const parsed = JSON.parse(p);
          isAdminUser = ["مدير", "مدير مساعد", "admin", "أدمن"].includes(parsed?.role);
        }
      } catch (e) {}
      setIsTestMode(Boolean(isTestParam && isAdminUser));
    }
  }, [searchParams]);

  const fetchStudentInfo = async (codeToFetch?: string) => {
    setLoading(true);
    setError(null);
    try {
      let activeCode = codeToFetch || queryCode;

      if (!activeCode && typeof window !== "undefined") {
        try {
          const savedSession = localStorage.getItem("fania_student_session");
          if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (parsed?.student_code) activeCode = parsed.student_code;
          }
        } catch (e) {}

        if (!activeCode) {
          activeCode = localStorage.getItem("fania_student_code") || "";
        }
      }

      // Default to representative active student only if explicitly requested in test/preview mode BY AN AUTHENTICATED ADMIN
      if (!activeCode) {
        let isAdminUser = false;
        try {
          const p = typeof window !== "undefined" ? localStorage.getItem("cached_profile") : null;
          if (p) {
            const parsed = JSON.parse(p);
            isAdminUser = ["مدير", "مدير مساعد", "admin", "أدمن"].includes(parsed?.role);
          }
        } catch (e) {}

        const isTestParam = searchParams.get("test_update") === "1" || searchParams.get("preview") === "1" || searchParams.get("preview_update") === "1";

        if (isTestParam && isAdminUser) {
          activeCode = "0687"; // Only for verified admin preview
        } else {
          // Real student with no account on this phone: render general welcome migration notice cleanly
          setStudentInfo(null);
          setApkInfo({
            downloadUrl: "https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.6/ArtEdu-Student-Portal-Release.apk",
            version: "1.0.6"
          });
          setLoading(false);
          return;
        }
      }

      const res = await fetch(`/api/students/migration-info?code=${encodeURIComponent(activeCode)}&test_update=1`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.student) {
        setError(data.error || "تعذر العثور على بيانات الحساب");
        setLoading(false);
        return;
      }

      setStudentInfo(data.student);
      if (data.apk) {
        setApkInfo({
          downloadUrl: data.apk.downloadUrl,
          version: data.apk.version || "1.0.6"
        });
      }
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentInfo();
  }, [queryCode]);

  const handleContinueToWeb = () => {
    if (typeof window !== "undefined") {
      // Mark as bypassed so web portal opens normally
      localStorage.setItem("fania_bypass_update_notice", "1");
      
      // If testing with a specific student code and not logged in, populate the session so web portal opens on this account
      if (studentInfo) {
        try {
          const currentSession = localStorage.getItem("fania_student_session");
          if (!currentSession) {
            localStorage.setItem("fania_student_session", JSON.stringify({
              student_code: studentInfo.student_code,
              full_name: studentInfo.full_name,
              academic_year: studentInfo.academic_year,
              section: studentInfo.section,
              status: "active"
            }));
            localStorage.setItem("fania_student_code", studentInfo.student_code);
          }
        } catch (e) {}
      }
      
      window.location.href = "/system?web=1";
    }
  };

  const handleSwitchCode = (newCode: string) => {
    router.push(`/student-portal/update-notice?code=${encodeURIComponent(newCode)}`);
    fetchStudentInfo(newCode);
  };

  if (loading) {
    return (
      <div 
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#070a12",
          color: "#38bdf8",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        <div style={{
          width: "44px",
          height: "44px",
          border: "3px solid #1e293b",
          borderTopColor: "#38bdf8",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          marginBottom: "16px"
        }} />
        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#f1f5f9" }}>جاري تجهيز بيانات حسابك...</div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>منظومة كلية التربية الفنية</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#070a12",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center"
        }}
      >
        <div style={{
          background: "rgba(15, 23, 42, 0.8)",
          border: "1px solid #ef4444",
          borderRadius: "18px",
          padding: "28px",
          maxWidth: "420px",
          width: "100%"
        }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
          <h2 style={{ fontSize: "18px", color: "#ef4444", margin: "0 0 10px 0" }}>تعذر العثور على حساب الطالب</h2>
          <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "20px" }}>
            {error || "لم يتم العثور على حساب مفعل بهذا الكود على هذا المتصفح."}
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            {isTestMode && (
              <button
                onClick={() => handleSwitchCode("0732")}
                style={{
                  background: "#38bdf8",
                  color: "#000",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                معاينة بحساب تجريبي (0732)
              </button>
            )}
            <button
              onClick={handleContinueToWeb}
              style={{
                background: "#1e293b",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              الذهاب لتسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StudentMigrationNotice
      student={studentInfo}
      apkDownloadUrl={apkInfo?.downloadUrl}
      apkVersion={apkInfo?.version}
      isTestMode={isTestMode}
      onContinueToWeb={handleContinueToWeb}
      onSwitchStudentCode={isTestMode ? handleSwitchCode : undefined}
    />
  );
}
