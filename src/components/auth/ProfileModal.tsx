import { useState, useEffect } from "react";
import { supabase } from "@/lib/core/supabase";
import { User, Check, Palette, X } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUpdateProfile: (updates: any) => void;
}

const DEGREES = ["م", "م.د", "د", "أ.م.د", "أ.د"];

export default function ProfileModal({ isOpen, onClose, user, onUpdateProfile }: ProfileModalProps) {
  useEffect(() => {
    window.history.pushState({ modal: true }, "");
  }, []);

  const [fullName, setFullName] = useState("");
  const [degree, setDegree] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setDegree(user.degree || "م");
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    if (!fullName.trim()) {
      alert("يرجى كتابة الاسم");
      return;
    }
    setSaving(true);
    const updates = { id: user.id, email: user.email, full_name: fullName.trim(), degree: degree };
    
    // 1. Try direct Supabase update
    const { error } = await supabase
      .from("profiles")
      .upsert(updates);
      
    if (!error) {
      onUpdateProfile(updates);
      onClose();
    } else {
      // 2. If blocked by RLS (e.g. admin editing user or impersonating), fallback to admin API
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || "";
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            action: "update_user_degree",
            userId: user.id,
            adminId: user.id,
            degree,
            fullName: fullName.trim()
          })
        });
        const resData = await res.json();
        if (resData.success) {
          onUpdateProfile(updates);
          onClose();
        } else {
          alert("حدث خطأ أثناء حفظ البيانات: " + (resData.error || ""));
        }
      } catch (apiErr) {
        alert("حدث خطأ أثناء حفظ البيانات");
      }
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(6, 9, 15, 0.85)", zIndex: 1000,
      display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "400px",
        direction: "rtl", border: "1px solid var(--border-light)", position: "relative",
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)"
      }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose} 
          className="modal-close-btn"
          style={{ position: "absolute", top: "16px", left: "16px" }}
          title="إغلاق"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
        
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ 
            width: "56px", height: "56px", borderRadius: "12px", background: "rgba(37, 99, 235, 0.14)", 
            border: "1px solid rgba(56, 189, 248, 0.25)",
            color: "var(--accent-ink)", display: "flex", justifyContent: "center", alignItems: "center", 
            fontSize: "22px", fontWeight: 600, margin: "0 auto 12px auto"
          }}>
            {user.full_name?.charAt(0) || <User size={24} strokeWidth={1.5} />}
          </div>
          <h2 style={{ margin: 0, color: "var(--text)", fontSize: "18px", fontWeight: 600 }}>البيانات الشخصية</h2>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", marginBottom: "6px" }}>البريد الإلكتروني (غير قابل للتعديل)</label>
          <input 
            type="email" 
            value={user.email} 
            disabled 
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-muted)", outline: "none", cursor: "not-allowed", marginBottom: 0, fontSize: "14px" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", marginBottom: "6px" }}>الدرجة العلمية</label>
          <select 
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text)", outline: "none", cursor: "pointer", fontSize: "14px", marginBottom: 0 }}
          >
            {DEGREES.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", marginBottom: "6px" }}>الاسم (يظهر في تقارير PDF)</label>
          <input 
            type="text" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text)", outline: "none", fontSize: "14px", marginBottom: 0 }}
            placeholder="الاسم كاملاً"
          />
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          style={{ width: "100%", padding: "12px 16px", borderRadius: "8px", background: "var(--primary)", color: "#fff", border: "none", fontWeight: 500, fontSize: "14px", cursor: saving ? "not-allowed" : "pointer", marginBottom: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
        >
          <Check size={16} strokeWidth={1.5} />
          <span>{saving ? "جاري الحفظ" : "حفظ التعديلات"}</span>
        </button>

        <button 
          onClick={() => {
            if (user?.id) {
              try {
                localStorage.setItem("fania_active_instructor_id", user.id);
              } catch (e) {}
            }
            window.open(`/instructor${user?.id ? `?instructor_id=${user.id}` : ''}`, "_blank");
          }}
          style={{ width: "100%", padding: "12px 16px", borderRadius: "8px", background: "var(--surface-hover)", color: "var(--accent-ink)", border: "1px solid var(--border-light)", fontWeight: 500, fontSize: "14px", cursor: "pointer", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
        >
          <Palette size={16} strokeWidth={1.5} />
          <span>بوابة أعمال مقرراتي (المعرض والبحث)</span>
        </button>
      </div>
    </div>
  );
}
