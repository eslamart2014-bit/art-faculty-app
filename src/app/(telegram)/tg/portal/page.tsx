"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { LogIn, CheckCircle2, UserCheck, GraduationCap, Smartphone, AlertTriangle } from "lucide-react";

function extractTelegramUser(): { id: string | number; first_name?: string; username?: string } | null {
  if (typeof window === "undefined") return null;

  // 1. Check window.Telegram.WebApp.initDataUnsafe.user
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      return tg.initDataUnsafe.user;
    }
  } catch {}

  // 2. Direct parsing from window.location.hash
  try {
    const rawHash = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : window.location.hash;
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      const tgWebAppData = hashParams.get("tgWebAppData");
      if (tgWebAppData) {
        const dataParams = new URLSearchParams(tgWebAppData);
        const userStr = dataParams.get("user");
        if (userStr) {
          const userObj = JSON.parse(userStr);
          if (userObj?.id) return userObj;
        }
      }
    }
  } catch {}

  return null;
}

export default function TelegramPortalEntryPage() {
  const [loading, setLoading] = useState(true);
  const [tgUser, setTgUser] = useState<{ id: string | number; first_name?: string; username?: string } | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [lookupStudent, setLookupStudent] = useState<{ full_name: string; academic_year: string; section?: string; is_linked?: boolean } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and check permanent session or Telegram WebApp binding
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;
    let isCancelled = false;

    // Hard safety timeout: Guaranteed never to hang more than 900ms on Huawei or slow devices
    const hardTimeout = setTimeout(() => {
      if (!isCancelled) setLoading(false);
    }, 900);

    const initTg = async () => {
      if (typeof window === "undefined" || isCancelled) return;

      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch {}
      }

      let resolvedTgUser = extractTelegramUser();
      if (!resolvedTgUser && attempts < maxAttempts) {
        attempts++;
        setTimeout(initTg, 80);
        return;
      }

      // Check query parameters or local storage
      if (!resolvedTgUser) {
        const isLocalhost =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        const urlParams = new URLSearchParams(window.location.search);
        const explicitTgId =
          urlParams.get("tg_id") ||
          (isLocalhost ? localStorage.getItem("fania_local_test_tg_id") || "999888777" : null);

        if (explicitTgId) {
          resolvedTgUser = {
            id: explicitTgId,
            first_name: "طالب",
            username: ""
          };
        }
      }

      setTgUser(resolvedTgUser);

      // 1. Server-side Telegram ID binding & status check
      if (resolvedTgUser?.id && String(resolvedTgUser.id) !== "999888777") {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 1200);

        try {
          const res = await fetch(`/api/tg/auth?tg_id=${encodeURIComponent(resolvedTgUser.id)}`, {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal
          });
          clearTimeout(fetchTimeout);
          const data = await res.json();

          if (data.suspended) {
            try {
              localStorage.removeItem("fania_student_session");
              localStorage.removeItem("fania_student_token");
              localStorage.removeItem("fania_student_code");
            } catch {}
            setErrorMsg(data.error || "⛔ تم تعليق حسابك مؤقتاً بواسطة إدارة الكلية.");
            setLoading(false);
            return;
          }

          if (data.authenticated && data.student) {
            try {
              localStorage.setItem("fania_student_session", JSON.stringify({
                student_code: data.student.student_code,
                full_name: data.student.full_name,
                academic_year: data.student.academic_year,
                section: data.student.section,
                status: "active"
              }));
              localStorage.setItem("fania_student_code", data.student.student_code);
              if (data.token) localStorage.setItem("fania_student_token", data.token);
              localStorage.setItem("fania_bypass_update_notice", "1");
              localStorage.setItem("fania_tg_id", String(resolvedTgUser.id));
              sessionStorage.setItem("fania_tg_verified", "1");
            } catch {}

            window.location.replace("/system?tg=1&bypass=1&web=1");
            return;
          }

          if (data.needs_link) {
            try {
              localStorage.removeItem("fania_student_session");
              localStorage.removeItem("fania_student_token");
              localStorage.removeItem("fania_student_code");
            } catch {}
            setLoading(false);
            return;
          }
        } catch {
          // Timeout or connection error: proceed to local session check
        } finally {
          clearTimeout(fetchTimeout);
        }
      }

      // 2. Fallback / Localhost fast-path: If student already has a saved local session on this device
      try {
        const savedSessionRaw = localStorage.getItem("fania_student_session");
        const savedToken = localStorage.getItem("fania_student_token");
        if (savedSessionRaw && savedToken) {
          const parsed = JSON.parse(savedSessionRaw);
          if (parsed?.student_code) {
            localStorage.setItem("fania_bypass_update_notice", "1");
            sessionStorage.setItem("fania_tg_verified", "1");
            window.location.replace("/system?tg=1&bypass=1&web=1");
            return;
          }
        }
      } catch {}

      if (!isCancelled) setLoading(false);
    };

    initTg();

    return () => {
      isCancelled = true;
      clearTimeout(hardTimeout);
    };
  }, []);

  // Real-time lookup of student name when code is typed
  useEffect(() => {
    if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);

    const clean = studentCode.trim();
    if (clean.length < 2) {
      setLookupStudent(null);
      setLookupLoading(false);
      return;
    }

    setLookupLoading(true);
    lookupTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tg/auth?action=lookup&code=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data.found && data.student) {
          setLookupStudent(data.student);
          setErrorMsg(null);
        } else {
          setLookupStudent(null);
        }
      } catch {
        setLookupStudent(null);
      } finally {
        setLookupLoading(false);
      }
    }, 200);

    return () => {
      if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);
    };
  }, [studentCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || submitting) return;

    let currentTgUser = extractTelegramUser() || tgUser;
    if (!currentTgUser?.id) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTgId = urlParams.get("tg_id");
      let storedTgId: string | null = null;
      try {
        storedTgId = localStorage.getItem("fania_tg_id");
      } catch {}

      if (urlTgId || storedTgId) {
        currentTgUser = { id: urlTgId || storedTgId!, first_name: "طالب" };
      } else {
        // Fallback for Huawei / WebView: generate a persistent identifier so no student is ever blocked
        let hwId = "";
        try {
          hwId = localStorage.getItem("fania_hw_device_id") || "";
          if (!hwId) {
            hwId = "hw_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            localStorage.setItem("fania_hw_device_id", hwId);
          }
        } catch {
          hwId = "hw_" + Date.now();
        }
        currentTgUser = { id: hwId, first_name: "مستخدم البوابة" };
      }
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/tg/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          student_code: studentCode.trim(),
          telegram_id: currentTgUser.id,
          telegram_username: currentTgUser.username || "",
          telegram_first_name: currentTgUser.first_name || ""
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.student) {
        setErrorMsg(data.error || "تعذر إتمام الدخول، يرجى التأكد من الكود والمحاولة مجدداً");
        setSubmitting(false);
        return;
      }

      // Login successful! Populate permanent local session
      try {
        localStorage.setItem("fania_student_session", JSON.stringify({
          student_code: data.student.student_code,
          full_name: data.student.full_name,
          academic_year: data.student.academic_year,
          section: data.student.section,
          status: "active"
        }));
        localStorage.setItem("fania_student_code", data.student.student_code);
        if (data.token) localStorage.setItem("fania_student_token", data.token);
        localStorage.setItem("fania_bypass_update_notice", "1");
        localStorage.setItem("fania_tg_id", String(currentTgUser.id));
        sessionStorage.setItem("fania_tg_verified", "1");
      } catch {}

      setSuccessMsg(`أهلاً بك يا ${data.student.full_name}! تم تثبيت حسابك، جاري الدخول...`);

      setTimeout(() => {
        window.location.replace("/system?tg=1&bypass=1&web=1");
      }, 600);
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ في الاتصال بالسيرفر");
      setSubmitting(false);
    }
  };

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            (window as any).Telegram?.WebApp?.ready?.();
          } catch {}
        }}
      />

      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          width: "100%",
          background: "var(--background)",
          color: "var(--text)",
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "16px",
          boxSizing: "border-box"
        }}
      >
        <div style={{ width: "100%", maxWidth: "420px" }}>
          {/* Academic Header */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              padding: "4px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              color: "var(--accent-ink)",
              fontWeight: 500,
              marginBottom: "8px"
            }}>
              <GraduationCap size={14} strokeWidth={1.5} />
              <span>جامعة قنا • كلية التربية النوعية</span>
            </div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", margin: "0 0 4px 0" }}>
              قسم التربية الفنية
            </h1>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Smartphone size={14} strokeWidth={1.5} />
              <span>المنظومة الرقمية للطلاب</span>
            </p>
          </div>

          {loading ? (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "12px",
              padding: "32px 16px",
              textAlign: "center"
            }}>
              <div style={{
                width: "28px",
                height: "28px",
                border: "2.5px solid var(--border-light)",
                borderTopColor: "var(--accent-ink)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px"
              }} />
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                جاري فتح حسابك المثبت...
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "16px",
              padding: "20px 16px"
            }}>
              {/* Short Security Warning */}
              <div style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "8px",
                padding: "8px 12px",
                marginBottom: "16px",
                fontSize: "12px",
                color: "var(--warning-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                lineHeight: 1.5
              }}>
                <AlertTriangle size={15} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <span>تنبيه: الدخول دائم بحسابك ولا يُعدّل إلا بإذن المنسق.</span>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: "12px" }}>
                  <input
                    type="text"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="اكتب الكود هنا..."
                    disabled={submitting}
                    className="tabular-nums"
                    style={{
                      width: "100%",
                      background: "var(--bg-deep)",
                      border: lookupStudent ? "1.5px solid var(--success)" : "1.5px solid var(--border-light)",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      fontSize: "16px",
                      color: "var(--text)",
                      fontFamily: "inherit",
                      fontWeight: 600,
                      textAlign: "center",
                      letterSpacing: "1.5px",
                      boxSizing: "border-box",
                      outline: "none",
                      transition: "border-color 0.2s var(--ease-out)"
                    }}
                    onFocus={(e) => {
                      if (!lookupStudent) e.target.style.borderColor = "var(--accent-ink)";
                    }}
                    onBlur={(e) => {
                      if (!lookupStudent) e.target.style.borderColor = "var(--border-light)";
                    }}
                    autoFocus
                  />
                </div>

                {/* Instant Name Verification Display */}
                {lookupLoading ? (
                  <div style={{ textAlign: "center", padding: "6px", fontSize: "12px", color: "var(--accent-ink)" }}>
                    جاري التحقق من الاسم...
                  </div>
                ) : lookupStudent ? (
                  <div className="animate-fade-in" style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                    textAlign: "center"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "var(--success-ink)", fontWeight: 600, fontSize: "14px", marginBottom: "2px" }}>
                      <UserCheck size={16} strokeWidth={1.5} />
                      <span>{lookupStudent.full_name}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {lookupStudent.academic_year} {lookupStudent.section ? `• سكشن ${lookupStudent.section}` : ""}
                    </div>
                  </div>
                ) : studentCode.trim().length >= 3 ? (
                  <div style={{
                    fontSize: "12px",
                    color: "var(--error-ink)",
                    textAlign: "center",
                    marginBottom: "12px"
                  }}>
                    كود غير موجود، تأكد من كتابة الكود صحيحاً
                  </div>
                ) : null}

                {errorMsg && (
                  <div style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                    fontSize: "12px",
                    color: "var(--error-ink)",
                    textAlign: "center",
                    lineHeight: 1.5
                  }}>
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div style={{
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                    fontSize: "12.5px",
                    color: "var(--success-ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}>
                    <CheckCircle2 size={16} strokeWidth={1.5} />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !studentCode.trim()}
                  style={{
                    width: "100%",
                    background: submitting || !studentCode.trim()
                      ? "var(--secondary)"
                      : "var(--primary)",
                    color: submitting || !studentCode.trim() ? "var(--text-muted)" : "#ffffff",
                    border: "1px solid " + (submitting || !studentCode.trim() ? "var(--border)" : "var(--primary)"),
                    borderRadius: "8px",
                    padding: "12px 16px",
                    fontSize: "15px",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: submitting || !studentCode.trim() ? "not-allowed" : "pointer",
                    transition: "background-color 0.2s var(--ease-out), border-color 0.2s var(--ease-out)"
                  }}
                >
                  <LogIn size={16} strokeWidth={1.5} />
                  <span>{submitting ? "جاري تثبيت الحساب..." : "دخول وتثبيت الحساب"}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
