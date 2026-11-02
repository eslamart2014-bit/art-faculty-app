"use client";

import React, { useState, useEffect } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Link2, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";

export default function TelegramPortalEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [tgUser, setTgUser] = useState<{ id: string | number; first_name?: string; username?: string } | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);

  // Initialize and check Telegram WebApp
  useEffect(() => {
    const initTg = async () => {
      let resolvedTgUser: any = null;

      if (typeof window !== "undefined") {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          try {
            tg.ready();
            tg.expand();
            if (tg.initDataUnsafe?.user?.id) {
              resolvedTgUser = tg.initDataUnsafe.user;
            }
          } catch (e) {}
        }

        // Support test/preview mode for admin
        const isPreview = searchParams.get("preview") === "1" || searchParams.get("test") === "1";
        if (isPreview || !resolvedTgUser) {
          const testId = searchParams.get("tg_id") || "admin_test_user_777";
          if (!resolvedTgUser) {
            resolvedTgUser = {
              id: testId,
              first_name: "مُعاين النظام (Admin)",
              username: "admin_preview"
            };
            setIsTestMode(true);
          }
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
              } catch (e) {}

              window.location.replace("/system?tg=1");
              return;
            }
          } catch (err) {}
        }
      }

      setLoading(false);
    };

    initTg();
  }, [searchParams]);

  const handleConfirmLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !tgUser?.id || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/tg/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: studentCode.trim(),
          telegram_id: tgUser.id,
          telegram_username: tgUser.username || "",
          telegram_first_name: tgUser.first_name || "",
          admin_override: isTestMode
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.student) {
        setErrorMsg(data.error || "تعذر إتمام عملية الربط، يرجى مراجعة الكود والمحاولة مجدداً");
        setSubmitting(false);
        return;
      }

      // Link successful! Populate local session
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
      } catch (e) {}

      setSuccessMsg(`مرحباً بك يا ${data.student.full_name}! تم ربط الحساب بنجاح وجاري فتح المنظومة...`);

      setTimeout(() => {
        window.location.replace("/system?tg=1");
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ في الاتصال بالخادم");
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
          background: "radial-gradient(ellipse at top, #0d1527 0%, #060a12 100%)",
          color: "#f8fafc",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          boxSizing: "border-box"
        }}
      >
        <div style={{ maxWidth: "440px", width: "100%" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(56, 189, 248, 0.1)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "12px",
              color: "#38bdf8",
              fontWeight: "bold",
              marginBottom: "10px"
            }}>
              <span>🎓</span>
              <span>جامعة قنا • كلية التربية النوعية</span>
            </div>
            <h1 style={{ fontSize: "21px", fontWeight: "900", color: "#ffffff", margin: "0 0 6px 0" }}>
              قسم التربية الفنية
            </h1>
            <p style={{ fontSize: "12.5px", color: "#94a3b8", margin: 0 }}>
              بوابة الطالب الذكية الموحدة عبر تيليجرام 📱
            </p>
          </div>

          {loading ? (
            <div style={{
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: "18px",
              padding: "36px 20px",
              textAlign: "center"
            }}>
              <div style={{
                width: "36px",
                height: "36px",
                border: "3px solid rgba(56, 189, 248, 0.2)",
                borderTopColor: "#38bdf8",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 14px"
              }} />
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "#f1f5f9" }}>
                جاري التحقق التلقائي من هويتك في تيليجرام...
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "20px",
              padding: "24px 20px",
              boxShadow: "0 10px 35px rgba(0, 0, 0, 0.5)"
            }}>
              {/* Test mode banner */}
              {isTestMode && (
                <div style={{
                  background: "rgba(168, 85, 247, 0.15)",
                  border: "1px solid rgba(168, 85, 247, 0.4)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  marginBottom: "16px",
                  fontSize: "12px",
                  color: "#d8b4fe",
                  textAlign: "center",
                  fontWeight: "bold"
                }}>
                  🛠️ وضع التجربة والمعاينة للأدمن (Admin Trial Mode)
                </div>
              )}

              {/* Crucial Permanent Binding Warning */}
              <div style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "14px",
                padding: "14px",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f87171", fontWeight: "bold", fontSize: "14px", marginBottom: "8px" }}>
                  <AlertTriangle size={18} />
                  <span>تنبيه أمني هام ومصيري</span>
                </div>
                <p style={{ fontSize: "12.5px", color: "#fca5a5", margin: 0, lineHeight: 1.6 }}>
                  دخولك إلى النظام سيكون <b>مرتبطاً بحساب تيليجرام هذا بصورة دائمة</b>.
                  بمجرد تأكيد الربط، <b>لن تتمكن من فك الارتباط أو تسجيل الخروج</b> إلا بعد الرجوع رسمياً لمنسق الكلية.
                </p>
              </div>

              {/* Telegram Account Info Preview */}
              {tgUser && (
                <div style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  marginBottom: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12px"
                }}>
                  <div style={{ color: "#94a3b8" }}>
                    حساب التيليجرام: <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{tgUser.first_name || "المستخدم"}</span>
                  </div>
                  <div style={{ color: "#64748b", fontFamily: "monospace" }}>
                    ID: {tgUser.id}
                  </div>
                </div>
              )}

              {/* Student Code Input Form */}
              <form onSubmit={handleConfirmLink}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", color: "#e2e8f0", marginBottom: "8px" }}>
                  كود الطالب الأكاديمي:
                </label>
                <div style={{ marginBottom: "16px" }}>
                  <input
                    type="text"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="أدخل كودك (مثل: 0687)"
                    disabled={submitting}
                    style={{
                      width: "100%",
                      background: "#0e1626",
                      border: "2px solid #1e293b",
                      borderRadius: "12px",
                      padding: "13px 14px",
                      fontSize: "16px",
                      color: "#ffffff",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      textAlign: "center",
                      letterSpacing: "1px",
                      boxSizing: "border-box",
                      outline: "none"
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#38bdf8")}
                    onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
                    autoFocus
                  />
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "5px" }}>
                    الكود الأكاديمي المطبوع على بطاقتك الجامعية أو استمارة القيد
                  </div>
                </div>

                {errorMsg && (
                  <div style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    marginBottom: "16px",
                    fontSize: "12.5px",
                    color: "#fca5a5",
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
                    marginBottom: "16px",
                    fontSize: "12.5px",
                    color: "#6ee7b7",
                    display: "flex",
                    alignItems: "center",
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
                    fontSize: "15px",
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
                  <Link2 size={18} />
                  <span>{submitting ? "جاري التحقق والربط..." : "تأكيد والربط الدائم بالتيليجرام 🔗"}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
