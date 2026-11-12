"use client";

import React from "react";
import { Camera, Check, Lock, Palette, RotateCw, ShieldCheck, Smartphone, Sun, X } from "lucide-react";

interface StudentArtworkCameraModalProps {
  showArtworkCamera: boolean;
  setShowArtworkCamera: (show: boolean) => void;
  activeProjectForUpload: any;
  cameraMode: "2d" | "3d";
  currentPhotoStep: number;
  setCurrentPhotoStep: (step: number) => void;
  requiredPhotosCount: number;
  orientationFrame: "portrait" | "landscape";
  setOrientationFrame: React.Dispatch<React.SetStateAction<"portrait" | "landscape">>;
  torchOn: boolean;
  toggleTorch: () => void;
  stopCamera: () => void;
  startCamera: (type: "id" | "artwork", mode?: "2d" | "3d") => void;
  isShutterFlashing: boolean;
  setVideoRef: (el: HTMLVideoElement | null) => void;
  cameraFrameState: { isReady: boolean; message: string; frameColor: string };
  capturedPhotos: { url: string; dHash: string }[];
  setCapturedPhotos: (photos: { url: string; dHash: string }[]) => void;
  handleSnapArtworkPhoto: () => void;
  handleSubmitArtwork: () => void;
  uploadingProject: boolean;
}

export default function StudentArtworkCameraModal({
  showArtworkCamera,
  setShowArtworkCamera,
  activeProjectForUpload,
  cameraMode,
  currentPhotoStep,
  setCurrentPhotoStep,
  requiredPhotosCount,
  orientationFrame,
  setOrientationFrame,
  torchOn,
  toggleTorch,
  stopCamera,
  startCamera,
  isShutterFlashing,
  setVideoRef,
  cameraFrameState,
  capturedPhotos,
  setCapturedPhotos,
  handleSnapArtworkPhoto,
  handleSubmitArtwork,
  uploadingProject,
}: StudentArtworkCameraModalProps) {
  return (
    <>
      {/* نافذة الكاميرا المباشرة الذكية - لايف فقط بدون رفع ملفات */}
      {showArtworkCamera && (
        <div style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          maxHeight: "100dvh",
          background: "#000000",
          zIndex: 999999,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          direction: "rtl"
        }}>
          {/* هيدر الكاميرا: اسم المشروع، وضع التصوير، زر تدوير الإطار، الفلاش، والإغلاق */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "10px 14px",
            background: "rgba(11, 13, 20, 0.82)",
            borderBottom: "1px solid var(--border)",
            zIndex: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px"
          }}>
            <div>
              <div style={{ color: "#ffffff", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Camera size={14} strokeWidth={1.5} color="var(--accent-ink)" />
                <span>{activeProjectForUpload?.title || "العمل الفني"}</span>
                <span style={{ fontSize: "10.5px", fontWeight: 500, padding: "2px 6px", borderRadius: "6px", background: cameraMode === "3d" ? "rgba(245, 158, 11, 0.2)" : "rgba(56, 189, 248, 0.2)", color: cameraMode === "3d" ? "var(--warning-ink)" : "var(--accent-ink)", border: "1px solid currentColor" }}>
                  {cameraMode === "3d" ? "مجسم 3D" : "مسطح 2D"}
                </span>
              </div>
              <div className="tabular-nums" style={{ color: "var(--text-secondary)", fontSize: "11px", marginTop: "2px" }}>
                الزاوية ({currentPhotoStep} من {requiredPhotosCount})
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {/* زر التبديل الفوري بين الإطار الرأسي والأفقي */}
              <button
                type="button"
                onClick={() => setOrientationFrame(prev => prev === "portrait" ? "landscape" : "portrait")}
                className="btn-compact"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border-light)",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
                title="تبديل اتجاه الإطار بين طولي وعرضي"
              >
                {orientationFrame === "portrait" ? <Smartphone size={13} strokeWidth={1.5} /> : <RotateCw size={13} strokeWidth={1.5} />}
                <span>{orientationFrame === "portrait" ? "إطار طولي" : "إطار عرضي"}</span>
              </button>

              {/* زر كشاف الفلاش */}
              <button
                type="button"
                onClick={toggleTorch}
                className="btn-compact"
                style={{
                  background: torchOn ? "var(--warning)" : "var(--surface)",
                  color: torchOn ? "#0b0d14" : "var(--text)",
                  border: torchOn ? "1px solid var(--warning)" : "1px solid var(--border-light)",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <Sun size={14} strokeWidth={1.5} />
                <span>{torchOn ? "الفلاش شغال" : "فلاش"}</span>
              </button>

              {/* زر الإلغاء والخروج */}
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setShowArtworkCamera(false);
                }}
                className="btn-compact"
                style={{
                  background: "rgba(239, 68, 68, 0.25)",
                  color: "var(--error-ink)",
                  border: "1px solid rgba(239, 68, 68, 0.45)",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* معاينة الفيديو المباشر للكاميرا بدون أي وميض أو اهتزاز */}
          <div style={{ flex: "1 1 0%", minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#000000" }}>
            {isShutterFlashing && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: "#ffffff",
                zIndex: 999999,
                opacity: 0.9,
                pointerEvents: "none",
                transition: "opacity 0.12s var(--ease-out)"
              }} />
            )}
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "translateZ(0)",
                willChange: "transform"
              }}
            />

            {/* إطار التصوير التوجيهي الذكي المستقر */}
            <div style={{
              position: "absolute",
              width: orientationFrame === "landscape" ? "88%" : "72%",
              height: orientationFrame === "landscape" ? "56%" : "76%",
              border: `2.5px dashed ${cameraFrameState.frameColor}`,
              borderRadius: "12px",
              pointerEvents: "none",
              transition: "width 0.25s var(--ease-out), height 0.25s var(--ease-out), border-color 0.25s var(--ease-out)"
            }}>
              <div style={{ position: "absolute", top: -3, left: -3, width: 22, height: 22, borderTop: `3px solid ${cameraFrameState.frameColor}`, borderLeft: `3px solid ${cameraFrameState.frameColor}` }} />
              <div style={{ position: "absolute", top: -3, right: -3, width: 22, height: 22, borderTop: `3px solid ${cameraFrameState.frameColor}`, borderRight: `3px solid ${cameraFrameState.frameColor}` }} />
              <div style={{ position: "absolute", bottom: -3, left: -3, width: 22, height: 22, borderBottom: `3px solid ${cameraFrameState.frameColor}`, borderLeft: `3px solid ${cameraFrameState.frameColor}` }} />
              <div style={{ position: "absolute", bottom: -3, right: -3, width: 22, height: 22, borderBottom: `3px solid ${cameraFrameState.frameColor}`, borderRight: `3px solid ${cameraFrameState.frameColor}` }} />
            </div>

            {/* شريط الإرشادات الذكي الفوري المعتدل */}
            <div style={{
              position: "absolute",
              bottom: "95px",
              left: "20px",
              right: "20px",
              background: "rgba(15, 19, 28, 0.9)",
              border: `1px solid ${cameraFrameState.frameColor}`,
              color: "#ffffff",
              padding: "8px 14px",
              borderRadius: "8px",
              textAlign: "center",
              fontSize: "12px",
              fontWeight: 500
            }}>
              {cameraFrameState.message}
            </div>
          </div>

          {/* شريط التحكم السفلي */}
          <div style={{
            padding: "16px 20px",
            paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
            background: "var(--bg-deep)",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", minWidth: "60px" }}>
              {capturedPhotos.map((p, idx) => (
                <div key={idx} style={{ width: "38px", height: "38px", borderRadius: "6px", overflow: "hidden", border: "1.5px solid var(--success)", position: "relative" }}>
                  <img src={p.url} alt="زاوية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSnapArtworkPhoto}
              style={{
                width: "66px",
                height: "66px",
                borderRadius: "50%",
                background: "#ffffff",
                border: `4px solid ${cameraFrameState.frameColor}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "border-color 0.2s var(--ease-out)",
                outline: "none"
              }}
              title="انقر لالتقاط العمل الفني مباشرة"
            >
              <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: cameraFrameState.isReady ? "var(--success)" : "var(--text-muted)", transition: "background-color 0.2s var(--ease-out)" }} />
            </button>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: "var(--success-ink)",
              fontSize: "11px",
              fontWeight: 500,
              background: "rgba(16, 185, 129, 0.12)",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(16, 185, 129, 0.3)"
            }}>
              <ShieldCheck size={14} strokeWidth={1.5} color="var(--success)" />
              <span>تصوير مباشر</span>
              <Lock size={12} strokeWidth={1.5} />
            </div>
          </div>
        </div>
      )}

      {/* نافذة مراجعة الصور الملتقطة واعتماد الرفع النهائي */}
      {!showArtworkCamera && capturedPhotos.length >= requiredPhotosCount && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(11, 13, 20, 0.85)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          direction: "rtl"
        }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "20px", maxWidth: "460px", width: "100%" }}>
            <h3 style={{ color: "var(--text)", fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <Palette size={17} strokeWidth={1.5} color="var(--accent-ink)" />
              <span>معاينة الصور قبل الرفع للأستاذ</span>
            </h3>
            <div className="tabular-nums" style={{ color: "var(--text-secondary)", fontSize: "12.5px", marginBottom: "14px" }}>
              مشروع: <strong style={{ fontWeight: 600, color: "var(--text)" }}>{activeProjectForUpload?.title}</strong> ({capturedPhotos.length} صور تم التقاطها)
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {capturedPhotos.map((p, idx) => (
                <div key={idx} style={{ height: "130px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-light)", background: "#000000" }}>
                  <img src={p.url} alt="معاينة" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleSubmitArtwork}
                disabled={uploadingProject}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: uploadingProject ? "var(--secondary)" : "var(--success)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 500,
                  fontSize: "13px",
                  cursor: uploadingProject ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <Check size={15} strokeWidth={1.5} />
                <span>{uploadingProject ? "جاري الرفع..." : "اعتماد ورفع هذا المشروع"}</span>
              </button>

              <button
                onClick={() => {
                  setCapturedPhotos([]);
                  setCurrentPhotoStep(1);
                  startCamera("artwork", cameraMode);
                }}
                className="btn-compact"
                style={{
                  background: "var(--bg-deep)",
                  color: "var(--text-secondary)",
                  padding: "10px 14px",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                إعادة التصوير
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
