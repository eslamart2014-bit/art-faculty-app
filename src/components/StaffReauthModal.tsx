"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { syncStaffSessionClient } from "@/lib/staffAuthFetch";
import { Lock, Eye, EyeOff, LogIn, AlertCircle, RefreshCw } from "lucide-react";

interface StaffReauthModalProps {
  isOpen?: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function StaffReauthModal({ isOpen: controlledIsOpen, onSuccess, onClose }: StaffReauthModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (controlledIsOpen !== undefined) {
      setIsOpen(controlledIsOpen);
    }
  }, [controlledIsOpen]);

  // Listen to global auth-required event
  useEffect(() => {
    const handleAuthRequired = (e: any) => {
      setIsOpen(true);
      if (e?.detail?.email) {
        setEmail(e.detail.email);
      }
    };

    window.addEventListener("staff-auth-required", handleAuthRequired);
    return () => window.removeEventListener("staff-auth-required", handleAuthRequired);
  }, []);

  // Pre-fill email and name from cached profile if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("cached_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.email) setEmail(parsed.email);
          if (parsed.full_name) setUserName(parsed.full_name);
        }
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError || !data?.session?.access_token) {
        setError(signInError?.message || "بيانات الدخول غير صحيحة");
        setLoading(false);
        return;
      }

      // Sync session to issue durable 7-day server token
      const synced = await syncStaffSessionClient(data.session.access_token);
      if (!synced) {
        // Retry once directly
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          credentials: "same-origin",
        });
      }

      // Close modal and notify
      setIsOpen(false);
      setPassword("");
      setError("");

      if (onSuccess) {
        onSuccess();
      } else {
        // Reload page to reflect fresh session everywhere
        window.location.reload();
      }
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutCompletely = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("cached_profile");
      localStorage.removeItem("fania_staff_session_token");
      await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
      window.location.href = "/";
    } catch (e) {}
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        direction: "rtl",
      }}
    >
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "420px",
          padding: "24px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            background: "rgba(59, 130, 246, 0.15)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            color: "#60a5fa",
          }}
        >
          <Lock size={28} />
        </div>

        <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: "bold" }}>
          تأكيد جلسة الدخول
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#94a3b8", lineHeight: "1.5" }}>
          انتهت صلاحية جلسة تسجيل الدخول للأمان. يرجى إدخال كلمة المرور لمتابعة العمل كـ
          <strong style={{ color: "#38bdf8", display: "block", marginTop: "4px" }}>
            {userName || "عضو الكادر المعتمد"}
          </strong>
        </p>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "10px",
              padding: "10px",
              marginBottom: "14px",
              color: "#fca5a5",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textAlign: "right",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ textAlign: "right" }}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
                direction: "ltr",
                textAlign: "left",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>
              كلمة المرور
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 38px 10px 12px",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                  direction: "ltr",
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
              marginBottom: "10px",
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>جاري التحقق والدخول...</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>تأكيد الدخول ومتابعة العمل</span>
              </>
            )}
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              إلغاء
            </button>
          )}
          <button
            type="button"
            onClick={handleSignOutCompletely}
            style={{
              background: "transparent",
              border: "none",
              color: "#ef4444",
              fontSize: "12px",
              cursor: "pointer",
              textDecoration: "underline",
              marginRight: "auto",
            }}
          >
            تسجيل الخروج والتبديل لحساب آخر
          </button>
        </div>
      </div>
    </div>
  );
}
