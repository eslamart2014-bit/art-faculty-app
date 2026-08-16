"use client";

import { useEffect, useState } from "react";

export default function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed as standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if user dismissed recently (within 3 days)
    const dismissed = localStorage.getItem("pwa_dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < threeDays) return;
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Show iOS instructions after 2 seconds
      setTimeout(() => setShowPrompt(true), 2000);
      return;
    }

    // Android / Chrome
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa_dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
        localStorage.removeItem("pwa_dismissed");
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
        background: "#1e1e1e",
        borderTop: "2px solid #2196F3",
        zIndex: 99999,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        direction: "rtl",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <img
        src="/icon-192.png"
        style={{ width: "50px", height: "50px", borderRadius: "12px", flexShrink: 0 }}
        alt="icon"
      />
      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", marginBottom: "2px" }}>
          ثبّت التطبيق على جهازك
        </div>
        <div style={{ color: "#aaa", fontSize: "12px" }}>
          {isIOS
            ? 'اضغط على زر المشاركة ثم "أضف إلى الشاشة الرئيسية"'
            : "للوصول السريع بدون إنترنت"}
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        {!isIOS && (
          <button
            onClick={handleInstall}
            style={{
              background: "#2196F3",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              width: "auto",
              margin: 0,
            }}
          >
            تثبيت
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: "transparent",
            color: "#aaa",
            border: "1px solid #444",
            borderRadius: "20px",
            padding: "8px 12px",
            fontSize: "13px",
            cursor: "pointer",
            width: "auto",
            margin: 0,
          }}
        >
          لاحقاً
        </button>
      </div>
    </div>
  );
}
