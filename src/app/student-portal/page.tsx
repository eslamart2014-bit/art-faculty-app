"use client";

import { useEffect, useState } from "react";
import Login from "@/components/Login";
import StudentMigrationNotice from "@/components/StudentMigrationNotice";
import { isAndroidAppClient, isInstalledPWA, isIOSClient } from "@/lib/deviceFingerprint";

export default function StudentPortalUnifiedPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [apkUrl, setApkUrl] = useState<string | undefined>();
  const [apkVersion, setApkVersion] = useState("1.0.6");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      let isAdminUser = false;
      try {
        const p = localStorage.getItem("cached_profile");
        if (p) {
          const parsed = JSON.parse(p);
          isAdminUser = ["مدير", "مدير مساعد", "admin", "أدمن"].includes(parsed?.role);
        }
      } catch (e) {}
      const isTestUpdate = isAdminUser && (urlParams.get("test_update") === "1" || urlParams.get("preview_update") === "1" || urlParams.get("preview") === "1");
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
      const isIOS = isIOSClient();
      const isPWA = isInstalledPWA();
      const isBypassed = localStorage.getItem("fania_bypass_update_notice") === "1";
      const hasWebParam = urlParams.get("web") === "1" || urlParams.get("bypass") === "1";

      // 2. إذا كان الجهاز آيفون (iOS):
      // لا يوجه لتحميل APK أبداً، بل يفضل على وضعه في بوابة الويب
      if (isIOS) {
        setIsRedirecting(true);
        window.location.replace(savedCode ? "/system" : "/system?web=1");
        return;
      }

      // 3. داخل تطبيق الأندرويد الرسمي:
      if (isNativeApp) {
        setIsRedirecting(true);
        window.location.replace("/system");
        return;
      }

      // 4. أجهزة الأندرويد خارج التطبيق الأصلي (PWA مثبت سابقاً أو متصفح فتح اللينك):
      // التوجيه الفوري لشاشة ترقية الأندرويد وتثبيت التطبيق الجديد
      if (!hasWebParam && !isBypassed) {
        setIsRedirecting(true);
        window.location.replace(`/student-portal/update-notice${savedCode ? `?code=${encodeURIComponent(savedCode)}` : ""}`);
        return;
      }

      // 5. متصفح عادي مع طلب صريح للدخول على الويب (?web=1)
      setIsRedirecting(true);
      window.location.replace("/system?web=1");
      return;
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
