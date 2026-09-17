"use client";

import { useEffect, useState } from "react";

// MED-1 FIX: Module-level flag to prevent double-reload race condition
// (shared across SW_UPDATED message + controllerchange event + version checker)
let _reloading = false;

function safeReload() {
  if (_reloading) return;
  _reloading = true;
  window.location.reload();
}

export default function ServiceWorkerRegister() {
  const [updateProgress, setUpdateProgress] = useState(0);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Register SW
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Force immediate check for SW updates
      reg.update().catch(() => {});
    }).catch(console.error);

    // Listen for SW updates message — use safeReload to prevent double reload
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        setShowUpdateBanner(true);
        setUpdateProgress(100);
        setTimeout(() => safeReload(), 800);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // controllerchange can fire alongside SW_UPDATED — safeReload prevents double reload
    const handleControllerChange = () => {
      safeReload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Version Checker
    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        const stored = localStorage.getItem('appVersion');

        if (stored && stored !== data.version) {
          // Already reloading? skip
          if (_reloading) return;
          setShowUpdateBanner(true);
          let progress = 0;
          const progressInterval = setInterval(() => {
            progress += 10;
            setUpdateProgress(progress);
            if (progress >= 100) {
              clearInterval(progressInterval);
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.active?.postMessage('CLEAR_CACHE');
                });
              }
              caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
                localStorage.setItem('appVersion', data.version);
                safeReload();
              });
            }
          }, 50);
        } else {
          localStorage.setItem('appVersion', data.version);
        }
      } catch (e) {}
    };

    checkVersion();
    const versionInterval = setInterval(checkVersion, 60000); // Check every minute

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      clearInterval(versionInterval);
    };
  }, []);

  if (!showUpdateBanner) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.94)", zIndex: 999999,
      display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      direction: "rtl"
    }}>
      <div style={{ fontSize: "50px", marginBottom: "20px" }}>🔄</div>
      <div style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
        جاري تحديث النظام وتثبيت أحدث حزمة...
      </div>
      <div style={{ color: "#aaa", fontSize: "14px", marginBottom: "30px" }}>
        يرجى الانتظار لحظة واحدة فقط
      </div>
      <div style={{ width: "80%", maxWidth: "300px", background: "#333", borderRadius: "10px", height: "12px", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "10px",
          background: "linear-gradient(90deg, #2196F3, #4CAF50)",
          width: updateProgress + "%",
          transition: "width 0.05s linear"
        }} />
      </div>
      <div style={{ color: "#4CAF50", marginTop: "12px", fontSize: "13px", fontWeight: "bold" }}>{updateProgress}%</div>
    </div>
  );
}
