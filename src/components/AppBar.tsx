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
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Online / Offline listener
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

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

    

    const fetchUnread = async () => {
      if (!user?.id) return;
      try {
        const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
        if (count !== null) setUnreadCount(count);
      } catch (e) {}
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
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  return (
    <>
      {/* Main App Bar Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
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

        {/* Center: Live Clock, Connection Status & Developer Stamp */}
        <div style={{ flex: 1.5, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 5px" }}>
          <div style={{ fontSize: "15px", fontWeight: "bold", color: "#4CAF50", fontFamily: "monospace", letterSpacing: "1px", whiteSpace: "nowrap" }}>
            {timeStr}
          </div>
          <div style={{ fontSize: "10px", color: "#ccc", marginTop: "2px", whiteSpace: "nowrap" }}>
            {dateStr}
          </div>

          {/* Elegant Connection Status Badge (شارة الاتصال الأنيقة) */}
          <div 
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "4px",
              background: isOnline ? "rgba(76, 175, 80, 0.12)" : "rgba(244, 67, 54, 0.16)",
              border: `1px solid ${isOnline ? "rgba(76, 175, 80, 0.3)" : "rgba(244, 67, 54, 0.4)"}`,
              padding: "2px 10px",
              borderRadius: "12px",
              fontSize: "10px",
              color: isOnline ? "#81C784" : "#EF5350",
              fontWeight: "bold",
              transition: "all 0.3s ease",
              boxShadow: isOnline ? "0 0 8px rgba(76, 175, 80, 0.15)" : "0 0 8px rgba(244, 67, 54, 0.25)"
            }}
            title={isOnline ? "أنت متصل بالإنترنت، البيانات متزامنة" : "أنت غير متصل، التطبيق يعمل بكفاءة في وضع عدم الاتصال"}
          >
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: isOnline ? "#4CAF50" : "#F44336",
              boxShadow: isOnline ? "0 0 6px #4CAF50" : "0 0 6px #F44336",
              display: "inline-block"
            }} />
            <span>{isOnline ? "متصل بالإنترنت" : "غير متصل (أوفلاين)"}</span>
          </div>

          <div style={{ fontSize: "8px", color: "#777", marginTop: "3px", whiteSpace: "nowrap" }}>
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
            padding: "7px 20px",
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
