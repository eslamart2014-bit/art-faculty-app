import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface PasswordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail: string;
}

export default function PasswordConfirmModal({ isOpen, onClose, onConfirm, userEmail }: PasswordConfirmModalProps) {
  const [password, setPassword] = useState("");
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
      background: "rgba(0,0,0,0.8)", zIndex: 9999,
      display: "flex", justifyContent: "center", alignItems: "center"
    }} onClick={onClose}>
      <div style={{
        background: "#1e1e1e", padding: "25px", borderRadius: "15px", width: "90%", maxWidth: "350px",
        direction: "rtl", border: "1px solid #444", position: "relative"
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: "absolute", top: "15px", left: "15px",
          background: "none", border: "none", color: "#aaa", fontSize: "20px", cursor: "pointer"
        }}>✕</button>
        
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>🔒</div>
          <h3 style={{ margin: 0, color: "#fff" }}>تأكيد الهوية</h3>
          <p style={{ color: "#aaa", fontSize: "12px", marginTop: "5px" }}>
            إجراء الحذف النهائي لا يمكن التراجع عنه. الرجاء إدخال كلمة المرور الخاصة بحسابك للتأكيد.
          </p>
        </div>

        {error && <div style={{ color: "#f44336", fontSize: "13px", marginBottom: "15px", textAlign: "center" }}>{error}</div>}

        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور..."
          style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#111", border: "1px solid #333", color: "#fff", outline: "none", marginBottom: "20px", fontSize: "15px" }}
          onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
        />

        <button 
          onClick={handleVerify}
          disabled={loading}
          style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "#f44336", color: "#fff", border: "none", fontWeight: "bold", fontSize: "16px", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "جاري التحقق..." : "تأكيد الحذف النهائي 🗑️"}
        </button>
      </div>
    </div>
  );
}
