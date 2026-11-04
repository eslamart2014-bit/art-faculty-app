"use client";

import React from "react";
import { RotateCw, ShieldCheck, Sun, X } from "lucide-react";

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
          top: 0,
          left: 0,
          inset: 0,
          width: "100vw",
          height: "100dvh",
          maxHeight: "100dvh",
          background: "#000",
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
            background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)",
            zIndex: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px"
          }}>
            <div>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📷 {activeProjectForUpload?.title || "العمل الفني"}</span>
                <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: cameraMode === "3d" ? "rgba(168, 85, 247, 0.3)" : "rgba(56, 189, 248, 0.3)", color: cameraMode === "3d" ? "#c084fc" : "#38bdf8", border: "1px solid currentColor" }}>
                  {cameraMode === "3d" ? "مجسم 3D" : "مسطح 2D"}
                </span>
              </div>
              <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
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
                  background: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.3)",
                  padding: "6px 10px",
                  fontSize: "11px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
                title="تبديل اتجاه الإطار بين طولي وعرضي"
              >
                <RotateCw size={13} />
                <span>{orientationFrame === "portrait" ? "إطار طولي 📱" : "إطار عرضي 🔄"}</span>
              </button>

              {/* زر كشاف الفلاش */}
              <button
                type="button"
                onClick={toggleTorch}
                className="btn-compact"
                style={{
                  background: torchOn ? "#fbbf24" : "rgba(255,255,255,0.18)",
                  color: torchOn ? "#000" : "#fff",
                  border: "none",
                  padding: "6px 10px",
                  fontSize: "11px",
                  cursor: "pointer"
                }}
              >
                <Sun size={14} />
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
                  background: "rgba(239, 68, 68, 0.4)",
                  color: "#fff",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  padding: "6px 10px",
                  cursor: "pointer"
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* معاينة الفيديو المباشر للكاميرا بدون أي وميض أو اهتزاز */}
          <div style={{ flex: "1 1 0%", minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#000" }}>
            {isShutterFlashing && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "#ffffff",
                zIndex: 999999,
                opacity: 0.92,
                pointerEvents: "none",
                transition: "opacity 0.12s ease-out"
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
              border: `3px dashed ${cameraFrameState.frameColor}`,
              borderRadius: "16px",
              pointerEvents: "none",
              boxShadow: `0 0 25px ${cameraFrameState.frameColor}44`,
              transition: "width 0.25s ease, height 0.25s ease, border-color 0.25s ease"
            }}>
              <div style={{ position: "absolute", top: -3, left: -3, width: 22, height: 22, borderTop: `4px solid ${cameraFrameState.frameColor}`, borderLeft: `4px solid ${cameraFrameState.frameColor}` }} />
              <div style={{ position: "absolute", top: -3, right: -3, width: 22, height: 22, borderTop: `4px solid ${cameraFrameState.frameColor}`, borderRight: `4px solid ${cameraFrameState.frameColor}` }} />
              <div style={{ position: "absolute", bottom: -3, left: -3, width: 22, height: 22, borderBottom: `4px solid ${cameraFrameState.frameColor}`, borderLeft: `4px solid ${cameraFrameState.frameColor}` }} />
              <div style={{ position: "absolute", bottom: -3, right: -3, width: 22, height: 22, borderBottom: `4px solid ${cameraFrameState.frameColor}`, borderRight: `4px solid ${cameraFrameState.frameColor}` }} />
            </div>

            {/* شريط الإرشادات الذكي الفوري المعتدل */}
            <div style={{
              position: "absolute",
              bottom: "95px",
              left: "20px",
              right: "20px",
              background: "rgba(15, 23, 42, 0.88)",
              border: `1px solid ${cameraFrameState.frameColor}`,
              color: "#fff",
              padding: "8px 14px",
              borderRadius: "10px",
              textAlign: "center",
              fontSize: "12px",
              fontWeight: "bold",
              backdropFilter: "blur(8px)",
              boxShadow: "0 4px 15px rgba(0,0,0,0.5)"
            }}>
              {cameraFrameState.message}
            </div>
          </div>

          {/* شريط التحكم السفلي */}
          <div style={{
            padding: "16px 20px",
            paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
            background: "rgba(0,0,0,0.95)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", minWidth: "60px" }}>
              {capturedPhotos.map((p, idx) => (
                <div key={idx} style={{ width: "38px", height: "38px", borderRadius: "6px", overflow: "hidden", border: "2px solid #10b981", position: "relative" }}>
                  <img src={p.url} alt="زاوية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSnapArtworkPhoto}
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                background: cameraFrameState.isReady ? "#fff" : "rgba(255,255,255,0.85)",
                border: `4px solid ${cameraFrameState.frameColor}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: cameraFrameState.isReady ? "0 0 25px rgba(16, 185, 129, 0.8)" : "0 0 10px rgba(0,0,0,0.5)",
                transition: "all 0.15s ease",
                transform: "scale(1)",
                outline: "none"
              }}
              title="انقر لالتقاط العمل الفني مباشرة"
            >
              <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: cameraFrameState.isReady ? "#10b981" : "#475569", transition: "background 0.2s" }} />
            </button>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: "#34d399",
              fontSize: "11px",
              fontWeight: "bold",
              background: "rgba(16, 185, 129, 0.12)",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(16, 185, 129, 0.3)"
            }}>
              <ShieldCheck size={14} color="#10b981" />
              <span>تصوير مباشر 🔒</span>
            </div>
          </div>
        </div>
      )}

      {/* نافذة مراجعة الصور الملتقطة واعتماد الرفع النهائي */}
      {!showArtworkCamera && capturedPhotos.length >= requiredPhotosCount && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.85)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          direction: "rtl"
        }}>
          <div style={{ background: "#141b29", border: "1px solid #2a374f", borderRadius: "16px", padding: "20px", maxWidth: "460px", width: "100%" }}>
            <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: "bold", margin: "0 0 8px 0" }}>
              معاينة الصور قبل الرفع للأستاذ 🎨
            </h3>
            <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "14px" }}>
              مشروع: <b>{activeProjectForUpload?.title}</b> ({capturedPhotos.length} صور تم التقاطها)
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              {capturedPhotos.map((p, idx) => (
                <div key={idx} style={{ height: "130px", borderRadius: "10px", overflow: "hidden", border: "1px solid #334155", background: "#000" }}>
                  <img src={p.url} alt="معاينة" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleSubmitArtwork}
                disabled={uploadingProject}
                style={{
                  flex: 1,
                  padding: "10px", background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "bold",
                  fontSize: "13px",
                  cursor: uploadingProject ? "not-allowed" : "pointer"
                }}
              >
                {uploadingProject ? "جاري الرفع..." : "✓ اعتماد ورفع هذا المشروع"}
              </button>

              <button
                onClick={() => {
                  setCapturedPhotos([]);
                  setCurrentPhotoStep(1);
                  startCamera("artwork", cameraMode);
                }}
                className="btn-compact"
                style={{
                  background: "#334155",
                  color: "#fff",
                  padding: "12px",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "12px",
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
