"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  FolderOpen,
  Globe,
  Lightbulb,
  Lock,
  LogIn,
  QrCode,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
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
        background: "var(--background)",
        color: "var(--text)",
        padding: "20px",
        direction: "rtl"
      }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "14px",
          overflow: "hidden",
          marginBottom: "16px",
          border: "1px solid var(--border-light)"
        }}>
          <img src="/icon-192.png" alt="بوابة الطالب" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ fontSize: "17px", fontWeight: 600, color: "var(--text)", marginBottom: "6px" }}>
          بوابة الطالب — قسم التربية الفنية
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--accent-ink)" }}>
          جاري فتح البوابة والتحقق من الحساب...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px", maxWidth: "440px", margin: "0 auto", direction: "rtl" }}>
      <div>
        {/* زر سحب الكيو ار كود */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <Link 
            href="/?tab=qr" 
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("fania_last_portal");
                localStorage.setItem("fania_bypass_update_notice", "1");
              }
            }}
            style={{ color: "var(--accent-ink)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 500 }}
          >
            <QrCode size={15} strokeWidth={1.5} />
            <span>سحب الكيو ار كود</span>
          </Link>
          <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 500 }}>نظام فنية الموحد</span>
        </div>

        <header style={{ textAlign: "center", paddingTop: "8px", marginBottom: "16px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "12px", overflow: "hidden", marginBottom: "8px", border: "1px solid var(--border-light)" }}>
            <img src="/icon-192.png" alt="فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text)", margin: "0 0 4px 0" }}>
            بوابة فنية الذكية
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "12.5px", margin: 0 }}>
            تسجيل الحضور، متابعة التقييمات، ورفع الأعمال الفنية
          </p>
        </header>

        {/* مفتاح التبديل بين تسجيل جديد وتسجيل الدخول */}
        <div style={{ display: "flex", background: "var(--surface)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-light)", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => { setAuthMode("register"); setErrorMsg(""); }}
            className="btn-compact"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: authMode === "register" ? "var(--primary)" : "transparent",
              color: authMode === "register" ? "#ffffff" : "var(--text-secondary)",
              fontWeight: 500,
              fontSize: "13px",
              cursor: "pointer",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
          >
            <UserPlus size={15} strokeWidth={1.5} />
            <span>تسجيل طالب جديد</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setErrorMsg(""); }}
            className="btn-compact"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: authMode === "login" ? "var(--primary)" : "transparent",
              color: authMode === "login" ? "#ffffff" : "var(--text-secondary)",
              fontWeight: 500,
              fontSize: "13px",
              cursor: "pointer",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
          >
            <Lock size={15} strokeWidth={1.5} />
            <span>تسجيل الدخول</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "var(--error-ink)", padding: "10px 12px", borderRadius: "8px", marginBottom: "14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={15} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        {authMode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="glass-card" style={{ padding: "20px", borderRadius: "16px" }}>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>
                كود الطالب الجامعي:
              </label>
              <input
                type="text"
                placeholder="أدخل كودك (مثل: 0001)..."
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                className="tabular-nums"
                style={{ width: "100%", padding: "12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500 }}>
                  الرقم السري (PIN):
                </label>
                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>مشفر وخاص بالطالب</span>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showLoginPin ? "text" : "password"}
                  placeholder="أدخل الرقم السري الخاص بك..."
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  className="tabular-nums"
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 44px 0 14px",
                    textAlign: "center",
                    direction: "ltr",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    color: "var(--warning-ink)",
                    fontSize: "16px",
                    fontWeight: 600,
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
                    left: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "32px",
                    height: "32px",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    padding: 0,
                    margin: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  title={showLoginPin ? "إخفاء الرقم السري" : "إظهار الرقم السري"}
                >
                  {showLoginPin ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <Lightbulb size={13} strokeWidth={1.5} color="var(--accent-ink)" style={{ flexShrink: 0 }} />
                <span style={{ color: "var(--accent-ink)", fontSize: "11px", lineHeight: 1.4 }}>
                  الدخول يتطلب كود الطالب والرقم السري المعتمد. إذا لم يكن لديك رقم سري، راجع منسق المنظومة.
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--primary)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 500,
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              <LogIn size={16} strokeWidth={1.5} />
              <span>{loading ? "جاري التحقق..." : "تسجيل الدخول"}</span>
            </button>
          </form>
        ) : (
          /* نموذج تسجيل طالب جديد */
          <form onSubmit={handleRegisterSubmit} className="glass-card" style={{ padding: "20px", borderRadius: "16px" }}>
            {matchedStudent && (
              <div style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "16px",
                textAlign: "right"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <Sparkles size={15} strokeWidth={1.5} color="var(--success-ink)" />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--success-ink)" }}>
                    استكمال تفعيل الحساب وتأكيد الهوية
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text)", lineHeight: 1.5 }}>
                  مرحباً <strong style={{ fontWeight: 600 }}>{matchedStudent.full_name}</strong> ({matchedStudent.academic_year} • سكشن {matchedStudent.section || 'عام'}).
                  <div style={{ color: "var(--accent-ink)", marginTop: "2px" }}>
                    يرجى إدخال رقم هاتفك ورفع بطاقة الرقم القومي أو الكارنيه لإرسال طلب الاعتماد فوراً.
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500 }}>
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
                    style={{ background: "transparent", border: "none", color: "var(--accent-ink)", fontSize: "11.5px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", padding: 0 }}
                  >
                    <RefreshCw size={12} strokeWidth={1.5} />
                    <span>تغيير الكود</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="أدخل كودك الجامعي (مثل: 0001)..."
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                readOnly={!!matchedStudent}
                className="tabular-nums"
                style={{
                  width: "100%",
                  padding: "12px",
                  background: matchedStudent ? "rgba(16, 185, 129, 0.08)" : "var(--bg-deep)",
                  border: matchedStudent ? "1px solid var(--success)" : "1px solid var(--border-light)",
                  borderRadius: "8px",
                  color: matchedStudent ? "var(--success-ink)" : "var(--text)",
                  fontSize: "14px",
                  fontWeight: matchedStudent ? 600 : 400
                }}
              />
              {isLookingUpCode && (
                <div style={{ color: "var(--accent-ink)", fontSize: "11.5px", marginTop: "4px" }}>جاري التحقق من الكود...</div>
              )}
              {matchedStudent && (
                <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "var(--success-ink)", padding: "8px 10px", borderRadius: "8px", marginTop: "6px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Check size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  <span>{matchedStudent.full_name} • {matchedStudent.academic_year} (سكشن {matchedStudent.section || 'عام'})</span>
                </div>
              )}
              {lookupStatus?.isAlreadyActive && (
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "var(--success-ink)", padding: "12px", borderRadius: "10px", marginTop: "8px", fontSize: "12px" }}>
                  <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={15} strokeWidth={1.5} />
                    <span>حسابك مسجل ومفعل بالفعل على المنظومة</span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginBottom: "10px" }}>تم اعتماد وتفعيل حسابك بنجاح. يمكنك الدخول للوحة تحكمك ومقرراتك فوراً.</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRegCode(matchedStudent?.student_code || regCode);
                        setEnteredPin("");
                        setAuthMode("login");
                        setErrorMsg("");
                      }}
                      style={{ background: "var(--success)", color: "#ffffff", border: "none", borderRadius: "8px", padding: "8px 14px", fontWeight: 500, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <Lock size={14} strokeWidth={1.5} />
                      <span>تسجيل الدخول بالرقم السري</span>
                    </button>
                  </div>
                </div>
              )}
              {lookupStatus?.isPending && (
                <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.35)", color: "var(--accent-ink)", padding: "10px 12px", borderRadius: "10px", marginTop: "8px", fontSize: "12px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={14} strokeWidth={1.5} />
                    <span>حسابك مسجل وبانتظار اعتماد المنسق</span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginBottom: "8px" }}>تم استلام بياناتك وبطاقتك وهي بانتظار اعتماد المنسق.</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (matchedStudent) {
                        setCurrentStudent(matchedStudent);
                        setAccountStatus("pending");
                      }
                    }}
                    style={{ background: "var(--primary)", color: "#ffffff", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 500, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Search size={13} strokeWidth={1.5} />
                    <span>عرض شاشة الاعتماد والمنسقين</span>
                  </button>
                </div>
              )}
              {lookupMessage && (
                <div style={{ color: "var(--error-ink)", fontSize: "11.5px", marginTop: "4px" }}>{lookupMessage}</div>
              )}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>
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
                  background: matchedStudent ? "var(--surface-hover)" : "var(--bg-deep)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "14px"
                }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>
                رقم الموبايل (واتساب):
              </label>
              <input
                type="tel"
                placeholder="01xxxxxxxxx"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value)}
                className="tabular-nums"
                style={{ width: "100%", padding: "12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", fontSize: "14px", direction: "ltr", textAlign: "right" }}
              />
            </div>

            {/* تصوير بطاقة الهوية القومية */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>
                صورة بطاقة الرقم القومي أو كارنيه الكلية (إجباري لتأكيد الهوية): *
              </label>
              {idCardPhoto ? (
                <div style={{ position: "relative", height: "130px", borderRadius: "10px", overflow: "hidden", border: "1.5px solid var(--success)", background: "#000" }}>
                  <img src={idCardPhoto} alt="البطاقة" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <button
                    type="button"
                    onClick={() => setIdCardPhoto(null)}
                    className="btn-compact"
                    style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(239, 68, 68, 0.85)", color: "#ffffff", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                  >
                    تغيير الصورة
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => startCamera("id")}
                    style={{ flex: 1, padding: "10px", background: "var(--surface-hover)", color: "var(--accent-ink)", border: "1px dashed rgba(56, 189, 248, 0.5)", borderRadius: "8px", fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Camera size={16} strokeWidth={1.5} />
                    <span>فتح الكاميرا</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => idFileInputRef.current?.click()}
                    style={{ flex: 1, padding: "10px", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", borderRadius: "8px", fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <FolderOpen size={16} strokeWidth={1.5} />
                    <span>من الهاتف</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !regCode || !regMobile || !idCardPhoto}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: (loading || !regCode || !regMobile || !idCardPhoto) ? "var(--secondary)" : "var(--primary)",
                color: (loading || !regCode || !regMobile || !idCardPhoto) ? "var(--text-muted)" : "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 500,
                fontSize: "14px",
                cursor: (loading || !regCode || !regMobile || !idCardPhoto) ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              <CheckCircle2 size={17} strokeWidth={1.5} />
              <span>{loading ? "جاري إرسال البيانات..." : "تأكيد واستكمال تفعيل الحساب"}</span>
            </button>
          </form>
        )}
      </div>

      <footer style={{ textAlign: "center", paddingTop: "16px", color: "var(--text-muted)", fontSize: "11px" }}>
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
          background: "#000000",
          zIndex: 999999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          direction: "rtl"
        }}>
          <div style={{
            flexShrink: 0,
            padding: "12px 16px",
            background: "var(--surface)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
            zIndex: 10
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CreditCard size={16} strokeWidth={1.5} color="var(--accent-ink)" />
              <span style={{ color: "var(--text)", fontSize: "14px", fontWeight: 600 }}>تصوير بطاقة الرقم القومي</span>
            </div>
            <button
              type="button"
              onClick={() => { stopCamera(); setShowIdCamera(false); }}
              style={{
                background: "rgba(239, 68, 68, 0.18)",
                color: "var(--error-ink)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <X size={14} strokeWidth={1.5} />
              <span>إلغاء</span>
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
            background: "var(--bg-deep)"
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
              border: "2.5px dashed var(--accent-ink)",
              borderRadius: "12px",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <span style={{
                color: "var(--accent-ink)",
                fontSize: "11.5px",
                fontWeight: 500,
                background: "rgba(11, 13, 20, 0.8)",
                padding: "4px 10px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <CreditCard size={13} strokeWidth={1.5} />
                <span>ضع البطاقة داخل الإطار</span>
              </span>
            </div>
          </div>

          <div style={{
            flexShrink: 0,
            padding: "16px 20px",
            paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
            background: "var(--bg-deep)",
            borderTop: "1px solid var(--border)",
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
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                background: "#ffffff",
                border: "4px solid var(--accent-ink)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                outline: "none",
                transition: "transform 0.15s var(--ease-out)",
                margin: "0 auto"
              }}
              title="التقاط صورة البطاقة"
            >
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--primary)" }} />
            </button>
            <span style={{ color: "var(--accent-ink)", fontSize: "12px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Camera size={14} strokeWidth={1.5} />
              <span>اضغط هنا لالتقاط الصورة</span>
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
          background: "rgba(11, 13, 20, 0.85)",
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
            background: "var(--surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "16px",
            padding: "24px 20px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.55)",
            textAlign: "center"
          }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "14px",
              overflow: "hidden",
              margin: "0 auto 12px",
              border: "1.5px solid var(--accent-ink)"
            }}>
              <img src="/icon-192.png" alt="فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", margin: "0 0 6px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <Smartphone size={18} strokeWidth={1.5} color="var(--accent-ink)" />
              <span>قم بتثبيت تطبيق فنية</span>
            </h3>
            <div style={{ color: "var(--accent-ink)", fontSize: "13px", fontWeight: 500, marginBottom: "16px" }}>
              لمتابعة حضورك وتقييماتك بشكل دائم
            </div>

            <div style={{ background: "var(--bg-deep)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "16px", textAlign: "right", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.85, display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={14} strokeWidth={1.5} color="var(--warning-ink)" style={{ flexShrink: 0 }} />
                <span><strong style={{ fontWeight: 600, color: "var(--text)" }}>وصول فوري:</strong> بنقرة واحدة من شاشتك الرئيسية دون الحاجة للرابط.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Bell size={14} strokeWidth={1.5} color="var(--accent-ink)" style={{ flexShrink: 0 }} />
                <span><strong style={{ fontWeight: 600, color: "var(--text)" }}>إشعارات حية:</strong> متابعة فورية لدرجات التقييم والغياب.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Camera size={14} strokeWidth={1.5} color="var(--success-ink)" style={{ flexShrink: 0 }} />
                <span><strong style={{ fontWeight: 600, color: "var(--text)" }}>كاميرا ذكية:</strong> رفع ومزامنة الأعمال الفنية ثلاثية وثنائية الأبعاد.</span>
              </div>
            </div>

            {pwaHintVisible && (
              <div style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)", color: "var(--warning-ink)", padding: "10px 12px", borderRadius: "8px", fontSize: "12px", marginBottom: "14px", display: "flex", alignItems: "flex-start", gap: "8px", textAlign: "right" }}>
                <Lightbulb size={15} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>اضغط على قائمة المتصفح (الثلاث نقاط أعلى الشاشة) ثم اختر <strong style={{ fontWeight: 600 }}>&quot;تثبيت التطبيق&quot;</strong> أو <strong style={{ fontWeight: 600 }}>&quot;إضافة إلى الشاشة الرئيسية&quot;</strong>.</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                  padding: "12px",
                  background: "var(--primary)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <Smartphone size={16} strokeWidth={1.5} />
                <span>تثبيت التطبيق الآن</span>
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
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <Globe size={15} strokeWidth={1.5} />
                <span>المتابعة عبر المتصفح</span>
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
