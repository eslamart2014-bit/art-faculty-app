import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUpdateProfile: (updates: any) => void;
}

const DEGREES = ["م", "م.د", "د", "أ.م.د", "أ.د"];

export default function ProfileModal({ isOpen, onClose, user, onUpdateProfile }: ProfileModalProps) {
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
    const updates = { id: user.id, email: user.email, full_name: fullName, degree: degree };
    
    const { error } = await supabase
      .from("profiles")
      .upsert(updates);
      
    if (!error) {
      onUpdateProfile(updates);
      onClose();
    } else {
      alert("حدث خطأ أثناء حفظ البيانات");
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.8)", zIndex: 1000,
      display: "flex", justifyContent: "center", alignItems: "center"
    }} onClick={onClose}>
      <div style={{
        background: "#1e1e1e", padding: "25px", borderRadius: "15px", width: "90%", maxWidth: "400px",
        direction: "rtl", border: "1px solid #333", position: "relative",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: "absolute", top: "15px", left: "15px",
          background: "none", border: "none", color: "#aaa", fontSize: "20px", cursor: "pointer"
        }}>✕</button>
        
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <div style={{ 
            width: "70px", height: "70px", borderRadius: "50%", background: "var(--primary)", 
            color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", 
            fontSize: "30px", margin: "0 auto 10px auto", boxShadow: "0 4px 10px rgba(0,123,255,0.3)" 
          }}>
            {user.full_name?.charAt(0) || "👤"}
          </div>
          <h2 style={{ margin: 0, color: "#fff", fontSize: "20px" }}>البيانات الشخصية</h2>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", color: "#aaa", fontSize: "13px", marginBottom: "8px" }}>البريد الإلكتروني (لا يمكن تعديله)</label>
          <input 
            type="email" 
            value={user.email} 
            disabled 
            style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#111", border: "1px solid #333", color: "#666", outline: "none", cursor: "not-allowed" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", color: "#aaa", fontSize: "13px", marginBottom: "8px" }}>الدرجة العلمية</label>
          <select 
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#111", border: "1px solid #555", color: "#fff", outline: "none", cursor: "pointer", fontSize: "15px" }}
          >
            {DEGREES.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "30px" }}>
          <label style={{ display: "block", color: "#aaa", fontSize: "13px", marginBottom: "8px" }}>الاسم (يظهر في تقارير PDF)</label>
          <input 
            type="text" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#111", border: "1px solid #555", color: "#fff", outline: "none", fontSize: "15px" }}
            placeholder="الاسم كاملاً"
          />
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          style={{ width: "100%", padding: "14px", borderRadius: "8px", background: "var(--primary)", color: "#fff", border: "none", fontWeight: "bold", fontSize: "16px", cursor: saving ? "not-allowed" : "pointer", transition: "0.2s" }}
        >
          {saving ? "جاري الحفظ..." : "حفظ التعديلات ✅"}
        </button>
      </div>
    </div>
  );
}
