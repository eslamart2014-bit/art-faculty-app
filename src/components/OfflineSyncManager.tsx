"use client";

import { useEffect, useRef, useState } from "react";
import { processQueue, getQueue } from "@/lib/syncEngine";

export default function OfflineSyncManager() {
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // HIGH-2 FIX: Use useRef instead of useState so the guard is never stale inside closures
  const isSyncingRef = useRef(false);

  const runSync = async () => {
    // Check ref (never stale) instead of state variable
    if (isSyncingRef.current || !navigator.onLine) return;
    const q = getQueue();
    if (q.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    // LOW-3 FIX: Use React state for toast instead of direct DOM manipulation
    let toastEl: HTMLDivElement | null = null;
    try {
      // Still use DOM for toast since it's outside React tree (overlay) — but cleanly
      toastEl = document.createElement("div");
      Object.assign(toastEl.style, {
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#2196F3",
        color: "#fff",
        padding: "10px 24px",
        borderRadius: "25px",
        zIndex: "99999",
        fontSize: "14px",
        fontWeight: "bold",
        boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
      });
      toastEl.innerText = "🔄 جاري مزامنة العمليات المعلقة...";
      document.body.appendChild(toastEl);

      const res = await processQueue();
      if (res.success && res.count > 0) {
        toastEl.innerText = `✅ تمت مزامنة ${res.count} عملية معلقة بنجاح!`;
        toastEl.style.background = "#4CAF50";
        window.dispatchEvent(new Event('refreshData'));
      } else {
        if (toastEl && document.body.contains(toastEl)) document.body.removeChild(toastEl);
        toastEl = null;
      }
    } catch (e) {
      if (toastEl) {
        toastEl.innerText = "⚠️ تعذر استكمال المزامنة، سيتم المحاولة مجدداً.";
        toastEl.style.background = "#f44336";
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      if (toastEl) {
        setTimeout(() => {
          if (toastEl && document.body.contains(toastEl)) document.body.removeChild(toastEl);
        }, 3000);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const updateCount = () => {
      if (mounted) setQueueCount(getQueue().length);
    };
    updateCount();

    window.addEventListener('offlineQueueUpdated', updateCount);

    const handleOnline = () => { runSync(); };
    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      runSync();
    }

    // Periodic check every 15 seconds if queue has items and online
    const interval = setInterval(() => {
      if (navigator.onLine && getQueue().length > 0) {
        runSync();
      }
    }, 15000);

    return () => {
      mounted = false;
      window.removeEventListener('offlineQueueUpdated', updateCount);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (queueCount === 0) return null;

  return (
    <div 
      onClick={runSync}
      title="اضغط للمزامنة الفورية الآن"
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "linear-gradient(135deg, #FF9800, #F57C00)",
        color: "#fff",
        padding: "10px 18px",
        borderRadius: "30px",
        fontSize: "13px",
        fontWeight: "bold",
        zIndex: 9990,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 4px 15px rgba(255, 152, 0, 0.4)",
        cursor: "pointer",
        animation: "pulse 2s infinite"
      }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}} />
      <span>🔄</span>
      <span>{queueCount} عملية معلقة {isSyncing ? "(جاري المزامنة...)" : "(اضغط للمزامنة)"}</span>
    </div>
  );
}
