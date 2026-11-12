import { useState, useEffect } from "react";
import { supabase } from "@/lib/core/supabase";
import { Bell, BellOff, X } from "lucide-react";

export default function NotificationsModal({ isOpen, onClose, user }: { isOpen: boolean; onClose: () => void; user: any }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
    }
  }, [isOpen, user]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setNotifications(data);

      // Mark as read immediately when viewed
      const unreadIds = data.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
      }
    }
    setLoading(false);
  };

  const clearAll = async () => {
    if (confirm("هل أنت متأكد من حذف جميع الإشعارات؟")) {
      setNotifications([]);
      await supabase.from("notifications").delete().eq("user_id", user.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(6, 9, 15, 0.85)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          padding: "20px",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "460px",
          border: "1px solid var(--border-light)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "12px",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0, color: "var(--text)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={18} strokeWidth={1.5} style={{ color: "var(--accent-ink)" }} />
            <span>الإشعارات</span>
          </h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={clearAll}
              className="btn-compact"
              style={{
                background: "transparent",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "var(--error-ink)",
                borderRadius: "8px",
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              مسح الكل
            </button>
            <button onClick={onClose} className="modal-close-btn" title="إغلاق">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", direction: "rtl" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "13px" }}>جاري التحميل</div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", fontSize: "13px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <BellOff size={32} strokeWidth={1.5} style={{ opacity: 0.6 }} />
              <span>لا توجد إشعارات حالياً</span>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  background: n.is_read ? "var(--bg-deep)" : "rgba(16, 185, 129, 0.08)",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  borderRight: n.is_read ? "1px solid var(--border)" : "3px solid var(--success)",
                }}
              >
                <h4 style={{ margin: "0 0 4px 0", color: n.is_read ? "var(--text-secondary)" : "var(--success-ink)", fontSize: "14px", fontWeight: 600 }}>
                  {n.title}
                </h4>
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5 }}>{n.message}</p>
                <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", textAlign: "left" }}>
                  {new Date(n.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
