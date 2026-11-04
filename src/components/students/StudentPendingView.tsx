"use client";

import React from "react";
import { KeyRound, LogOut, RotateCw, ShieldCheck, UserCheck } from "lucide-react";
import { formatStudentCode } from "@/lib/students/codeHelper";

interface StudentPendingViewProps {
  currentStudent: any;
  coordinators: any[];
  loading: boolean;
  errorMsg: string;
  successMsg: string;
  showManualPinBox: boolean;
  setShowManualPinBox: (v: boolean) => void;
  enteredPin: string;
  setEnteredPin: (v: string) => void;
  handleLogout: () => void;
  handleRefreshStatus: () => void;
  handleVerifyPinSubmit: () => void;
}

export default function StudentPendingView({
  currentStudent,
  coordinators,
  loading,
  errorMsg,
  successMsg,
  showManualPinBox,
  setShowManualPinBox,
  enteredPin,
  setEnteredPin,
  handleLogout,
  handleRefreshStatus,
  handleVerifyPinSubmit,
}: StudentPendingViewProps) {
  return (
    <div style={{ minHeight: "100vh", padding: "16px", maxWidth: "480px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      {/* شريط أعلى به اسم الطالب وزر خروج مدمج */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        gap: "10px",
        padding: "10px 14px", 
        background: "#141b29", 
        borderRadius: "14px", 
        border: "1px solid #2a374f", 
        marginBottom: "16px" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
          <div style={{ width: "36px", height: "36px", minWidth: "36px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
            <UserCheck size={18} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentStudent.full_name}</div>
            <div style={{ color: "#94a3b8", fontSize: "11px" }}>كود: {formatStudentCode(currentStudent.student_code)}</div>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          className="btn-compact"
          title="تسجيل الخروج"
          style={{ 
            background: "rgba(239, 68, 68, 0.12)",
            color: "#f87171",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            padding: "6px 12px",
            cursor: "pointer"
          }}
        >
          <LogOut size={13} />
          <span>خروج</span>
        </button>
      </div>

      {/* كارت انتظار اعتماد الهوية */}
      <div className="glass-card animate-fade-in" style={{ padding: "20px 16px", textAlign: "center", marginBottom: "16px" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", marginBottom: "12px", boxShadow: "0 0 20px rgba(245, 158, 11, 0.2)" }}>
          <ShieldCheck size={36} />
        </div>

        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff", marginBottom: "8px", lineHeight: "1.3" }}>
          الحساب مسجل وبانتظار اعتماد المنسق ⏳
        </h2>

        <p style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.7", marginBottom: "16px" }}>
          أهلاً بك يا <b>{currentStudent.full_name}</b>. تم استلام بيانات تسجيلك وصورة بطاقتك بنجاح. لتفعيل حسابك، يرجى التوجه إلى منسق النظام لمطابقة الهوية وتفعيل الحساب:
        </p>

        {errorMsg && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "12px" }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "12px" }}>
            ✓ {successMsg}
          </div>
        )}

        {/* قائمة المنسقين بالأسماء فقط */}
        {coordinators.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
            {coordinators.slice(0, 2).map((c, idx) => (
              <div key={c.id || idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  background: "rgba(56, 189, 248, 0.12)",
                  border: "1px solid #38bdf8",
                  padding: "10px 18px",
                  borderRadius: "12px",
                  color: "#38bdf8",
                  fontWeight: "bold",
                  fontSize: "14px",
                  boxShadow: "0 2px 10px rgba(56, 189, 248, 0.15)"
                }}>
                  👤 {c.full_name}
                </div>
                {idx < Math.min(coordinators.length, 2) - 1 && (
                  <span style={{ color: "#94a3b8", fontSize: "13px", fontWeight: "bold" }}>أو</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px dashed #38bdf8", padding: "10px 16px", borderRadius: "10px", color: "#38bdf8", fontWeight: "bold", fontSize: "13px", display: "inline-block", marginBottom: "18px" }}>
            👤 منسق النظام المعتمد
          </div>
        )}

        {/* مؤشر الفحص التلقائي الحي */}
        <div style={{
          background: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          borderRadius: "12px",
          padding: "14px",
          marginBottom: "16px",
          textAlign: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#34d399", fontSize: "13px", fontWeight: "bold", marginBottom: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
            <span>جاري التحقق من التفعيل تلقائياً...</span>
          </div>
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: "1.6" }}>
            بمجرد أن يقوم المنسق بمطابقة بياناتك واعتماد حسابك، ستظهر لك شاشة الدخول لإدخال رقمك السري وفتح لوحة تحكمك ومقرراتك.
          </p>
        </div>

        {/* زر الفحص والتحديث اليدوي الفوري المباشر */}
        <button
          onClick={handleRefreshStatus}
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            border: "none",
            color: "#fff",
            borderRadius: "10px",
            fontWeight: "bold",
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)"
          }}
        >
          <RotateCw size={16} className={loading ? "animate-spin" : ""} />
          <span>تحديث حالة الاعتماد الآن (دخول فوري) 🔄</span>
        </button>

        {/* خيار يدوي لإدخال الرقم السري (PIN) */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          {!showManualPinBox ? (
            <button
              type="button"
              className="btn-compact"
              onClick={() => setShowManualPinBox(true)}
              style={{
                background: "rgba(51, 65, 85, 0.4)",
                border: "1px dashed #475569",
                borderRadius: "8px",
                color: "#94a3b8",
                fontSize: "12px",
                padding: "8px 14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s"
              }}
            >
              <KeyRound size={14} color="#f59e0b" />
              <span>لديك رمز PIN يدوي من المنسق؟ اضغط هنا لكتابته</span>
            </button>
          ) : (
            <div style={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1.5px solid #3b82f6",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "right",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid #1e293b", paddingBottom: "8px" }}>
                <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                  <KeyRound size={16} color="#fbbf24" />
                  <span>إدخال رمز التفعيل اليدوي (PIN)</span>
                </div>
                <button
                  type="button"
                  className="btn-compact"
                  onClick={() => { setShowManualPinBox(false); setEnteredPin(""); }}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  إلغاء ✕
                </button>
              </div>

              <p style={{ color: "#94a3b8", fontSize: "11px", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                إذا سلمك المنسق رمز PIN ورقياً، أدخله هنا لتفعيل حسابك فوراً:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="رمز PIN المكون من 6 أرقام..."
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPinSubmit()}
                  style={{
                    width: "100%",
                    height: "46px",
                    padding: "0 14px",
                    background: "#090d16",
                    border: "1.5px solid #2563eb",
                    borderRadius: "10px",
                    color: "#fbbf24",
                    fontSize: "16px",
                    fontWeight: "bold",
                    textAlign: "center",
                    letterSpacing: "4px",
                    boxSizing: "border-box",
                    margin: 0,
                    outline: "none"
                  }}
                />

                <button
                  type="button"
                  className="btn-compact"
                  onClick={handleVerifyPinSubmit}
                  disabled={loading || !enteredPin.trim()}
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 16px",
                    background: (!enteredPin.trim() || loading) 
                      ? "#1e293b" 
                      : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: (!enteredPin.trim() || loading) ? "#64748b" : "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: (!enteredPin.trim() || loading) ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxSizing: "border-box",
                    margin: 0,
                    boxShadow: (!enteredPin.trim() || loading) ? "none" : "0 4px 12px rgba(37, 99, 235, 0.3)"
                  }}
                >
                  <span>تفعيل الحساب بالرمز 🔓</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", color: "#64748b", fontSize: "11px", marginBottom: "10px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </div>
    </div>
  );
}
