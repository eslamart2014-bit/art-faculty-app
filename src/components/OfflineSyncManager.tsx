"use client";

import { useEffect, useState } from "react";
import { processQueue, getQueue } from "@/lib/syncEngine";

export default function OfflineSyncManager() {
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const runSync = async () => {
    if (isSyncing || !navigator.onLine) return;
    const q = getQueue();
    if (q.length === 0) return;

    setIsSyncing(true);
    const toast = document.createElement("div");
    toast.innerText = "🔄 جاري مزامنة العمليات المعلقة...";
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#2196F3";
    toast.style.color = "#fff";
    toast.style.padding = "10px 24px";
    toast.style.borderRadius = "25px";
    toast.style.zIndex = "99999";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "bold";
    toast.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
    document.body.appendChild(toast);

    try {
      const res = await processQueue();
      if (res.success && res.count > 0) {
        toast.innerText = `✅ تمت مزامنة ${res.count} عملية معلقة بنجاح!`;
        toast.style.background = "#4CAF50";
        window.dispatchEvent(new Event('refreshData'));
      } else {
        toast.style.display = "none";
      }
    } catch (e) {
      toast.innerText = "⚠️ تعذر استكمال المزامنة، سيتم المحاولة مجدداً.";
      toast.style.background = "#f44336";
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        if (document.body.contains(toast)) document.body.removeChild(toast);
      }, 3000);
    }
  };

  useEffect(() => {
    const updateCount = () => setQueueCount(getQueue().length);
    updateCount();

    window.addEventListener('offlineQueueUpdated', updateCount);

    const handleOnline = () => {
      runSync();
    };

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
      window.removeEventListener('offlineQueueUpdated', updateCount);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
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
