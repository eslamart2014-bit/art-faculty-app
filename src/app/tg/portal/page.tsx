"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, CheckCircle2, UserCheck, AlertCircle } from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";

function extractTelegramUser(): { id: string | number; first_name?: string; username?: string } | null {
  if (typeof window === "undefined") return null;

  // 1. Check window.Telegram.WebApp.initDataUnsafe.user
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      return tg.initDataUnsafe.user;
    }
  } catch (e) {}

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
  } catch (e) {}

  return null;
}

export default function TelegramPortalEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [tgUser, setTgUser] = useState<{ id: string | number; first_name?: string; username?: string } | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [lookupStudent, setLookupStudent] = useState<{ full_name: string; academic_year: string; section?: string } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and check Telegram WebApp
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
        } catch (e) {}
      }

      let resolvedTgUser = extractTelegramUser();
      if (!resolvedTgUser && attempts < maxAttempts) {
        attempts++;
        setTimeout(initTg, 100);
        return;
      }

      // Fallback for browser testing (only if opened outside Telegram)
      if (!resolvedTgUser) {
        const testId = searchParams.get("tg_id") || "777888999";
        resolvedTgUser = {
          id: testId,
          first_name: "مستخدم تجريبي",
          username: "preview"
        };
      }

      setTgUser(resolvedTgUser);

      if (resolvedTgUser?.id) {
        try {
          const res = await fetch(`/api/tg/auth?tg_id=${encodeURIComponent(resolvedTgUser.id)}`);
          const data = await res.json();

          if (data.authenticated && data.student) {
            // Student is already bound! Store session and launch dashboard immediately!
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
            } catch (e) {}

            window.location.replace("/system?tg=1&bypass=1&web=1");
            return;
          }
        } catch (err) {}
      }

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
      } catch (err) {
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
      setErrorMsg("لم يتم التعرف على حساب التيليجرام، يرجى فتح البوابة من داخل تيليجرام");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/tg/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: studentCode.trim(),
          telegram_id: currentTgUser.id,
          telegram_username: currentTgUser.username || "",
          telegram_first_name: currentTgUser.first_name || "",
          admin_override: true
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.student) {
        setErrorMsg(data.error || "تعذر إتمام الدخول، يرجى التأكد من الكود والمحاولة مجدداً");
        setSubmitting(false);
        return;
      }

      // Login successful! Populate local session
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
      } catch (e) {}

      setSuccessMsg(`أهلاً بك يا ${data.student.full_name}! جاري الدخول...`);

      setTimeout(() => {
        window.location.replace("/system?tg=1&bypass=1&web=1");
      }, 700);
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
                جاري التحقق من الحساب...
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
                  <span>{submitting ? "جاري الدخول..." : "دخول 🚀"}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
