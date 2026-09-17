"use client";
import React, { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ onScan }: { onScan: (result: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const id = "qr-scanner-" + Math.random().toString(36).slice(2, 9);
    const div = document.createElement("div");
    div.id = id;
    div.style.width = "100%";
    div.style.height = "100%";
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(div);
    }

    let isDestroyed = false;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { 
        fps: 20, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      (text: string) => {
        if (!isDestroyed) {
          onScanRef.current(text);
        }
      },
      () => {}
    ).catch(err => {
      if (!isDestroyed) {
        console.warn("Scanner camera access warning:", err);
      }
    });

    return () => {
      isDestroyed = true;
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
            }).catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch (e) {}
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "280px", background: "#000" }} />
  );
}
