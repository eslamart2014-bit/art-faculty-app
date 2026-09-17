"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceScope, setMaintenanceScope] = useState<"faculty" | "portal" | "all">("faculty");
  const [message, setMessage] = useState("");
  
  // Synchronously check cached profile to prevent admin lockout on app reload / PWA launch
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

  // Admin Emergency Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let currentIsMaintenance = false;

    const checkStatus = async () => {
      // 1. Double check server session & profile to verify admin role
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

      // 2. Fetch maintenance state & granular scope
      try {
        const { data: settings } = await supabase
          .from("system_settings")
          .select("is_maintenance_mode, maintenance_message, telegram_config")
          .eq("id", 1)
          .maybeSingle();

        if (settings) {
          currentIsMaintenance = !!settings.is_maintenance_mode;
          setIsMaintenance(currentIsMaintenance);
          setMessage(settings.maintenance_message || "تطبيقنا يخضع لعملية صيانة حالياً. نرجو المحاولة لاحقاً...");
          
          const scope = settings.telegram_config?.maintenance_scope || "faculty";
          setMaintenanceScope(scope);
        }
      } catch (err) {
        console.warn("Settings check in MaintenanceGuard:", err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    // 3. Realtime listener for system_settings updates
    const channel = supabase
      .channel("system_settings_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "system_settings" },
        (payload) => {
          const newData = payload.new;
          const newMaintenance = !!newData.is_maintenance_mode;
          setIsMaintenance(newMaintenance);
          setMessage(newData.maintenance_message || "تطبيقنا يخضع لعملية صيانة حالياً. نرجو المحاولة لاحقاً...");
          
          const scope = newData.telegram_config?.maintenance_scope || "faculty";
          setMaintenanceScope(scope);

          // If maintenance just ended, reload for normal users so they get the latest version
          if (currentIsMaintenance && !newMaintenance && !isAdminRef.current) {
            window.location.reload();
          }
          currentIsMaintenance = newMaintenance;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  if (loading) return null;

  // Determine route type
  const isStudentRoute = pathname?.startsWith("/student-portal") || pathname?.startsWith("/system");
  const isFacultyRoute = !isStudentRoute;

  // Granular check: should we block this route?
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
          backgroundColor: "#0a0e17",
          color: "#fff",
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
            maxWidth: "480px",
            width: "100%",
            background: "#141b29",
            border: "1px solid #2a374f",
            borderRadius: "20px",
            padding: "32px 24px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)"
          }}
        >
          <div style={{ fontSize: "56px", marginBottom: "16px", animation: "pulse 2s infinite" }}>🚧</div>
          
          <h1 style={{ color: "#38bdf8", fontSize: "22px", fontWeight: "bold", margin: "0 0 10px 0" }}>
            {isStudentRoute ? "بوابة الطلاب قيد الصيانة المؤقتة" : "وضع الصيانة والتحديث"}
          </h1>

          <div
            style={{
              background: "rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: "10px",
              padding: "8px 14px",
              display: "inline-block",
              color: "#94a3b8",
              fontSize: "12px",
              marginBottom: "16px"
            }}
          >
            {maintenanceScope === "portal" && "جاري تحديث وتطوير خدمات بوابة الطلاب"}
            {maintenanceScope === "faculty" && "جاري تحديث نظام رصد الدرجات والغياب لأعضاء هيئة التدريس"}
            {maintenanceScope === "all" && "تحديث شامل لكافة خدمات النظام"}
          </div>

          <p style={{ fontSize: "15px", color: "#e2e8f0", lineHeight: 1.7, margin: "0 0 20px 0" }}>
            {message}
          </p>

          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            ستختفي هذه الشاشة تلقائياً ويعود النظام للعمل فور اكتمال التحديثات.
          </p>

          {/* Emergency Admin Login Button & Box */}
          <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid #2a374f" }}>
            {!showAdminLogin ? (
              <button
                onClick={() => setShowAdminLogin(true)}
                style={{
                  background: "transparent",
                  border: "1px solid #3b82f6",
                  color: "#38bdf8",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>🔑</span> تسجيل دخول كمسؤول النظام (Admin Bypass)
              </button>
            ) : (
              <form onSubmit={handleAdminLogin} style={{ textAlign: "right", marginTop: "10px" }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", marginBottom: "12px", textAlign: "center" }}>
                  دخول الطوارئ لمديري النظام 🛡️
                </div>

                {loginError && (
                  <div style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#fca5a5", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", marginBottom: "12px" }}>
                    {loginError}
                  </div>
                )}

                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "11px", marginBottom: "4px" }}>البريد الإلكتروني للادمن:</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@faculty.edu"
                    style={{ width: "100%", padding: "10px", background: "#0d131f", border: "1px solid #2a374f", color: "#fff", borderRadius: "8px", fontSize: "13px", direction: "ltr", textAlign: "left" }}
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "11px", marginBottom: "4px" }}>كلمة المرور:</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: "100%", padding: "10px", background: "#0d131f", border: "1px solid #2a374f", color: "#fff", borderRadius: "8px", fontSize: "13px", direction: "ltr", textAlign: "left" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="submit"
                    disabled={loggingIn}
                    style={{ flex: 1, padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "13px", cursor: loggingIn ? "not-allowed" : "pointer" }}
                  >
                    {loggingIn ? "جاري التحقق..." : "تأكيد الدخول وفك الحجب ✅"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdminLogin(false)}
                    style={{ padding: "10px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.08); }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {/* Top Banner indicating maintenance mode for Admins */}
      {isMaintenance && isAdmin && (
        <div
          style={{
            background: "linear-gradient(90deg, #b45309, #d97706)",
            color: "#fff",
            textAlign: "center",
            padding: "8px 14px",
            fontSize: "12px",
            fontWeight: "bold",
            zIndex: 10000,
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
          }}
        >
          <span>
            ⚠️ وضع الصيانة مفعّل حالياً للمستخدمين ({maintenanceScope === "portal" ? "بوابة الطلاب فقط" : maintenanceScope === "all" ? "النظام بالكامل" : "نظام أعضاء هيئة التدريس فقط"}) - أنت تتصفح بصلاحية استثناء المدير
          </span>
        </div>
      )}
      {children}
    </>
  );
}
