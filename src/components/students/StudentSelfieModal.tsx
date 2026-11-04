"use client";

import React from "react";
import { CheckCircle2, RotateCw, X } from "lucide-react";

interface StudentSelfieModalProps {
  selfieVideoRef: React.RefObject<HTMLVideoElement | null>;
  selfiePhoto: string | null;
  setSelfiePhoto: (v: string | null) => void;
  selfieMsg: string;
  setSelfieMsg: (v: string) => void;
  faceDetected: boolean;
  isSavingSelfie: boolean;
  startSelfieCamera: () => void;
  stopSelfieCamera: () => void;
  captureSelfieFrame: () => string | null;
  handleSaveSelfie: () => void;
  onClose: () => void;
}

export default function StudentSelfieModal({
  selfieVideoRef,
  selfiePhoto,
  setSelfiePhoto,
  selfieMsg,
  setSelfieMsg,
  faceDetected,
  isSavingSelfie,
  startSelfieCamera,
  stopSelfieCamera,
  captureSelfieFrame,
  handleSaveSelfie,
  onClose,
}: StudentSelfieModalProps) {
  return (
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
      {/* شريط العنوان وزر الإلغاء */}
      <div style={{
        flexShrink: 0,
        padding: "10px 14px",
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>🤳</span>
          <span style={{ color: "#fff", fontSize: "13px", fontWeight: "bold" }}>التقاط صورة شخصية للحساب</span>
        </div>
        <button
          type="button"
          onClick={() => { stopSelfieCamera(); onClose(); setSelfiePhoto(null); setSelfieMsg(""); }}
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.12)",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0
          }}
          title="إغلاق"
        >
          <X size={15} />
        </button>
      </div>

      {/* منطقة الكاميرا الحية أو المعاينة */}
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
        {!selfiePhoto ? (
          <>
            <video
              ref={selfieVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)"
              }}
            />
            {/* إطار دائري لتوجيه الوجه مع التعرف الذكي على الوجه */}
            <div style={{
              position: "absolute",
              width: "230px",
              height: "230px",
              borderRadius: "50%",
              border: faceDetected ? "3.5px solid #10b981" : "2.5px dashed rgba(56, 189, 248, 0.75)",
              boxShadow: faceDetected 
                ? "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.75)"
                : "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.3)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.25s ease"
            }}>
              <span style={{
                color: faceDetected ? "#34d399" : "#38bdf8",
                fontSize: "11px",
                fontWeight: "bold",
                background: "rgba(0, 0, 0, 0.75)",
                border: faceDetected ? "1px solid #10b981" : "1px solid rgba(56, 189, 248, 0.3)",
                padding: "4px 10px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}>
                {faceDetected ? "🟢 تم التعرف على الوجه بنجاح ✅" : "👤 اضبط وجهك داخل الدائرة"}
              </span>
            </div>
          </>
        ) : (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}>
            <div style={{
              width: "200px",
              height: "200px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "3px solid #10b981",
              boxShadow: "0 0 25px rgba(16, 185, 129, 0.5)",
              marginBottom: "12px"
            }}>
              <img src={selfiePhoto} alt="معاينة الصورة الشخصية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ color: "#34d399", fontSize: "12px", fontWeight: "bold" }}>
              تم التقاط صورتك بنجاح! جاهزة للحفظ ✅
            </div>
          </div>
        )}
      </div>

      {/* رسالة الحالة إن وجدت */}
      {selfieMsg && (
        <div style={{
          padding: "8px 12px",
          background: "rgba(16, 185, 129, 0.15)",
          color: "#34d399",
          fontSize: "11px",
          textAlign: "center",
          fontWeight: "bold",
          borderTop: "1px solid rgba(16, 185, 129, 0.3)"
        }}>
          {selfieMsg}
        </div>
      )}

      {/* شريط التحكم السفلي */}
      <div style={{
        flexShrink: 0,
        padding: "12px 16px",
        paddingBottom: "max(18px, env(safe-area-inset-bottom, 18px))",
        background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95), #070a12)",
        borderTop: "1px solid rgba(16, 185, 129, 0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        zIndex: 10
      }}>
        {!selfiePhoto ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={() => {
                const photo = captureSelfieFrame();
                if (photo) setSelfiePhoto(photo);
              }}
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#ffffff",
                border: faceDetected ? "4px solid #10b981" : "4px solid #38bdf8",
                boxShadow: faceDetected ? "0 0 25px rgba(16, 185, 129, 0.9)" : "0 0 15px rgba(56, 189, 248, 0.5)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                outline: "none",
                transition: "all 0.2s ease"
              }}
              title="التقاط الصورة الشخصية"
            >
              <div style={{
                width: "46px",
                height: "46px",
                borderRadius: "50%",
                background: faceDetected ? "#059669" : "#0284c7",
                transition: "all 0.2s ease"
              }} />
            </button>
            <span style={{ color: faceDetected ? "#34d399" : "#38bdf8", fontSize: "11px", fontWeight: "bold" }}>
              {faceDetected ? "الوجه جاهز! اضغط للالتقاط 📸" : "التقاط الصورة الشخصية 📸"}
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "8px", width: "100%", maxWidth: "340px" }}>
            <button
              type="button"
              onClick={() => {
                setSelfiePhoto(null);
                setSelfieMsg("");
                startSelfieCamera();
              }}
              disabled={isSavingSelfie}
              style={{
                flex: 1,
                padding: "10px",
                background: "rgba(255, 255, 255, 0.1)",
                color: "#fff",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              إعادة التقاط 🔄
            </button>

            <button
              type="button"
              onClick={handleSaveSelfie}
              disabled={isSavingSelfie}
              style={{
                flex: 1.4,
                padding: "10px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: isSavingSelfie ? "wait" : "pointer",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              {isSavingSelfie ? (
                <>
                  <RotateCw size={14} className="animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>حفظ الصورة 💾</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
