"use client";

import { useEffect, useState } from "react";
import Login from "@/components/Login";
import StudentMigrationNotice from "@/components/StudentMigrationNotice";

export default function StudentPortalUnifiedPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [apkUrl, setApkUrl] = useState<string | undefined>();
  const [apkVersion, setApkVersion] = useState("1.0.6");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("test_update") === "1" || urlParams.get("preview_update") === "1" || urlParams.get("preview") === "1") {
        setIsRedirecting(true);
        window.location.replace(`/student-portal/update-notice${window.location.search}`);
        return;
      }

      // إذا كان الطالب مسجل دخول بالفعل أو لديه حساب على هذا الهاتف، ينقله مباشرة إلى لوحة تحكمه
      const studentSession = localStorage.getItem("fania_student_session");
      const studentCode = localStorage.getItem("fania_student_code");
      if (studentSession || studentCode) {
        setIsRedirecting(true);
        window.location.replace("/system");
        return;
      }

      // إذا كان عضو هيئة تدريس مسجل دخول، ينقله إلى لوحة المقررات
      const facultyProfile = localStorage.getItem("cached_profile");
      if (facultyProfile) {
        setIsRedirecting(true);
        window.location.replace("/");
        return;
      }

      // فحص هل شاشة الترقية للتطبيق مفعلة في إعدادات النظام للطلاب الجدد
      const isBypassed = localStorage.getItem("fania_bypass_update_notice") === "1";
      if (!isBypassed) {
        fetch("/api/public/settings", { cache: "no-store" })
          .then(r => r.json())
          .then(settings => {
            if (settings?.student_migration_screen) {
              setShowMigration(true);
            }
          })
          .catch(() => {});
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

  // إذا كانت شاشة الترقية مفعلة ولم يتجاوزها الطالب بعد
  if (showMigration) {
    return (
      <StudentMigrationNotice
        student={null} // طالب جديد / أول مرة: يعرض الترحيب والزرين دون أي استعلام أو كشف لبيانات أي طالب
        apkDownloadUrl={apkUrl}
        apkVersion={apkVersion}
        isTestMode={false}
        onContinueToWeb={() => {
          localStorage.setItem("fania_bypass_update_notice", "1");
          setShowMigration(false);
        }}
      />
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
