"use client";

import { useEffect, useState } from "react";
import Login from "@/components/Login";
import StudentMigrationNotice from "@/components/StudentMigrationNotice";
import { isAndroidAppClient, isInstalledPWA } from "@/lib/deviceFingerprint";

export default function StudentPortalUnifiedPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [apkUrl, setApkUrl] = useState<string | undefined>();
  const [apkVersion, setApkVersion] = useState("1.0.6");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const isTestUpdate = urlParams.get("test_update") === "1" || urlParams.get("preview_update") === "1" || urlParams.get("preview") === "1";
      if (isTestUpdate) {
        setIsRedirecting(true);
        window.location.replace(`/student-portal/update-notice${window.location.search}`);
        return;
      }

      // 1. عضو هيئة التدريس لا يوجه لتحديثات الطلاب
      const facultyProfile = localStorage.getItem("cached_profile");
      if (facultyProfile) {
        setIsRedirecting(true);
        window.location.replace("/");
        return;
      }

      // استخراج كود الطالب المحفوظ إن وُجد
      let savedCode = "";
      try {
        const s = localStorage.getItem("fania_student_session");
        if (s) {
          const parsed = JSON.parse(s);
          if (parsed?.student_code) savedCode = parsed.student_code;
        }
      } catch (e) {}
      if (!savedCode) {
        savedCode = localStorage.getItem("fania_student_code") || "";
      }

      const isNativeApp = isAndroidAppClient();
      const isPWA = isInstalledPWA();
      const isBypassed = localStorage.getItem("fania_bypass_update_notice") === "1";
      const hasWebParam = urlParams.get("web") === "1" || urlParams.get("bypass") === "1";

      // 2. إذا كان المستخدم يفتح من اختصار PWA المثبت سابقاً (وليس تطبيق الأندرويد الأصلي):
      // يوجه فوراً وبشكل حتمي لشاشة تحديث الأندرويد
      if (!isNativeApp && isPWA && !hasWebParam) {
        setIsRedirecting(true);
        window.location.replace(`/student-portal/update-notice${savedCode ? `?code=${encodeURIComponent(savedCode)}` : ""}`);
        return;
      }

      // 3. داخل تطبيق الأندرويد الرسمي:
      if (isNativeApp) {
        if (savedCode) {
          setIsRedirecting(true);
          window.location.replace("/system");
          return;
        }
        // إذا لم يكن مسجل دخول داخل تطبيق الأندرويد، يعرض شاشة الدخول المدمجة
        return;
      }

      // 4. في المتصفح العادي: فحص إعدادات التحويل لتطبيق الأندرويد
      if (!isBypassed && !hasWebParam) {
        fetch("/api/public/settings", { cache: "no-store" })
          .then(r => r.json())
          .then(settings => {
            if (settings?.student_migration_screen) {
              setIsRedirecting(true);
              window.location.replace(`/student-portal/update-notice${savedCode ? `?code=${encodeURIComponent(savedCode)}` : ""}`);
            } else if (savedCode) {
              setIsRedirecting(true);
              window.location.replace("/system");
            }
          })
          .catch(() => {
            if (savedCode) {
              setIsRedirecting(true);
              window.location.replace("/system");
            }
          });
        return;
      }

      // 5. متصفح عادي مع تجاوز معتمد
      if (savedCode) {
        setIsRedirecting(true);
        window.location.replace("/system?web=1");
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
