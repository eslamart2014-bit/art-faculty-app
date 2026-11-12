import { useState } from "react";
import { supabase } from "@/lib/core/supabase";
import { Eye, EyeOff, Lock, Trash2, X } from "lucide-react";

interface PasswordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail: string;
}

export default function PasswordConfirmModal({ isOpen, onClose, onConfirm, userEmail }: PasswordConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleVerify = async () => {
    if (!password) {
      setError("الرجاء إدخال كلمة المرور");
      return;
    }
    setLoading(true);
    setError("");

    // We verify the password by attempting to sign in with a temporary client
    // that does NOT persist the session, so it doesn't log out the admin/current user.
    const { createClient } = await import("@supabase/supabase-js");
    const tempClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error: signInError } = await tempClient.auth.signInWithPassword({
      email: userEmail,
      password: password,
    });

    setLoading(false);

    if (signInError) {
      setError("كلمة المرور غير صحيحة.");
    } else {
      // Password is correct! Proceed to confirm and close.
      setPassword("");
      onConfirm();
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(6, 9, 15, 0.85)", zIndex: 9999,
      display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "360px",
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
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "var(--error-ink)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Lock size={22} strokeWidth={1.5} />
          </div>
          <h3 style={{ margin: 0, color: "var(--text)", fontSize: "16px", fontWeight: 600 }}>تأكيد الهوية</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "6px", lineHeight: 1.5, marginBottom: 0 }}>
            إجراء الحذف النهائي لا يمكن التراجع عنه. أدخل كلمة المرور الخاصة بحسابك للتأكيد.
          </p>
        </div>

        {error && <div style={{ color: "var(--error-ink)", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>{error}</div>}

        <div style={{ position: "relative", width: "100%", marginBottom: "16px" }}>
          <input 
            type={showPassword ? "text" : "password"} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            style={{ width: "100%", padding: "10px 12px", paddingLeft: "40px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text)", outline: "none", fontSize: "14px", boxSizing: "border-box", marginBottom: 0 }}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="icon-btn"
            style={{
              position: "absolute",
              left: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "auto",
              margin: 0
            }}
            title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          >
            {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
          </button>
        </div>

        <button 
          onClick={handleVerify}
          disabled={loading}
          style={{ width: "100%", padding: "12px 16px", borderRadius: "8px", background: "var(--danger)", color: "#fff", border: "none", fontWeight: 500, fontSize: "14px", cursor: loading ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <Trash2 size={16} strokeWidth={1.5} />
          <span>{loading ? "جاري التحقق" : "تأكيد الحذف النهائي"}</span>
        </button>
      </div>
    </div>
  );
}
