"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Don't show if already installed as standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Check if user dismissed iOS hint recently (within 24 hours)
      const dismissed = localStorage.getItem("pwa_dismissed_ios");
      if (!dismissed || Date.now() - parseInt(dismissed) > 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
      return;
    }

    // Android / Chrome - listen for beforeinstallprompt event and show prompt immediately!
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
            <span>تثبيت التطبيق على جهازك</span>
            <span style={{ fontSize: "10px", background: "rgba(37,99,235,0.3)", color: "#60a5fa", padding: "2px 6px", borderRadius: "4px" }}>
              تثبيت عادي
            </span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
            {isIOS
              ? 'اضغط على زر المشاركة (Share) في المتصفح ثم اختر "إضافة إلى الصفحة الرئيسية"'
              : "للوصول المباشر والعمل السريع بدون تشتت"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
        {!isIOS && (
          <button
            onClick={handleInstall}
            style={{
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "9px 16px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 10px rgba(37, 99, 235, 0.4)",
              margin: 0
            }}
          >
            <Download size={15} />
            <span>تثبيت التطبيق</span>
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            padding: "8px 12px",
            fontSize: "12px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            margin: 0
          }}
          title="إغلاق التنبيه"
        >
          <X size={14} />
          <span>لاحقاً</span>
        </button>
      </div>
    </div>
  );
}
