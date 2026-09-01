"use client";

import { useEffect, useState } from "react";
import { processQueue, getQueue } from "@/lib/syncEngine";

export default function OfflineSyncManager() {
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const updateCount = () => setQueueCount(getQueue().length);
    updateCount();
    
    window.addEventListener('offlineQueueUpdated', updateCount);

    const handleOnline = async () => {
      const q = getQueue();
      if (q.length > 0) {
        const toast = document.createElement("div");
        toast.innerText = "🔄 جاري مزامنة البيانات المعلقة...";
        toast.style.position = "fixed";
        toast.style.top = "20px";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.background = "#2196F3";
        toast.style.color = "#fff";
        toast.style.padding = "10px 20px";
        toast.style.borderRadius = "20px";
        toast.style.zIndex = "9999";
        toast.style.fontSize = "14px";
        document.body.appendChild(toast);

        const res = await processQueue();
        
        if (res.success && res.count > 0) {
          toast.innerText = `✅ تمت مزامنة ${res.count} عمليات بنجاح!`;
          toast.style.background = "#4CAF50";
          
          // Try to refresh current view data
          window.dispatchEvent(new Event('refreshData'));
        } else {
          toast.style.display = "none";
        }
        
        setTimeout(() => {
          if (document.body.contains(toast)) document.body.removeChild(toast);
        }, 3000);
      }
    };

    window.addEventListener('online', handleOnline);

    // Initial check on mount
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('offlineQueueUpdated', updateCount);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (queueCount === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "20px",
      right: "20px",
      background: "#FF9800",
      color: "#fff",
      padding: "10px 15px",
      borderRadius: "30px",
      fontSize: "12px",
      zIndex: 9990,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      animation: "pulse 2s infinite"
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}} />
      ⚠️ {queueCount} عمليات معلقة بانتظار الإنترنت
    </div>
  );
}
