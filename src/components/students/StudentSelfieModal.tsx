"use client";

import React from "react";
import { Camera, Check, CheckCircle2, RefreshCw, RotateCw, Save, User, X } from "lucide-react";

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
      background: "#000000",
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
        background: "var(--surface)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Camera size={16} strokeWidth={1.5} color="var(--accent-ink)" />
          <span style={{ color: "var(--text)", fontSize: "13px", fontWeight: 600 }}>التقاط صورة شخصية للحساب</span>
        </div>
        <button
          type="button"
          onClick={() => { stopSelfieCamera(); onClose(); setSelfiePhoto(null); setSelfieMsg(""); }}
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "var(--surface-hover)",
            color: "var(--text)",
            border: "1px solid var(--border-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0
          }}
          title="إغلاق"
        >
          <X size={15} strokeWidth={1.5} />
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
        background: "var(--bg-deep)"
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
              border: faceDetected ? "3px solid var(--success)" : "2px dashed var(--accent-ink)",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "border-color 0.25s var(--ease-out)"
            }}>
              <span style={{
                color: faceDetected ? "var(--success-ink)" : "var(--accent-ink)",
                fontSize: "11px",
                fontWeight: 500,
                background: "rgba(11, 13, 20, 0.8)",
                border: faceDetected ? "1px solid var(--success)" : "1px solid rgba(56, 189, 248, 0.35)",
                padding: "4px 10px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}>
                {faceDetected ? (
                  <>
                    <Check size={13} strokeWidth={1.5} />
                    <span>تم التعرف على الوجه بنجاح</span>
                  </>
                ) : (
                  <>
                    <User size={13} strokeWidth={1.5} />
                    <span>اضبط وجهك داخل الدائرة</span>
                  </>
                )}
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
              border: "2.5px solid var(--success)",
              marginBottom: "12px"
            }}>
              <img src={selfiePhoto} alt="معاينة الصورة الشخصية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ color: "var(--success-ink)", fontSize: "12.5px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={15} strokeWidth={1.5} />
              <span>تم التقاط صورتك بنجاح وجاهزة للحفظ</span>
            </div>
          </div>
        )}
      </div>

      {/* رسالة الحالة إن وجدت */}
      {selfieMsg && (
        <div style={{
          padding: "8px 12px",
          background: "rgba(16, 185, 129, 0.14)",
          color: "var(--success-ink)",
          fontSize: "12px",
          textAlign: "center",
          fontWeight: 500,
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
        background: "var(--bg-deep)",
        borderTop: "1px solid var(--border)",
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
                border: faceDetected ? "4px solid var(--success)" : "4px solid var(--accent-ink)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                outline: "none",
                transition: "border-color 0.2s var(--ease-out)"
              }}
              title="التقاط الصورة الشخصية"
            >
              <div style={{
                width: "46px",
                height: "46px",
                borderRadius: "50%",
                background: faceDetected ? "var(--success)" : "var(--primary)",
                transition: "background-color 0.2s var(--ease-out)"
              }} />
            </button>
            <span style={{ color: faceDetected ? "var(--success-ink)" : "var(--accent-ink)", fontSize: "11.5px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Camera size={13} strokeWidth={1.5} />
              <span>{faceDetected ? "الوجه جاهز، اضغط للالتقاط" : "التقاط الصورة الشخصية"}</span>
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
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border-light)",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              <span>إعادة التقاط</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSelfie}
              disabled={isSavingSelfie}
              style={{
                flex: 1.4,
                padding: "10px",
                background: "var(--success)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 500,
                cursor: isSavingSelfie ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              {isSavingSelfie ? (
                <>
                  <RotateCw size={14} strokeWidth={1.5} className="animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save size={14} strokeWidth={1.5} />
                  <span>حفظ الصورة</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
