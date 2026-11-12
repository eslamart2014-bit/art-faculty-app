"use client";
import React, { useEffect, useState, Suspense } from "react";
import QRScanner from "@/components/scanner/QRScanner";
import { useSearchParams } from "next/navigation";
import { extractStudentCode } from "@/lib/students/codeHelper";

function ScannerContent() {
  const [init, setInit] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [tg, setTg] = useState<any>(null);
  
  const searchParams = useSearchParams();
  const crs = searchParams.get('crs') || '';
  const proj = searchParams.get('proj') || '';

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.onload = () => {
      if ((window as any).Telegram?.WebApp) {
        const webApp = (window as any).Telegram.WebApp;
        webApp.ready();
        webApp.expand();
        setTg(webApp);
      }
      setInit(true);
    };
    document.head.appendChild(script);
  }, []);

  const handleScan = (result: string) => {
    if (scanned || !result) return;
    const cleanCode = extractStudentCode(result) || result.trim();
    if (!cleanCode) return;

    setScanned(true);

    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    if (tg) {
      tg.sendData(JSON.stringify({ type: 'SCAN_RESULT', code: cleanCode, crs, proj }));
      tg.close();
    } else {
      alert("Scanned: " + cleanCode);
    }
  };

  if (!init) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", fontSize: "14px" }}>
        جاري تحميل الكاميرا...
      </div>
    );
  }

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", direction: "rtl" }}>
      <h2 style={{ color: "var(--text)", fontSize: "18px", fontWeight: 600, margin: "0 0 16px 0" }}>قم بمسح كود الطالب</h2>
      <div style={{ width: "100%", maxWidth: "380px", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border-light)", background: "var(--surface)" }}>
        <QRScanner 
          onScan={handleScan} 
          height="320px"
        />
      </div>
      <p style={{ color: "var(--text-secondary)", marginTop: "16px", fontSize: "13px", textAlign: "center", padding: "0 16px" }}>
        {crs && proj ? `إضافة عمل لمشروع: ${proj}` : 'البحث العام عن طالب'}
      </p>
      {tg && (
        <button 
          onClick={() => tg.close()} 
          style={{
            marginTop: "24px",
            background: "rgba(239, 68, 68, 0.14)",
            color: "var(--error-ink)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "10px 20px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer"
          }}
        >
          إلغاء وإغلاق
        </button>
      )}
    </div>
  );
}

export default function BotScannerPage() {
  return (
    <Suspense fallback={<div style={{ background: "#111", minHeight: "100vh" }}></div>}>
      <ScannerContent />
    </Suspense>
  );
}
