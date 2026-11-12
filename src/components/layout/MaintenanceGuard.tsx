"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/core/supabase";
import { Wrench, KeyRound, ShieldAlert, Check, AlertTriangle } from "lucide-react";

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceScope, setMaintenanceScope] = useState<"faculty" | "portal" | "all">("faculty");
  const [message, setMessage] = useState("");
  
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("cached_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (["مدير", "مدير مساعد", "admin", "أدمن"].includes(parsed?.role)) {
            return true;
          }
        }
      } catch (e) {}
    }
    return false;
  });

  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  const [loading, setLoading] = useState(true);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let currentIsMaintenance = false;

    const checkStatus = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (profile && ["مدير", "مدير مساعد", "admin", "أدمن"].includes(profile.role)) {
            setIsAdmin(true);
            isAdminRef.current = true;
          }
        }
      } catch (err) {
        console.warn("Session check in MaintenanceGuard:", err);
      }

      try {
        const res = await fetch("/api/public/settings", { cache: "no-store" });
        if (res.ok) {
          const settings = await res.json();
          const newMaintenance = !!settings?.is_maintenance_mode;

          setMessage(settings?.maintenance_message || "تطبيقنا يخضع لعملية صيانة حالياً. نرجو المحاولة لاحقاً...");
          const scope = settings?.maintenance_scope || "faculty";
          setMaintenanceScope(scope);

          if (currentIsMaintenance && !newMaintenance && !isAdminRef.current) {
            window.location.reload();
          }
          currentIsMaintenance = newMaintenance;
          setIsMaintenance(newMaintenance);
        }
      } catch (err) {
        console.warn("Settings check in MaintenanceGuard:", err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60_000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      setLoginError("يرجى إدخال البريد وكلمة المرور");
      return;
    }
    setLoggingIn(true);
    setLoginError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword
      });

      if (error || !data?.user) {
        setLoginError("بيانات الدخول غير صحيحة");
        setLoggingIn(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profile && ["مدير", "مدير مساعد", "admin", "أدمن"].includes(profile.role)) {
        localStorage.setItem("cached_profile", JSON.stringify(profile));
        setIsAdmin(true);
        isAdminRef.current = true;
        setShowAdminLogin(false);
      } else {
        setLoginError("هذا الحساب ليس لديه صلاحيات مدير نظام لتخطي شاشة الصيانة");
      }
    } catch (err: any) {
      setLoginError(err?.message || "حدث خطأ أثناء محاولة تسجيل الدخول");
    } finally {
      setLoggingIn(false);
    }
  };

  // صفحات انتقال البوابة إلى تليجرام تفتح فوراً دون انتظار
  if (pathname?.startsWith("/student-portal")) {
    return <>{children}</>;
  }

  const isStudentRoute = pathname?.startsWith("/student-portal") || pathname?.startsWith("/system") || pathname?.startsWith("/tg");
  const isFacultyRoute = !isStudentRoute;

  if (loading && isFacultyRoute) return null;

  let isBlocked = false;
  if (isMaintenance && !isAdmin) {
    if (maintenanceScope === "faculty") {
      isBlocked = isFacultyRoute;
    } else if (maintenanceScope === "portal") {
      isBlocked = isStudentRoute;
    } else if (maintenanceScope === "all") {
      isBlocked = true;
    } else {
      isBlocked = isFacultyRoute;
    }
  }

  if (isBlocked) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "var(--background)",
          color: "var(--text)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 99999,
          padding: "20px",
          textAlign: "center",
          direction: "rtl"
        }}
      >
        <div
          style={{
            maxWidth: "460px",
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "16px",
            padding: "32px 24px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)"
          }}
        >
          <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--accent-ink)" }}>
            <Wrench size={24} strokeWidth={1.5} />
          </div>
          
          <h1 style={{ color: "var(--text)", fontSize: "20px", fontWeight: 600, margin: "0 0 8px 0" }}>
            {isStudentRoute ? "بوابة الطلاب قيد الصيانة المؤقتة" : "وضع الصيانة والتحديث"}
          </h1>

          <div
            style={{
              background: "rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: "6px",
              padding: "6px 12px",
              display: "inline-block",
              color: "var(--accent-ink)",
              fontSize: "12px",
              marginBottom: "16px"
            }}
          >
            {maintenanceScope === "portal" && "جاري تحديث وتطوير خدمات بوابة الطلاب"}
            {maintenanceScope === "faculty" && "جاري تحديث نظام رصد الدرجات والغياب لأعضاء هيئة التدريس"}
            {maintenanceScope === "all" && "تحديث شامل لكافة خدمات النظام"}
          </div>

          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 0 16px 0" }}>
            {message}
          </p>

          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            ستختفي هذه الشاشة تلقائياً ويعود النظام للعمل فور اكتمال التحديثات.
          </p>

          {!isStudentRoute && (
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
              {!showAdminLogin ? (
                <button
                  onClick={() => setShowAdminLogin(true)}
                  className="btn-compact"
                  style={{
                    background: "var(--surface-hover)",
                    border: "1px solid var(--border-light)",
                    color: "var(--accent-ink)",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <KeyRound size={16} strokeWidth={1.5} />
                  <span>تسجيل دخول كمسؤول النظام</span>
                </button>
              ) : (
                <form onSubmit={handleAdminLogin} style={{ textAlign: "right", marginTop: "8px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-ink)", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <ShieldAlert size={16} strokeWidth={1.5} />
                    <span>دخول الطوارئ لمديري النظام</span>
                  </div>

                  {loginError && (
                    <div style={{ background: "rgba(239, 68, 68, 0.14)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "var(--error-ink)", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", marginBottom: "12px" }}>
                      {loginError}
                    </div>
                  )}

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", marginBottom: "4px" }}>البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@faculty.edu"
                      style={{ width: "100%", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text)", borderRadius: "8px", fontSize: "13px", direction: "ltr", textAlign: "left", marginBottom: 0 }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", marginBottom: "4px" }}>كلمة المرور</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ width: "100%", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text)", borderRadius: "8px", fontSize: "13px", direction: "ltr", textAlign: "left", marginBottom: 0 }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="submit"
                      disabled={loggingIn}
                      style={{ flex: 1, padding: "10px 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 500, fontSize: "13px", cursor: loggingIn ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <Check size={16} strokeWidth={1.5} />
                      <span>{loggingIn ? "جاري التحقق" : "تأكيد الدخول وفك الحجب"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdminLogin(false)}
                      className="btn-compact"
                      style={{ padding: "10px 16px", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {isMaintenance && isAdmin && (
        <div
          style={{
            background: "#b45309",
            borderBottom: "1px solid rgba(255, 255, 255, 0.14)",
            color: "#fff",
            textAlign: "center",
            padding: "8px 16px",
            fontSize: "12px",
            fontWeight: 500,
            zIndex: 10000,
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={15} strokeWidth={1.5} />
          <span>
            وضع الصيانة مفعّل حالياً للمستخدمين ({maintenanceScope === "portal" ? "بوابة الطلاب فقط" : maintenanceScope === "all" ? "النظام بالكامل" : "نظام أعضاء هيئة التدريس فقط"}) — تتصفح بصلاحية استثناء المدير
          </span>
        </div>
      )}
      {children}
    </>
  );
}
