"use client";

import React from "react";
import { AlertTriangle, Check, Clock, KeyRound, LogOut, RotateCw, ShieldCheck, Unlock, User, UserCheck, X } from "lucide-react";
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
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        gap: "12px",
        padding: "12px 16px", 
        background: "var(--surface)", 
        borderRadius: "12px", 
        border: "1px solid var(--border-light)", 
        marginBottom: "16px" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
          <div style={{ width: "36px", height: "36px", minWidth: "36px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-ink)" }}>
            <UserCheck size={18} strokeWidth={1.5} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentStudent.full_name}</div>
            <div className="tabular-nums" style={{ color: "var(--text-secondary)", fontSize: "12px" }}>كود: {formatStudentCode(currentStudent.student_code)}</div>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          className="btn-compact"
          title="تسجيل الخروج"
          style={{ 
            background: "rgba(239, 68, 68, 0.12)",
            color: "var(--error-ink)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            padding: "6px 12px",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          <LogOut size={14} strokeWidth={1.5} />
          <span>خروج</span>
        </button>
      </div>

      <div className="glass-card animate-fade-in" style={{ padding: "24px 16px", textAlign: "center", marginBottom: "16px", borderRadius: "16px" }}>
        <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--warning-ink)", marginBottom: "12px" }}>
          <ShieldCheck size={28} strokeWidth={1.5} />
        </div>

        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)", margin: "0 0 8px 0", lineHeight: 1.4, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
          <Clock size={18} strokeWidth={1.5} color="var(--warning-ink)" />
          <span>الحساب مسجل وبانتظار اعتماد المنسق</span>
        </h2>

        <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.65, margin: "0 0 16px 0" }}>
          أهلاً بك يا <strong style={{ fontWeight: 600, color: "var(--text)" }}>{currentStudent.full_name}</strong>. تم استلام بيانات تسجيلك وصورة بطاقتك بنجاح. لتفعيل حسابك، يرجى التوجه إلى منسق النظام لمطابقة الهوية وتفعيل الحساب:
        </p>

        {errorMsg && (
          <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "var(--error-ink)", padding: "10px 12px", borderRadius: "8px", marginBottom: "16px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <AlertTriangle size={15} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "var(--success-ink)", padding: "10px 12px", borderRadius: "8px", marginBottom: "16px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <Check size={15} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {coordinators.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            {coordinators.slice(0, 2).map((c, idx) => (
              <div key={c.id || idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  background: "rgba(56, 189, 248, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  color: "var(--accent-ink)",
                  fontWeight: 500,
                  fontSize: "14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  <User size={15} strokeWidth={1.5} />
                  <span>{c.full_name}</span>
                </div>
                {idx < Math.min(coordinators.length, 2) - 1 && (
                  <span style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500 }}>أو</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px dashed rgba(56, 189, 248, 0.35)", padding: "10px 16px", borderRadius: "8px", color: "var(--accent-ink)", fontWeight: 500, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <User size={15} strokeWidth={1.5} />
            <span>منسق النظام المعتمد</span>
          </div>
        )}

        <div style={{
          background: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          borderRadius: "10px",
          padding: "12px 14px",
          marginBottom: "16px",
          textAlign: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--success-ink)", fontSize: "13px", fontWeight: 500, marginBottom: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)", display: "inline-block" }}></span>
            <span>جاري التحقق من التفعيل تلقائياً...</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
            بمجرد أن يقوم المنسق بمطابقة بياناتك واعتماد حسابك، ستظهر لك شاشة الدخول لإدخال رقمك السري وفتح لوحة تحكمك ومقرراتك.
          </p>
        </div>

        <button
          onClick={handleRefreshStatus}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "var(--primary)",
            border: "1px solid var(--primary)",
            color: "#ffffff",
            borderRadius: "8px",
            fontWeight: 500,
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <RotateCw size={16} strokeWidth={1.5} className={loading ? "animate-spin" : ""} />
          <span>تحديث حالة الاعتماد الآن (دخول فوري)</span>
        </button>

        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          {!showManualPinBox ? (
            <button
              type="button"
              className="btn-compact"
              onClick={() => setShowManualPinBox(true)}
              style={{
                background: "var(--surface-hover)",
                border: "1px dashed var(--border-light)",
                borderRadius: "8px",
                color: "var(--text-secondary)",
                fontSize: "12px",
                padding: "8px 14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "border-color 0.2s var(--ease-out), color 0.2s var(--ease-out)"
              }}
            >
              <KeyRound size={14} strokeWidth={1.5} color="var(--warning)" />
              <span>لديك رمز PIN يدوي من المنسق؟ اضغط هنا لكتابته</span>
            </button>
          ) : (
            <div style={{
              background: "var(--bg-deep)",
              border: "1px solid var(--border-light)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "right"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                <div style={{ color: "var(--accent-ink)", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  <KeyRound size={15} strokeWidth={1.5} color="var(--warning-ink)" />
                  <span>إدخال رمز التفعيل اليدوي (PIN)</span>
                </div>
                <button
                  type="button"
                  className="btn-compact"
                  onClick={() => { setShowManualPinBox(false); setEnteredPin(""); }}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <X size={13} strokeWidth={1.5} />
                  <span>إلغاء</span>
                </button>
              </div>

              <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: "0 0 12px 0", lineHeight: 1.5 }}>
                إذا سلمك المنسق رمز PIN ورقياً، أدخله هنا لتفعيل حسابك فوراً:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="رمز PIN المكون من 6 أرقام..."
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPinSubmit()}
                  className="tabular-nums"
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 14px",
                    background: "var(--surface)",
                    border: "1.5px solid var(--primary)",
                    borderRadius: "8px",
                    color: "var(--warning-ink)",
                    fontSize: "16px",
                    fontWeight: 600,
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
                      ? "var(--secondary)" 
                      : "var(--primary)",
                    color: (!enteredPin.trim() || loading) ? "var(--text-muted)" : "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: (!enteredPin.trim() || loading) ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxSizing: "border-box",
                    margin: 0
                  }}
                >
                  <Unlock size={15} strokeWidth={1.5} />
                  <span>تفعيل الحساب بالرمز</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "11px", marginBottom: "8px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </div>
    </div>
  );
}
