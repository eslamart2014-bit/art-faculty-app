import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center"
    }} onClick={onClose}>
      <div style={{ background: "#222", padding: "20px", borderRadius: "15px", width: "90%", maxWidth: "450px", border: "1px solid #444", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "15px", marginBottom: "15px" }}>
          <h2 style={{ margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>🔔</span> الإشعارات
          </h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={clearAll} style={{ background: "transparent", border: "1px solid #f44336", color: "#f44336", borderRadius: "5px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" }}>مسح الكل</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: "20px", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "5px", direction: "rtl" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#888" }}>جاري التحميل...</div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#888" }}>
              <div style={{ fontSize: "40px", marginBottom: "10px", opacity: 0.5 }}>📭</div>
              لا توجد إشعارات حالياً
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} style={{ background: n.is_read ? "#1a1a1a" : "#2a3b2c", padding: "15px", borderRadius: "8px", borderLeft: n.is_read ? "none" : "4px solid #4CAF50" }}>
                <h4 style={{ margin: "0 0 5px 0", color: n.is_read ? "#aaa" : "#4CAF50", fontSize: "15px" }}>{n.title}</h4>
                <p style={{ margin: 0, color: "#ccc", fontSize: "13px", lineHeight: "1.5" }}>{n.message}</p>
                <div style={{ fontSize: "10px", color: "#666", marginTop: "10px", textAlign: "left" }}>
                  {new Date(n.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
