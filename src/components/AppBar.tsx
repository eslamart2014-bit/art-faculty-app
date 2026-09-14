"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NotificationsModal from "./NotificationsModal";
import { getTermAndWeekInfo } from "@/lib/termHelper";

interface AppBarProps {
  user: any;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  refreshTrigger?: number;
}

export default function AppBar({ user, onOpenSettings, onOpenProfile, refreshTrigger }: AppBarProps) {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [termStr, setTermStr] = useState<string>("");

  const [updateProgress, setUpdateProgress] = useState(0);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Time and Date interval
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

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          setShowUpdateBanner(true);
          setUpdateProgress(100);
          setTimeout(() => window.location.reload(), 1000);
        }
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Force update check
    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        const data = await res.json();
        const stored = localStorage.getItem('appVersion');
        if (stored && stored !== data.version) {
          setShowUpdateBanner(true);
          let progress = 0;
          const interval = setInterval(() => {
            progress += 5;
            setUpdateProgress(progress);
            if (progress >= 100) {
              clearInterval(interval);
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.active?.postMessage('CLEAR_CACHE');
                });
              }
              caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
                localStorage.setItem('appVersion', data.version);
                window.location.reload();
              });
            }
          }, 80);
        } else {
          localStorage.setItem('appVersion', data.version);
        }
      } catch (err) {
        console.error('Version check failed:', err);
      }
    };
    checkVersion();

    const fetchUnread = async () => {
      if (!user?.id) return;
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
      if (count !== null) setUnreadCount(count);
    };
    fetchUnread();
    const notifInterval = setInterval(fetchUnread, 30000);

    return () => { 
      clearInterval(interval); 
      clearInterval(notifInterval); 
    };
  }, [user]);

  // Fetch Term info on mount and on refreshTrigger
  useEffect(() => {
    let isMounted = true;
    getTermAndWeekInfo().then((info) => {
      if (isMounted && info) {
        setTermStr(info);
      }
    }).catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  return (
    <>
      {/* Force Update Banner */}
      {showUpdateBanner && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.92)", zIndex: 99999,
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          direction: "rtl"
        }}>
          <div style={{ fontSize: "50px", marginBottom: "20px" }}>🔄</div>
          <div style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
            جاري تحديث التطبيق...
          </div>
          <div style={{ color: "#aaa", fontSize: "14px", marginBottom: "30px" }}>
            يرجى الانتظار لحظة واحدة
          </div>
          <div style={{ width: "80%", maxWidth: "300px", background: "#333", borderRadius: "10px", height: "12px", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "10px",
              background: "linear-gradient(90deg, #2196F3, #4CAF50)",
              width: updateProgress + "%",
              transition: "width 0.08s linear"
            }} />
          </div>
          <div style={{ color: "#4CAF50", marginTop: "12px", fontSize: "13px" }}>{updateProgress}%</div>
        </div>
      )}

      {/* Main App Bar Header */}
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

        {/* Left: Settings Button & Notifications */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            onClick={() => { setIsNotificationsOpen(true); setUnreadCount(0); }}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#e0e0e0",
              padding: "8px",
              borderRadius: "50%",
              fontSize: "16px",
              cursor: "pointer",
              position: "relative"
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: "-2px", right: "-2px", background: "#f44336", color: "#fff", fontSize: "10px", width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                {unreadCount}
              </span>
            )}
          </button>

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
            <span className="hide-on-mobile">إعدادات</span>
          </button>
        </div>
      </div>

      {/* Elegant Term Bar (شريط الترم الأنيق) */}
      {termStr && (
        <div
          style={{
            width: "100%",
            background: "linear-gradient(90deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "8px 20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            direction: "rtl",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              background: "rgba(76, 175, 80, 0.12)",
              color: "#81C784",
              border: "1px solid rgba(76, 175, 80, 0.3)",
              padding: "4px 18px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              letterSpacing: "0.3px",
            }}
          >
            <span>📅</span>
            <span>{termStr}</span>
          </div>
        </div>
      )}

      <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} user={user} />
    </>
  );
}
