"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. حجب النافذة تماماً عن مسارات الطلاب وبوابة الطلاب حتى لا تزعجهم
    const isStudentPath = pathname?.startsWith("/student-portal") || pathname?.startsWith("/system");
    const isStudentSession = Boolean(localStorage.getItem("fania_student_session") || localStorage.getItem("fania_student_code"));
    if (isStudentPath || isStudentSession) {
      setShowPrompt(false);
      return;
    }

    // 2. إذا كان التطبيق مثبتاً بالفعل كـ standalone PWA، لا داعي لإظهار النافذة
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // 3. فحص أجهزة iOS للدكاترة
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      const dismissed = localStorage.getItem("pwa_dismissed_ios");
      if (!dismissed || Date.now() - parseInt(dismissed) > 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
      return;
    }

    // 4. أجهزة Android / Chrome للدكاترة (تثبيت PWA رسمي)
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [pathname]);

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem("pwa_dismissed_ios", Date.now().toString());
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(18, 24, 38, 0.96)",
        backdropFilter: "blur(12px)",
        borderTop: "2px solid #2563eb",
        zIndex: 999999,
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        direction: "rtl",
        boxShadow: "0 -6px 25px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
        <img
          src="/icon-192.png"
          style={{ width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" }}
          alt="icon"
        />
        <div>
          <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>تثبيت تطبيق المنظومة على جهازك</span>
            <span style={{ fontSize: "10px", background: "rgba(37,99,235,0.3)", color: "#60a5fa", padding: "2px 6px", borderRadius: "4px" }}>
              لوحة هيئة التدريس (PWA)
            </span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
            {isIOS
              ? 'اضغط على زر المشاركة (Share) في المتصفح ثم اختر "إضافة إلى الصفحة الرئيسية"'
              : "للوصول المباشر السريع للوحة المقر والتقييمات بدون تشتت"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 14px",
              fontWeight: "bold",
              fontSize: "12.5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Download size={14} />
            تثبيت الآن
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: "6px",
            display: "flex",
            alignItems: "center",
          }}
          title="إغلاق"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
