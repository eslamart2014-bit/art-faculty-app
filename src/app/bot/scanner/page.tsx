"use client";
import React, { useEffect, useState, Suspense } from "react";
import QRScanner from "@/components/QRScanner";
import { useSearchParams } from "next/navigation";

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
    setScanned(true);

    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    if (tg) {
      tg.sendData(JSON.stringify({ type: 'SCAN_RESULT', code: result, crs, proj }));
      tg.close();
    } else {
      alert("Scanned: " + result);
    }
  };

  if (!init) return <div style={{ color: "#fff", textAlign: "center", padding: "50px" }}>جاري تحميل الكاميرا...</div>;

  return (
    <div style={{ background: "#111", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <h2 style={{ color: "#fff", marginBottom: "20px" }}>قم بمسح كود الطالب</h2>
      <div style={{ width: "90%", maxWidth: "400px", borderRadius: "20px", overflow: "hidden", border: "4px solid #4CAF50" }}>
        <QRScanner onScan={handleScan} />
      </div>
      <p style={{ color: "#aaa", marginTop: "20px", fontSize: "14px", textAlign: "center", padding: "0 20px" }}>
        {crs && proj ? `إضافة عمل لمشروع: ${proj}` : 'البحث العام عن طالب'}
      </p>
      {tg && (
        <button 
          onClick={() => tg.close()} 
          style={{ marginTop: "30px", background: "#f44336", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "10px", fontSize: "16px" }}
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
