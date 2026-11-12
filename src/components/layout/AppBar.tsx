"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/core/supabase";
import NotificationsModal from "@/components/layout/NotificationsModal";
import { getTermAndWeekInfo } from "@/lib/core/termHelper";
import { User, Bell, Settings, Calendar } from "lucide-react";

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
          padding: "12px 20px",
          background: "var(--bg-deep)",
          borderBottom: "1px solid var(--border)",
          direction: "rtl",
        }}
      >
        {/* Right: Profile Button */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", overflow: "hidden" }}>
          <button
            onClick={onOpenProfile}
            className="btn-compact"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              color: "var(--text)",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              margin: 0,
              maxWidth: "100%",
              transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <User size={16} strokeWidth={1.5} style={{ color: "var(--accent-ink)", flexShrink: 0 }} />
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
        <div style={{ flex: 1.5, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 8px" }}>
          <div className="tabular-nums" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>
            {timeStr}
          </div>
          <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", whiteSpace: "nowrap" }}>
            {dateStr}
          </div>

          <div 
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "4px",
              background: isOnline ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.12)",
              border: `1px solid ${isOnline ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.3)"}`,
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              color: isOnline ? "var(--success-ink)" : "var(--error-ink)",
              fontWeight: 500,
              transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            title={isOnline ? "أنت متصل بالإنترنت، البيانات متزامنة" : "أنت غير متصل، التطبيق يعمل في وضع عدم الاتصال"}
          >
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: isOnline ? "var(--success)" : "var(--error)",
              display: "inline-block"
            }} />
            <span>{isOnline ? "متصل" : "غير متصل"}</span>
          </div>

          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", whiteSpace: "nowrap" }}>
            مطور النظام: د/ إسلام عبد اللطيف
          </div>
        </div>

        {/* Left: Settings Button & Notifications */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={() => { setIsNotificationsOpen(true); setUnreadCount(0); }}
            className="icon-btn"
            aria-label="الإشعارات"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              color: "var(--text-secondary)",
              width: "36px",
              height: "36px",
              padding: "0",
              borderRadius: "8px",
              cursor: "pointer",
              position: "relative"
            }}
          >
            <Bell size={16} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="tabular-nums" style={{ position: "absolute", top: "-4px", right: "-4px", background: "var(--error)", color: "#fff", fontSize: "10px", minWidth: "16px", height: "16px", padding: "0 4px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className="btn-compact"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              color: "var(--text)",
              padding: "8px 12px",
              height: "36px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              margin: 0,
              transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <Settings size={16} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
            <span className="hide-on-mobile">الإعدادات</span>
          </button>
        </div>
      </div>

      {/* Term Bar */}
      {termStr && (
        <div
          style={{
            width: "100%",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "8px 20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            direction: "rtl",
          }}
        >
          <div
            className="tabular-nums"
            style={{
              background: "rgba(16, 185, 129, 0.1)",
              color: "var(--success-ink)",
              border: "1px solid rgba(16, 185, 129, 0.22)",
              padding: "4px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Calendar size={14} strokeWidth={1.5} />
            <span>{termStr}</span>
          </div>
        </div>
      )}

      <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} user={user} />
    </>
  );
}
