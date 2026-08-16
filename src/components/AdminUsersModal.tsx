import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUser: any;
  onImpersonate: (user: any) => void;
}

export default function AdminUsersModal({ isOpen, onClose, adminUser, onImpersonate }: AdminUsersModalProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && adminUser) {
      fetchData();
    }
  }, [isOpen, adminUser]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch registered profiles
    const { data: profilesData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (profilesData) setUsers(profilesData);

    // Fetch pending invitations
    const { data: invData } = await supabase.from("invitations").select("*").eq("status", "pending").order("created_at", { ascending: false });
    if (invData) setInvitations(invData);
    
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();
    setInviting(true);
    
    // Check if the user is already fully registered in profiles
    const { data: profileCheck } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    
    if (profileCheck) {
      alert("هذا المستخدم مسجل بالفعل في النظام!");
      setInviting(false);
      return;
    }

    // Upsert invitation (if it existed as completed but they have no profile, reset to pending)
    const { error } = await supabase.from("invitations").upsert(
      { email: email, created_by: adminUser.id, status: "pending" },
      { onConflict: "email" }
    );

    if (error) {
      alert("حدث خطأ أثناء الدعوة: " + error.message);
    } else {
      setInviteEmail("");
      fetchData();
    }
    setInviting(false);
  };

  const handleToggleSuspend = async (user: any) => {
    const newStatus = !user.is_suspended;
    await supabase.from("profiles").update({ is_suspended: newStatus }).eq("id", user.id);
    fetchData();
    setActiveMenuId(null);
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`هل أنت متأكد من حذف الحساب نهائياً؟\nالاسم: ${user.full_name}`)) return;
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_user', userId: user.id, adminId: adminUser.id })
      });
      const data = await res.json();
      if (data.success) {
        alert("تم الحذف بنجاح");
        fetchData();
      } else {
        alert("خطأ: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ في الاتصال");
    }
    setActiveMenuId(null);
  };

  const handleChangePassword = async (user: any) => {
    const newPass = prompt(`أدخل كلمة المرور الجديدة للحساب:\n${user.email}`);
    if (!newPass) return;
    if (newPass.length < 6) {
      alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', userId: user.id, newPassword: newPass, adminId: adminUser.id })
      });
      const data = await res.json();
      if (data.success) {
        alert(`تم تغيير كلمة المرور بنجاح إلى:\n${newPass}\n\nيرجى إعطاؤها للمستخدم.`);
        fetchData(); // to clear locks if any
      } else {
        alert("خطأ: " + data.error);
      }
    } catch (err) {
      alert("حدث خطأ في الاتصال");
    }
    setActiveMenuId(null);
  };

  const handleUnlock = async (user: any) => {
    await supabase.from("profiles").update({ failed_attempts: 0, locked_until: null }).eq("id", user.id);
    alert("تم فك القفل عن الحساب!");
    fetchData();
    setActiveMenuId(null);
  };

  const handleImpersonate = (user: any) => {
    if (user.role === 'مدير') {
      alert("لا يمكن تصفح حساب مدير آخر!");
      return;
    }
    onImpersonate(user);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.85)", zIndex: 1000,
      display: "flex", flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px", background: "#1e1e1e", borderBottom: "1px solid #333", direction: "rtl" }}>
        <h2 style={{ margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
          <span>🛡️</span> إدارة المستخدمين والزملاء
        </h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: "24px", cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto", direction: "rtl" }}>
        
        {/* Invite Colleague */}
        <div style={{ background: "#222", padding: "15px", borderRadius: "10px", border: "1px solid #333", marginBottom: "25px" }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#fff", fontSize: "16px" }}>إضافة زميل جديد</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <input 
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="البريد الإلكتروني للزميل (Gmail)"
              style={{ flexGrow: 1, padding: "10px", borderRadius: "8px", background: "#111", border: "1px solid #444", color: "#fff", outline: "none" }}
            />
            <button 
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              style={{ background: "#4CAF50", color: "#fff", border: "none", padding: "0 20px", borderRadius: "8px", cursor: (inviting || !inviteEmail) ? "not-allowed" : "pointer", fontWeight: "bold" }}
            >
              {inviting ? "جاري الإضافة..." : "دعوة"}
            </button>
          </div>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div style={{ marginBottom: "25px" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#aaa", fontSize: "14px" }}>دعوات في انتظار التسجيل ({invitations.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {invitations.map(inv => (
                <div key={inv.id} style={{ background: "rgba(255, 152, 0, 0.1)", border: "1px solid rgba(255, 152, 0, 0.3)", padding: "12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#fff", fontSize: "14px" }}>{inv.email}</span>
                  <span style={{ color: "#FF9800", fontSize: "12px", fontWeight: "bold" }}>⏳ قيد الانتظار</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered Users */}
        <div>
          <h3 style={{ margin: "0 0 15px 0", color: "#aaa", fontSize: "14px" }}>الحسابات المسجلة ({users.length})</h3>
          
          {loading ? (
            <div style={{ textAlign: "center", color: "#888", padding: "20px" }}>جاري التحميل...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {users.map(u => {
                const isLocked = u.locked_until && new Date(u.locked_until) > new Date();
                
                const getLastSeen = (dateStr: string | null) => {
                  if (!dateStr) return null;
                  const diffMins = (new Date().getTime() - new Date(dateStr).getTime()) / 1000 / 60;
                  if (diffMins < 5) return <span style={{ fontSize: "11px", color: "#4CAF50" }}>🟢 نشط الآن</span>;
                  if (diffMins < 60) return <span style={{ fontSize: "11px", color: "#FF9800" }}>🟠 نشط منذ {Math.floor(diffMins)} دقيقة</span>;
                  if (diffMins < 24 * 60) return <span style={{ fontSize: "11px", color: "#9e9e9e" }}>⚪ نشط منذ {Math.floor(diffMins / 60)} ساعة</span>;
                  return <span style={{ fontSize: "11px", color: "#757575" }}>⚪ أخر ظهور: {new Date(dateStr).toLocaleDateString('ar-EG')}</span>;
                };

                return (
                  <div key={u.id} style={{ position: "relative" }}>
                    <div 
                      onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                      style={{ 
                        background: u.is_suspended ? "#3a2020" : "#222", 
                        border: `1px solid ${u.is_suspended ? "#f44336" : "#333"}`, 
                        padding: "15px", 
                        borderRadius: "10px", 
                        cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontWeight: "bold", marginBottom: "4px" }}>
                          {u.degree && <span style={{ color: "#4CAF50" }}>{u.degree}</span>}
                          {u.full_name || "بدون اسم"}
                          {u.role === 'مدير' && <span style={{ background: "#2196F3", fontSize: "10px", padding: "2px 5px", borderRadius: "4px" }}>مدير</span>}
                          {isLocked && <span style={{ background: "#f44336", fontSize: "10px", padding: "2px 5px", borderRadius: "4px" }}>🔒 مقفول</span>}
                        </div>
                        <div style={{ color: "#888", fontSize: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                          <span>{u.email}</span>
                          {getLastSeen(u.last_seen)}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: "20px", color: "#888" }}>⋮</div>
                    </div>

                    {/* Options Menu */}
                    {activeMenuId === u.id && (
                      <div style={{
                        background: "#1a1a1a", border: "1px solid #444", borderRadius: "8px", padding: "10px",
                        marginTop: "5px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", animation: "slideDown 0.2s"
                      }}>
                        <button onClick={() => handleChangePassword(u)} style={{ background: "#333", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                          🔑 تغيير كلمة المرور
                        </button>
                        
                        <button onClick={() => handleToggleSuspend(u)} style={{ background: "#333", color: u.is_suspended ? "#4CAF50" : "#FF9800", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                          {u.is_suspended ? "▶️ تفعيل الحساب" : "⏸️ إيقاف مؤقت"}
                        </button>

                        {isLocked && (
                          <button onClick={() => handleUnlock(u)} style={{ background: "#333", color: "#4CAF50", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", gridColumn: "1 / -1" }}>
                            🔓 فك قفل الحساب وإعطاء محاولات جديدة
                          </button>
                        )}

                        <button onClick={() => handleImpersonate(u)} style={{ background: "#2196F3", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>
                          🎭 الدخول كـ {u.full_name}
                        </button>
                        
                        <button onClick={() => handleDeleteUser(u)} style={{ background: "transparent", color: "#f44336", border: "1px solid #f44336", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                          🗑️ حذف نهائي
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
