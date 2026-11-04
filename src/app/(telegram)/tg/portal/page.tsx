"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { LogIn, CheckCircle2, UserCheck } from "lucide-react";

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
  const searchParams = useSearchParams();

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
    const maxAttempts = 12;

    const initTg = async () => {
      if (typeof window === "undefined") return;

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
        setTimeout(initTg, 100);
        return;
      }

      // Optional explicit query param or localhost test mode (never active on production domain without tg_id)
      if (!resolvedTgUser) {
        const isLocalhost =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        const explicitTgId =
          searchParams.get("tg_id") ||
          (isLocalhost ? localStorage.getItem("fania_local_test_tg_id") || "999888777" : null);

        if (explicitTgId) {
          resolvedTgUser = {
            id: explicitTgId,
            first_name: "تجربة محلية",
            username: "local_test"
          };
        }
      }

      setTgUser(resolvedTgUser);

      // 1. Server-side Telegram ID binding & status check (ensures deleted/suspended accounts are enforced immediately)
      if (resolvedTgUser?.id && String(resolvedTgUser.id) !== "999888777") {
        try {
          const res = await fetch(`/api/tg/auth?tg_id=${encodeURIComponent(resolvedTgUser.id)}`, {
            cache: "no-store",
            credentials: "same-origin"
          });
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
            // الحساب غير مربوط أو تم حذفه من قِبل الإدارة: مسح الجلسة القديمة لكي يسجل الكود من جديد
            try {
              localStorage.removeItem("fania_student_session");
              localStorage.removeItem("fania_student_token");
              localStorage.removeItem("fania_student_code");
            } catch {}
            setLoading(false);
            return;
          }
        } catch {
          // في حال ضعف الإنترنت: استخدم الجلسة المحفوظة محلياً
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

      setLoading(false);
    };

    initTg();
  }, [searchParams]);

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

    const currentTgUser = extractTelegramUser() || tgUser;
    if (!currentTgUser?.id) {
      setErrorMsg("يرجى فتح البوابة من داخل بوت التيليجرام الرسمي للكلية لتثبيت حسابك تلقائياً");
      return;
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
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          width: "100%",
          background: "radial-gradient(ellipse at top, #0d1527 0%, #060a12 100%)",
          color: "#f8fafc",
          fontFamily: "system-ui, -apple-system, sans-serif",
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
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(56, 189, 248, 0.1)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              padding: "5px 12px",
              borderRadius: "999px",
              fontSize: "11.5px",
              color: "#38bdf8",
              fontWeight: "bold",
              marginBottom: "8px"
            }}>
              <span>🎓</span>
              <span>جامعة قنا • كلية التربية النوعية</span>
            </div>
            <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#ffffff", margin: "0 0 4px 0" }}>
              قسم التربية الفنية
            </h1>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
              المنظومة الرقمية للطلاب 📱
            </p>
          </div>

          {loading ? (
            <div style={{
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: "16px",
              padding: "32px 16px",
              textAlign: "center"
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                border: "3px solid rgba(56, 189, 248, 0.2)",
                borderTopColor: "#38bdf8",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px"
              }} />
              <div style={{ fontSize: "13px", color: "#94a3b8" }}>
                جاري فتح حسابك المثبت...
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "18px",
              padding: "20px 16px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)"
            }}>
              {/* Short Security Warning */}
              <div style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "10px",
                padding: "8px 12px",
                marginBottom: "16px",
                fontSize: "11.5px",
                color: "#fde68a",
                textAlign: "center",
                lineHeight: 1.5
              }}>
                ⚠️ تنبيه: الدخول دائم بحسابك ولا يُعدّل إلا بإذن المنسق.
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
                    style={{
                      width: "100%",
                      background: "#0e1626",
                      border: lookupStudent ? "2px solid #10b981" : "2px solid #1e293b",
                      borderRadius: "12px",
                      padding: "14px",
                      fontSize: "18px",
                      color: "#ffffff",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      textAlign: "center",
                      letterSpacing: "2px",
                      boxSizing: "border-box",
                      outline: "none",
                      transition: "border-color 0.2s ease"
                    }}
                    onFocus={(e) => {
                      if (!lookupStudent) e.target.style.borderColor = "#38bdf8";
                    }}
                    onBlur={(e) => {
                      if (!lookupStudent) e.target.style.borderColor = "#1e293b";
                    }}
                    autoFocus
                  />
                </div>

                {/* Instant Name Verification Display */}
                {lookupLoading ? (
                  <div style={{ textAlign: "center", padding: "6px", fontSize: "12px", color: "#38bdf8" }}>
                    جاري التحقق من الاسم...
                  </div>
                ) : lookupStudent ? (
                  <div style={{
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                    textAlign: "center",
                    animation: "fadeIn 0.25s ease"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "#34d399", fontWeight: "bold", fontSize: "14px", marginBottom: "2px" }}>
                      <UserCheck size={16} />
                      <span>{lookupStudent.full_name}</span>
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                      {lookupStudent.academic_year} {lookupStudent.section ? `• سكشن ${lookupStudent.section}` : ""}
                    </div>
                  </div>
                ) : studentCode.trim().length >= 3 ? (
                  <div style={{
                    fontSize: "11.5px",
                    color: "#f87171",
                    textAlign: "center",
                    marginBottom: "12px"
                  }}>
                    كود غير موجود، تأكد من كتابة الكود صحيحاً
                  </div>
                ) : null}

                {errorMsg && (
                  <div style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                    fontSize: "12px",
                    color: "#fca5a5",
                    textAlign: "center",
                    lineHeight: 1.5
                  }}>
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid #10b981",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                    fontSize: "12.5px",
                    color: "#6ee7b7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}>
                    <CheckCircle2 size={16} />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !studentCode.trim()}
                  style={{
                    width: "100%",
                    background: submitting
                      ? "#334155"
                      : "linear-gradient(135deg, #0284c7, #2563eb)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "12px",
                    padding: "14px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: submitting || !studentCode.trim() ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 15px rgba(37, 99, 235, 0.35)",
                    transition: "all 0.2s ease"
                  }}
                >
                  <LogIn size={18} />
                  <span>{submitting ? "جاري تثبيت الحساب..." : "دخول وتثبيت الحساب 🚀"}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
