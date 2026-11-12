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

    // 1. حجب النافذة تماماً عن مسارات الطلاب وبوت تليجرام (تظهر فقط لأعضاء هيئة التدريس المسجلين)
    const isStudentPath =
      pathname?.startsWith("/student-portal") ||
      pathname?.startsWith("/system") ||
      pathname?.startsWith("/tg");
    const isFacultyLogged = Boolean(localStorage.getItem("cached_profile"));
    if (isStudentPath || !isFacultyLogged) {
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
        background: "var(--surface)",
        borderTop: "1px solid var(--border-light)",
        zIndex: 999999,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        direction: "rtl",
        boxShadow: "0 -6px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
        <img
          src="/icon-192.png"
          style={{ width: "44px", height: "44px", borderRadius: "10px", flexShrink: 0, border: "1px solid var(--border-light)" }}
          alt="شعار النظام"
        />
        <div>
          <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span>تثبيت تطبيق المنظومة</span>
            <span style={{ fontSize: "11px", fontWeight: 500, background: "rgba(37,99,235,0.14)", border: "1px solid rgba(56,189,248,0.22)", color: "var(--accent-ink)", padding: "2px 8px", borderRadius: "4px" }}>
              لوحة هيئة التدريس
            </span>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "2px" }}>
            {isIOS
              ? 'اضغط على زر المشاركة (Share) في المتصفح ثم اختر "إضافة إلى الصفحة الرئيسية"'
              : "للوصول المباشر للوحة المقررات والتقييمات"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="btn-compact"
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontWeight: 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Download size={16} strokeWidth={1.5} />
            <span>تثبيت الآن</span>
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="modal-close-btn"
          title="إغلاق"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
