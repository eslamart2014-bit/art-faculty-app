"use client";
import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    Html5Qrcode: any;
  }
}

export default function QRScanner({ onScan }: { onScan: (result: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    // Dynamically load html5-qrcode from CDN to avoid SSR issues
    if (typeof window === 'undefined') return;

    const id = "qr-scanner-" + Math.random().toString(36).slice(2);
    const div = document.createElement('div');
    div.id = id;
    div.style.width = '100%';
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(div);
    }

    const startScanner = () => {
      if (!window.Html5Qrcode) return;
      try {
        const scanner = new window.Html5Qrcode(id);
        scannerRef.current = scanner;
        scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text: string) => { onScanRef.current(text); },
          () => {}
        ).catch(console.error);
      } catch (e) {
        console.error('Scanner init error:', e);
      }
    };

    if (window.Html5Qrcode) {
      setTimeout(startScanner, 100);
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.onload = () => setTimeout(startScanner, 100);
      document.head.appendChild(script);
    }

    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch (e) {}
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", minHeight: "280px", background: "#000" }} />
  );
}
