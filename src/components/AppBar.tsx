"use client";

import { useEffect, useState } from "react";

interface AppBarProps {
  user: any;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

export default function AppBar({ user, onOpenSettings, onOpenProfile }: AppBarProps) {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
      setDateStr(
        now.toLocaleDateString("ar-EG", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);

    // SW Registration and Version Check
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service Worker registration failed: ', err);
      });
    }

    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        const data = await res.json();
        const currentVersion = localStorage.getItem('appVersion');
        if (currentVersion && currentVersion !== data.version) {
          alert('تم تحديث النظام إلى إصدار جديد! (' + data.version + ')\nيرجى إعادة تحميل الصفحة.');
        }
        localStorage.setItem('appVersion', data.version);
      } catch (err) {
        console.error('Version check failed:', err);
      }
    };
    checkVersion();

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px",
        background: "rgba(0,0,0,0.5)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        direction: "rtl",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      {/* Right: Profile Button */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", overflow: "hidden" }}>
        <button
          onClick={onOpenProfile}
          style={{
            background: "rgba(33, 150, 243, 0.15)",
            border: "1px solid rgba(33, 150, 243, 0.3)",
            color: "white",
            padding: "8px 14px",
            borderRadius: "25px",
            fontSize: "13px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            margin: 0,
            maxWidth: "100%",
            transition: "all 0.3s ease",
          }}
        >
          <span style={{ fontSize: "16px" }}>👤</span> 
          <span style={{ 
            whiteSpace: "nowrap", 
            overflow: "hidden", 
            textOverflow: "ellipsis" 
          }}>
            {user.full_name || (user?.email?.split('@')[0] ?? "مستخدم")}
          </span>
        </button>
      </div>

      {/* Center: Live Clock & Developer Stamp */}
      <div style={{ flex: 1.5, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 5px" }}>
        <div style={{ fontSize: "15px", fontWeight: "bold", color: "#4CAF50", fontFamily: "monospace", letterSpacing: "1px", whiteSpace: "nowrap" }}>
          {timeStr}
        </div>
        <div style={{ fontSize: "10px", color: "#ccc", marginTop: "3px", whiteSpace: "nowrap" }}>
          {dateStr}
        </div>
        <div style={{ fontSize: "9px", color: "#888", marginTop: "4px", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "10px", whiteSpace: "nowrap" }}>
          مطور النظام: د/ إسلام عبد اللطيف
        </div>
      </div>

      {/* Left: Settings Button */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onOpenSettings}
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#e0e0e0",
            padding: "8px 14px",
            borderRadius: "25px",
            fontSize: "13px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            margin: 0,
            transition: "all 0.3s ease",
          }}
        >
          <span style={{ fontSize: "16px" }}>⚙️</span> 
          <span>إعدادات</span>
        </button>
      </div>
    </div>
  );
}
