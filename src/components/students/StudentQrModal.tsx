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
      background: "rgba(15, 23, 42, 0.9)",
      backdropFilter: "blur(5px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 99999,
      padding: "20px"
    }}>
      <div className="glass-card animate-fade-in" style={{
        background: "#1e293b",
        borderRadius: "20px",
        padding: "30px",
        width: "100%",
        maxWidth: "350px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        border: "1px solid rgba(56, 189, 248, 0.3)"
      }}>
        <div style={{ marginBottom: "20px", color: "#fff", fontWeight: "bold", fontSize: "16px", textAlign: "center" }}>
          كارت الـ QR الخاص بك
        </div>

        <div style={{ 
          background: "#fff", 
          padding: "20px", 
          borderRadius: "16px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
        }}>
          <QRCode 
            id="student-qr-code"
            value={`كود الطالب: ${formatStudentCode(student.student_code)}\nاسم الطالب: ${student.full_name}`} 
            size={220} 
            level="H"
          />
        </div>

        <div style={{ marginTop: "15px", color: "#94a3b8", fontSize: "14px", fontWeight: "bold" }}>
          {student.student_code}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "25px", width: "100%" }}>
          <button 
            onClick={onDownloadQr}
            disabled={isSavingQr}
            style={{
              flex: 1,
              padding: "12px",
              background: qrSavedSuccess
                ? "linear-gradient(135deg, #10b981, #059669)"
                : isSavingQr
                ? "#64748b"
                : "linear-gradient(135deg, #0ea5e9, #0284c7)",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: isSavingQr ? "wait" : "pointer",
              boxShadow: qrSavedSuccess
                ? "0 4px 14px rgba(16, 185, 129, 0.4)"
                : "0 4px 14px rgba(14, 165, 233, 0.3)",
              transition: "all 0.2s ease"
            }}
          >
            {isSavingQr ? (
              <>
                <div style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #fff",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }} />
                <span>جاري حفظ الكارت...</span>
              </>
            ) : qrSavedSuccess ? (
              <>
                <Check size={18} />
                <span>تم حفظ الكارت بنجاح ✓</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>حفظ كارت الـ QR</span>
              </>
            )}
          </button>
          
          <button 
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <X size={16} />
            <span>إغلاق</span>
          </button>
        </div>
      </div>
    </div>
  );
}
