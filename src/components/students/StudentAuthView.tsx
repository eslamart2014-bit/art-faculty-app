"use client";

import React from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Eye, EyeOff, FolderOpen, QrCode } from "lucide-react";
import { compressImageToWebP } from "@/lib/students/imageCompressor";

interface StudentAuthViewProps {
  isClientReady: boolean;
  authMode: "register" | "login";
  setAuthMode: (mode: "register" | "login") => void;
  errorMsg: string;
  setErrorMsg: (msg: string) => void;
  regCode: string;
  setRegCode: (code: string) => void;
  regName: string;
  setRegName: (name: string) => void;
  regMobile: string;
  setRegMobile: (mobile: string) => void;
  enteredPin: string;
  setEnteredPin: (pin: string) => void;
  showLoginPin: boolean;
  setShowLoginPin: (show: boolean) => void;
  loading: boolean;
  matchedStudent: any;
  setMatchedStudent: (s: any) => void;
  isLookingUpCode: boolean;
  lookupStatus: any;
  setLookupStatus: (s: any) => void;
  lookupMessage: string | null;
  setLookupMessage: (m: string | null) => void;
  setCurrentStudent: (s: any) => void;
  setAccountStatus: (s: "pending" | "active" | null) => void;
  idCardPhoto: string | null;
  setIdCardPhoto: (photo: string | null) => void;
  idFileInputRef: React.RefObject<HTMLInputElement | null>;
  showIdCamera: boolean;
  setShowIdCamera: (show: boolean) => void;
  startCamera: (type: "id" | "artwork", mode?: "2d" | "3d") => void;
  stopCamera: () => void;
  setVideoRef: (el: HTMLVideoElement | null) => void;
  captureVideoFrame: () => string | null;
  showPwaPrompt: boolean;
  setShowPwaPrompt: (show: boolean) => void;
  deferredPrompt: any;
  setDeferredPrompt: (p: any) => void;
  pwaHintVisible: boolean;
  setPwaHintVisible: (v: boolean) => void;
  handleLoginSubmit: (e: React.FormEvent) => void;
  handleRegisterSubmit: (e: React.FormEvent) => void;
}

export default function StudentAuthView({
  isClientReady,
  authMode,
  setAuthMode,
  errorMsg,
  setErrorMsg,
  regCode,
  setRegCode,
  regName,
  setRegName,
  regMobile,
  setRegMobile,
  enteredPin,
  setEnteredPin,
  showLoginPin,
  setShowLoginPin,
  loading,
  matchedStudent,
  setMatchedStudent,
  isLookingUpCode,
  lookupStatus,
  setLookupStatus,
  lookupMessage,
  setLookupMessage,
  setCurrentStudent,
  setAccountStatus,
  idCardPhoto,
  setIdCardPhoto,
  idFileInputRef,
  showIdCamera,
  setShowIdCamera,
  startCamera,
  stopCamera,
  setVideoRef,
  captureVideoFrame,
  showPwaPrompt,
  setShowPwaPrompt,
  deferredPrompt,
  setDeferredPrompt,
  pwaHintVisible,
  setPwaHintVisible,
  handleLoginSubmit,
  handleRegisterSubmit,
}: StudentAuthViewProps) {
  if (!isClientReady) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#fff",
        padding: "20px",
        direction: "rtl"
      }}>
        <div style={{
          width: "68px",
          height: "68px",
          borderRadius: "20px",
          overflow: "hidden",
          marginBottom: "16px",
          boxShadow: "0 10px 30px rgba(37, 99, 235, 0.4)"
        }}>
          <img src="/icon-192.png" alt="بوابة الطالب" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#f8fafc", marginBottom: "6px" }}>
          بوابة الطالب — قسم التربية الفنية
        </div>
        <div style={{ fontSize: "12px", color: "#38bdf8" }}>
          جاري فتح البوابة والتحقق من الحساب...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px", maxWidth: "440px", margin: "0 auto", direction: "rtl" }}>
      <div>
        {/* زر سحب الكيو ار كود */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <Link 
            href="/?tab=qr" 
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("fania_last_portal");
                localStorage.setItem("fania_bypass_update_notice", "1");
              }
            }}
            style={{ color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12.5px", fontWeight: "bold" }}
          >
            <QrCode size={15} />
            <span>سحب الكيو ار كود</span>
          </Link>
          <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>نظام فنية الموحد</span>
        </div>

        <header style={{ textAlign: "center", paddingTop: "10px", marginBottom: "16px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "14px", overflow: "hidden", marginBottom: "6px", boxShadow: "0 8px 20px rgba(37, 99, 235, 0.35)" }}>
            <img src="/icon-192.png" alt="فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginBottom: "3px" }}>
            بوابة فنية الذكية
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>
            تسجيل الحضور، متابعة التقييمات، ورفع الأعمال الفنية
          </p>
        </header>

        {/* مفتاح التبديل بين تسجيل جديد وتسجيل الدخول */}
        <div style={{ display: "flex", background: "#141b29", padding: "4px", borderRadius: "12px", border: "1px solid #2a374f", marginBottom: "18px" }}>
          <button
            type="button"
            onClick={() => { setAuthMode("register"); setErrorMsg(""); }}
            className="btn-compact"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: authMode === "register" ? "#2563eb" : "transparent",
              color: authMode === "register" ? "#fff" : "#94a3b8",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
              border: "none"
            }}
          >
            تسجيل طالب جديد 📝
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setErrorMsg(""); }}
            className="btn-compact"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: authMode === "login" ? "#2563eb" : "transparent",
              color: authMode === "login" ? "#fff" : "#94a3b8",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
              border: "none"
            }}
          >
            تسجيل الدخول 🔐
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", borderRadius: "10px", marginBottom: "14px", fontSize: "12px" }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        {authMode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="glass-card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                كود الطالب الجامعي:
              </label>
              <input
                type="text"
                placeholder="أدخل كودك (مثل: 0001)..."
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                style={{ width: "100%", padding: "12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold" }}>
                  الرقم السري (PIN):
                </label>
                <span style={{ color: "#64748b", fontSize: "11px" }}>مشفر وخاص بالطالب</span>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showLoginPin ? "text" : "password"}
                  placeholder="أدخل الرقم السري الخاص بك..."
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  style={{
                    width: "100%",
                    height: "46px",
                    padding: "0 44px 0 14px",
                    textAlign: "center",
                    direction: "ltr",
                    background: "#141b29",
                    border: "1px solid #2a374f",
                    borderRadius: "10px",
                    color: "#fbbf24",
                    fontSize: "16px",
                    fontWeight: "bold",
                    letterSpacing: showLoginPin ? "normal" : "4px",
                    boxSizing: "border-box",
                    margin: 0
                  }}
                />
                <button
                  type="button"
                  className="btn-compact"
                  onClick={() => setShowLoginPin(!showLoginPin)}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "32px",
                    height: "32px",
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 0,
                    margin: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  title={showLoginPin ? "إخفاء الرقم السري" : "إظهار الرقم السري"}
                >
                  {showLoginPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <span style={{ color: "#38bdf8", fontSize: "11px", lineHeight: "1.4", display: "inline-block" }}>
                  💡 الدخول يتطلب كود الطالب والرقم السري المعتمد. إذا لم يكن لديك رقم سري، راجع منسق المنظومة.
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "جاري التحقق..." : "تسجيل الدخول 🚀"}
            </button>
          </form>
        ) : (
          /* نموذج تسجيل طالب جديد */
          <form onSubmit={handleRegisterSubmit} className="glass-card" style={{ padding: "20px" }}>
            {matchedStudent && (
              <div style={{
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(37, 99, 235, 0.2))",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "16px",
                textAlign: "right"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "16px" }}>✨</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#34d399" }}>
                    استكمال تفعيل الحساب وتأكيد الهوية
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#e2e8f0", lineHeight: "1.5" }}>
                  مرحباً <b>{matchedStudent.full_name}</b> ({matchedStudent.academic_year} • سكشن {matchedStudent.section || 'عام'}).
                  <div style={{ color: "#93c5fd", marginTop: "2px" }}>
                    يرجى إدخال رقم هاتفك ورفع بطاقة الرقم القومي أو الكارنيه لإرسال طلب الاعتماد فوراً.
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold" }}>
                  كود الطالب الجامعي:
                </label>
                {matchedStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      setMatchedStudent(null);
                      setRegCode("");
                      setRegName("");
                      setLookupStatus(null);
                      setLookupMessage(null);
                    }}
                    style={{ background: "transparent", border: "none", color: "#60a5fa", fontSize: "11px", cursor: "pointer", textDecoration: "underline" }}
                  >
                    تغيير الكود 🔄
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="أدخل كودك الجامعي (مثل: 0001)..."
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                readOnly={!!matchedStudent}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: matchedStudent ? "rgba(16, 185, 129, 0.08)" : "#141b29",
                  border: matchedStudent ? "1px solid #10b981" : "1px solid #2a374f",
                  borderRadius: "10px",
                  color: matchedStudent ? "#34d399" : "#fff",
                  fontSize: "14px",
                  fontWeight: matchedStudent ? "bold" : "normal"
                }}
              />
              {isLookingUpCode && (
                <div style={{ color: "#38bdf8", fontSize: "11px", marginTop: "4px" }}>جاري التحقق من الكود...</div>
              )}
              {matchedStudent && (
                <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "6px 10px", borderRadius: "8px", marginTop: "6px", fontSize: "12px" }}>
                  ✓ {matchedStudent.full_name} • {matchedStudent.academic_year} (سكشن {matchedStudent.section || 'عام'})
                </div>
              )}
              {lookupStatus?.isAlreadyActive && (
                <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid #10b981", color: "#34d399", padding: "12px", borderRadius: "10px", marginTop: "8px", fontSize: "12px" }}>
                  <div style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>🎉 حسابك مسجل ومفعل بالفعل على المنظومة!</div>
                  <div style={{ fontSize: "11px", color: "#a7f3d0", marginBottom: "10px" }}>تم اعتماد وتفعيل حسابك بنجاح. يمكنك الدخول للوحة تحكمك ومقرراتك فوراً.</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRegCode(matchedStudent?.student_code || regCode);
                        setEnteredPin("");
                        setAuthMode("login");
                        setErrorMsg("");
                      }}
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", fontWeight: "bold", fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <span>🔐</span>
                      <span>تسجيل الدخول بالرقم السري</span>
                    </button>
                  </div>
                </div>
              )}
              {lookupStatus?.isPending && (
                <div style={{ background: "rgba(56, 189, 248, 0.15)", border: "1px solid #38bdf8", color: "#bae6fd", padding: "10px 12px", borderRadius: "10px", marginTop: "8px", fontSize: "12px" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>⏳ حسابك مسجل وبانتظار اعتماد المنسق</div>
                  <div style={{ fontSize: "11px", color: "#e0f2fe", marginBottom: "8px" }}>تم استلام بياناتك وبطاقتك وهي بانتظار اعتماد المنسق.</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (matchedStudent) {
                        setCurrentStudent(matchedStudent);
                        setAccountStatus("pending");
                      }
                    }}
                    style={{ background: "#38bdf8", color: "#000", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}
                  >
                    عرض شاشة الاعتماد والمنسقين 🔍
                  </button>
                </div>
              )}
              {lookupMessage && (
                <div style={{ color: "#f87171", fontSize: "11px", marginTop: "4px" }}>{lookupMessage}</div>
              )}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                الاسم الكامل:
              </label>
              <input
                type="text"
                placeholder="اسم الطالب الرباعي..."
                value={regName || matchedStudent?.full_name || ""}
                onChange={(e) => setRegName(e.target.value)}
                readOnly={!!matchedStudent}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: matchedStudent ? "rgba(255, 255, 255, 0.05)" : "#141b29",
                  border: "1px solid #2a374f",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "14px"
                }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                رقم الموبايل (واتساب):
              </label>
              <input
                type="tel"
                placeholder="01xxxxxxxxx"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value)}
                style={{ width: "100%", padding: "12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px", direction: "ltr", textAlign: "right" }}
              />
            </div>

            {/* تصوير بطاقة الهوية القومية */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                صورة بطاقة الرقم القومي أو كارنيه الكلية (إجباري لتأكيد الهوية): *
              </label>
              {idCardPhoto ? (
                <div style={{ position: "relative", height: "130px", borderRadius: "10px", overflow: "hidden", border: "2px solid #10b981", background: "#000" }}>
                  <img src={idCardPhoto} alt="البطاقة" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <button
                    type="button"
                    onClick={() => setIdCardPhoto(null)}
                    className="btn-compact"
                    style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(239, 68, 68, 0.8)", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                  >
                    تغيير الصورة
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => startCamera("id")}
                    style={{ flex: 1, padding: "10px", background: "#1e293b", color: "#38bdf8", border: "1px dashed #38bdf8", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Camera size={16} />
                    <span>فتح الكاميرا 📷</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => idFileInputRef.current?.click()}
                    style={{ flex: 1, padding: "10px", background: "#1e293b", color: "#94a3b8", border: "1px dashed #475569", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <FolderOpen size={16} />
                    <span>من الهاتف 📁</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !regCode || !regMobile || !idCardPhoto}
              style={{
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #2563eb, #10b981)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: "bold",
                fontSize: "15px",
                cursor: (loading || !regCode || !regMobile || !idCardPhoto) ? "not-allowed" : "pointer",
                opacity: (loading || !regCode || !regMobile || !idCardPhoto) ? 0.6 : 1,
                boxShadow: "0 4px 15px rgba(16, 185, 129, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              <CheckCircle2 size={18} />
              <span>{loading ? "جاري إرسال البيانات..." : "تأكيد واستكمال تفعيل الحساب 🚀"}</span>
            </button>
          </form>
        )}
      </div>

      <footer style={{ textAlign: "center", paddingTop: "16px", color: "#64748b", fontSize: "11px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </footer>

      {/* نافذة كاميرا بطاقة الهوية الذكية */}
      {showIdCamera && (
        <div style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          maxHeight: "100dvh",
          background: "#000",
          zIndex: 999999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          direction: "rtl"
        }}>
          <div style={{
            flexShrink: 0,
            padding: "12px 16px",
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            zIndex: 10
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🪪</span>
              <span style={{ color: "#fff", fontSize: "14px", fontWeight: "bold" }}>تصوير بطاقة الرقم القومي</span>
            </div>
            <button
              type="button"
              onClick={() => { stopCamera(); setShowIdCamera(false); }}
              style={{
                background: "rgba(239, 68, 68, 0.25)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.5)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              إلغاء ✕
            </button>
          </div>

          <div style={{
            flex: "1 1 0%",
            minHeight: 0,
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#05070f"
          }}>
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{
              position: "absolute",
              width: "84%",
              maxWidth: "380px",
              height: "56%",
              maxHeight: "240px",
              border: "3px dashed #38bdf8",
              borderRadius: "14px",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45), 0 0 25px rgba(56, 189, 248, 0.4)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <span style={{
                color: "#38bdf8",
                fontSize: "11px",
                fontWeight: "bold",
                background: "rgba(0, 0, 0, 0.65)",
                padding: "4px 10px",
                borderRadius: "6px"
              }}>
                ضع البطاقة داخل الإطار 🪪
              </span>
            </div>
          </div>

          <div style={{
            flexShrink: 0,
            padding: "16px 20px",
            paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
            background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95), #070a12)",
            borderTop: "1px solid rgba(56, 189, 248, 0.2)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            zIndex: 10
          }}>
            <button
              type="button"
              onClick={async () => {
                const photo = captureVideoFrame();
                if (photo) {
                  try {
                    const comp = await compressImageToWebP(photo, 1000, 0.75);
                    setIdCardPhoto(comp.dataUrl);
                  } catch {
                    setIdCardPhoto(photo);
                  }
                  stopCamera();
                  setShowIdCamera(false);
                }
              }}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "#ffffff",
                border: "5px solid #38bdf8",
                boxShadow: "0 0 25px rgba(56, 189, 248, 0.8)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                outline: "none",
                transition: "transform 0.15s ease",
                margin: "0 auto"
              }}
              title="التقاط صورة البطاقة"
            >
              <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#0284c7" }} />
            </button>
            <span style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "bold" }}>
              اضغط هنا لالتقاط الصورة 📸
            </span>
          </div>
        </div>
      )}

      {/* نافذة تثبيت تطبيق فنية لطلاب الأندرويد والهواتف الذكية */}
      {showPwaPrompt && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          zIndex: 999999,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "16px",
          direction: "rtl"
        }}>
          <div className="animate-fade-in" style={{
            width: "100%",
            maxWidth: "420px",
            background: "linear-gradient(180deg, #182235, #0d131f)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "20px",
            padding: "24px 20px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
            textAlign: "center"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              overflow: "hidden",
              margin: "0 auto 14px",
              boxShadow: "0 8px 25px rgba(37, 99, 235, 0.5)",
              border: "2px solid #38bdf8"
            }}>
              <img src="/icon-192.png" alt="فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            <h3 style={{ fontSize: "20px", fontWeight: "900", color: "#fff", margin: "0 0 6px" }}>
              قم بتثبيت تطبيق فنية 📱
            </h3>
            <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold", marginBottom: "16px" }}>
              لمتابعة حضورك وتقييماتك بشكل دائم
            </div>

            <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px 14px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: "18px", textAlign: "right", fontSize: "12px", color: "#cbd5e1", lineHeight: "1.9" }}>
              <div>⚡ <b>وصول فوري:</b> بنقرة واحدة من شاشتك الرئيسية دون الحاجة للرابط.</div>
              <div>🔔 <b>إشعارات حية:</b> متابعة فورية لدرجات التقييم والغياب.</div>
              <div>📷 <b>كاميرا ذكية:</b> رفع ومزامنة الأعمال الفنية ثلاثية وثنائية الأبعاد.</div>
            </div>

            {pwaHintVisible && (
              <div style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", color: "#fbbf24", padding: "10px", borderRadius: "10px", fontSize: "12px", marginBottom: "14px" }}>
                💡 اضغط على قائمة المتصفح (الثلاث نقاط ⋮ أعلى الشاشة) ثم اختر <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b>.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={async () => {
                  if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const choice = await deferredPrompt.userChoice;
                    if (choice.outcome === "accepted") {
                      setShowPwaPrompt(false);
                      sessionStorage.setItem("pwa_install_dismissed", "1");
                    }
                    setDeferredPrompt(null);
                  } else {
                    setPwaHintVisible(true);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 15px rgba(37, 99, 235, 0.4)"
                }}
              >
                <span>تثبيت التطبيق الآن 📱</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPwaPrompt(false);
                  sessionStorage.setItem("pwa_install_dismissed", "1");
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                المتابعة عبر المتصفح 🌐
              </button>
            </div>
          </div>
        </div>
      )}

      {/* عناصر input و canvas مخفية للكاميرا */}
      <input type="file" accept="image/*" capture="environment" ref={idFileInputRef} style={{ display: "none" }} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) {
          try {
            const comp = await compressImageToWebP(f, 1000, 0.75);
            setIdCardPhoto(comp.dataUrl);
          } catch {
            const r = new FileReader();
            r.onload = (ev) => setIdCardPhoto(ev.target?.result as string);
            r.readAsDataURL(f);
          }
        }
      }} />
    </div>
  );
}
