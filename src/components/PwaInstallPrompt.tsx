"use client";

import { useEffect, useState } from "react";

export default function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Only show if not standalone
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also just show it randomly if the user is on mobile safari where prompt isn't supported automatically
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS && !isStandalone) {
      setShowPrompt(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!showPrompt) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // iOS doesn't support deferredPrompt, so just show instructions
      alert("الرجاء الضغط على زر المشاركة ثم 'إضافة إلى الشاشة الرئيسية'");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.85)",
        zIndex: 99999,
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        className="card"
        style={{
          width: "90%",
          maxWidth: "360px",
          textAlign: "center",
          border: "2px solid #2196F3",
          boxShadow: "0 10px 30px rgba(33,150,243,0.4)",
        }}
      >
        <img
          src="/icon-192.png"
          alt="أيقونة التطبيق"
          style={{
            width: "90px",
            height: "90px",
            borderRadius: "20px",
            boxShadow: "0 5px 15px rgba(0,0,0,0.5)",
            marginBottom: "12px",
            objectFit: "cover",
          }}
        />
        <h3 style={{ color: "#2196F3", margin: "0 0 8px 0", fontSize: "20px" }}>تثبيت نظام التربية الفنية</h3>
        <p style={{ fontSize: "13px", color: "#ddd", marginBottom: "18px", lineHeight: "1.6" }}>
          يرجى تثبيت التطبيق على جهازك لتأمين الوصول السريع والعمل حتى عند انقطاع الإنترنت.
        </p>

        <button
          onClick={handleInstallClick}
          style={{
            background: "linear-gradient(135deg, #2196F3, #1E88E5)",
            fontSize: "16px",
            fontWeight: "bold",
            padding: "12px 20px",
            borderRadius: "25px",
            border: "none",
            boxShadow: "0 4px 15px rgba(33,150,243,0.4)",
            marginBottom: "10px",
            width: "100%",
            color: "white",
            cursor: "pointer",
          }}
        >
          📱 تثبيت التطبيق الآن
        </button>

        <button
          onClick={() => setShowPrompt(false)}
          className="secondary"
          style={{
            fontSize: "12px",
            marginTop: "5px",
            opacity: 0.8,
            width: "100%",
            background: "#333",
            color: "white",
            border: "none",
            padding: "10px",
            borderRadius: "25px",
            cursor: "pointer",
          }}
        >
          المتابعة عبر المتصفح مؤقتاً
        </button>
      </div>
    </div>
  );
}
