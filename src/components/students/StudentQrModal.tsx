"use client";

import React from "react";
import QRCode from "react-qr-code";
import { Check, Download, X } from "lucide-react";
import { formatStudentCode } from "@/lib/students/codeHelper";

interface StudentQrModalProps {
  student: any;
  isSavingQr: boolean;
  qrSavedSuccess: boolean;
  onDownloadQr: () => void;
  onClose: () => void;
}

export default function StudentQrModal({
  student,
  isSavingQr,
  qrSavedSuccess,
  onDownloadQr,
  onClose,
}: StudentQrModalProps) {
  if (!student) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(11, 13, 20, 0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 99999,
      padding: "16px"
    }}>
      <div className="glass-card animate-fade-in" style={{
        background: "var(--surface)",
        borderRadius: "16px",
        padding: "24px",
        width: "100%",
        maxWidth: "360px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
        border: "1px solid var(--border-light)"
      }}>
        <div style={{ marginBottom: "16px", color: "var(--text)", fontWeight: 600, fontSize: "16px", textAlign: "center" }}>
          كارت الـ QR الخاص بك
        </div>

        <div style={{ 
          background: "#ffffff", 
          padding: "16px", 
          borderRadius: "12px",
          border: "1px solid var(--border)"
        }}>
          <QRCode 
            id="student-qr-code"
            value={`كود الطالب: ${formatStudentCode(student.student_code)}\nاسم الطالب: ${student.full_name}`} 
            size={220} 
            level="H"
          />
        </div>

        <div className="tabular-nums" style={{ marginTop: "12px", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500, letterSpacing: "0.5px" }}>
          {student.student_code}
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "20px", width: "100%" }}>
          <button 
            onClick={onDownloadQr}
            disabled={isSavingQr}
            style={{
              flex: 1,
              padding: "12px",
              background: qrSavedSuccess
                ? "var(--success)"
                : isSavingQr
                ? "var(--secondary)"
                : "var(--primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: isSavingQr ? "wait" : "pointer",
              transition: "background-color 0.2s var(--ease-out)"
            }}
          >
            {isSavingQr ? (
              <>
                <div style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #ffffff",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }} />
                <span>جاري حفظ الكارت...</span>
              </>
            ) : qrSavedSuccess ? (
              <>
                <Check size={16} strokeWidth={1.5} />
                <span>تم حفظ الكارت بنجاح</span>
              </>
            ) : (
              <>
                <Download size={16} strokeWidth={1.5} />
                <span>حفظ كارت الـ QR</span>
              </>
            )}
          </button>
          
          <button 
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px",
              background: "rgba(239, 68, 68, 0.14)",
              color: "var(--error-ink)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <X size={16} strokeWidth={1.5} />
            <span>إغلاق</span>
          </button>
        </div>
      </div>
    </div>
  );
}
