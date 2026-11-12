"use client";

import { useEffect, useRef, useState } from "react";
import { processQueue, getQueue } from "@/lib/admin/syncEngine";
import { RefreshCw } from "lucide-react";

export default function OfflineSyncManager() {
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const isSyncingRef = useRef(false);

  const runSync = async () => {
    if (isSyncingRef.current || !navigator.onLine) return;
    const q = getQueue();
    if (q.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    let toastEl: HTMLDivElement | null = null;
    try {
      toastEl = document.createElement("div");
      Object.assign(toastEl.style, {
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#151b26",
        color: "#eef0f5",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        padding: "8px 16px",
        borderRadius: "8px",
        zIndex: "99999",
        fontSize: "13px",
        fontWeight: "500",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
      });
      toastEl.innerText = "جاري مزامنة العمليات المعلقة";
      document.body.appendChild(toastEl);

      const res = await processQueue();
      if (res.success && res.count > 0) {
        toastEl.innerText = `تمت مزامنة ${res.count} عملية معلقة`;
        toastEl.style.borderColor = "rgba(16, 185, 129, 0.45)";
        toastEl.style.color = "#34d399";
        window.dispatchEvent(new Event("refreshData"));
      } else {
        if (toastEl && document.body.contains(toastEl)) document.body.removeChild(toastEl);
        toastEl = null;
      }
    } catch (e) {
      if (toastEl) {
        toastEl.innerText = "تعذر استكمال المزامنة، سيتم المحاولة مجدداً";
        toastEl.style.borderColor = "rgba(239, 68, 68, 0.45)";
        toastEl.style.color = "#f87171";
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

    window.addEventListener("offlineQueueUpdated", updateCount);

    const handleOnline = () => {
      runSync();
    };
    window.addEventListener("online", handleOnline);

    if (navigator.onLine) {
      runSync();
    }

    const interval = setInterval(() => {
      if (navigator.onLine && getQueue().length > 0) {
        runSync();
      }
    }, 15000);

    return () => {
      mounted = false;
      window.removeEventListener("offlineQueueUpdated", updateCount);
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (queueCount === 0) return null;

  return (
    <button
      type="button"
      onClick={runSync}
      title="اضغط للمزامنة الفورية"
      className="btn-compact tabular-nums"
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        background: "var(--surface)",
        color: "var(--warning-ink)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        padding: "8px 16px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 500,
        zIndex: 9990,
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 8px 20px rgba(0, 0, 0, 0.35)",
        cursor: "pointer",
      }}
    >
      <RefreshCw size={16} strokeWidth={1.5} className={isSyncing ? "animate-spin" : ""} />
      <span>{queueCount} عملية معلقة {isSyncing ? "(جاري المزامنة)" : "(اضغط للمزامنة)"}</span>
    </button>
  );
}
