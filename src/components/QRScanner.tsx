"use client";
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onScan }: { onScan: (result: string) => void }) {
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  // Use a unique ID in case of multiple renders, though it shouldn't happen here
  const regionId = useRef(`qr-${Math.random().toString(36).substr(2, 9)}`).current;

  useEffect(() => {
    let isMounted = true;
    
    // Slight delay to ensure the DOM is fully painted
    const timer = setTimeout(() => {
      if (!isMounted) return;
      
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          if (isMounted) onScan(decodedText);
        },
        (error) => {
          // Ignore frame errors
        }
      ).catch(err => {
        console.error("Camera error:", err);
        if (isMounted) setErrorMsg("خطأ في تشغيل الكاميرا: " + (err.message || err));
      });
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan, regionId]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div id={regionId} style={{ width: "100%", minHeight: "250px" }}></div>
      {errorMsg && (
        <div style={{ position: "absolute", top: "10px", left: "10px", right: "10px", background: "rgba(255,0,0,0.8)", color: "white", padding: "10px", borderRadius: "5px", zIndex: 10, fontSize: "12px", textAlign: "center" }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}
