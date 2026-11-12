"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Head from "next/head";
import { AlertTriangle, Camera, CheckCircle2, Info, RefreshCw, UploadCloud } from "lucide-react";

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function CameraApp() {
  const searchParams = useSearchParams();
  const stuId = searchParams.get("stu");
  const crsId = searchParams.get("crs");
  const projId = searchParams.get("proj");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hasError, setHasError] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Project settings
  const [projectData, setProjectData] = useState<any>(null);

  useEffect(() => {
    if (crsId && projId) {
      supabase.from('courses').select('custom_week_names').eq('id', crsId).single().then(({data}) => {
        const proj = data?.custom_week_names?.__projects__?.find((p:any) => p.id === projId);
        if (proj) setProjectData(proj);
      });
    }
  }, [crsId, projId]);

  // Camera start state & stream
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  
  // Orientation states
  const [isLeveled, setIsLeveled] = useState(true); // Default true so user is not blocked if gyro unavailable
  const [hasGyro, setHasGyro] = useState(false);
  const [tiltStatus, setTiltStatus] = useState("قم بوزن الهاتف أفقياً فوق المشروع");
  
  // Filter warnings
  const [filterWarnings, setFilterWarnings] = useState<string[]>([]);

  // 1. Device Orientation Listener
  useEffect(() => {
    let gyroTimeout = setTimeout(() => {
      // If no gyro event within 3 seconds, allow capture anyway
      if (!hasGyro) {
        setIsLeveled(true);
      }
    }, 3000);

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta;
      const gamma = event.gamma;

      if (beta === null || gamma === null) return;

      setHasGyro(true);
      clearTimeout(gyroTimeout);

      const threshold = 15; // increased tolerance for easier use
      let isCorrect = false;

      if (projectData?.camera_mode === '3d') {
        // 3D mode (مجسم): phone should be held vertically (beta near 90 or -90)
        isCorrect = Math.abs(Math.abs(beta) - 90) < threshold && Math.abs(gamma) < threshold;
      } else {
        // 2D mode (مسطح): phone should be flat (beta and gamma near 0)
        isCorrect = Math.abs(beta) < threshold && Math.abs(gamma) < threshold;
      }
      
      setIsLeveled(isCorrect);
      
      if (isCorrect) {
        setTiltStatus("الوضع ممتاز — يمكنك التصوير الآن");
      } else {
        setTiltStatus(projectData?.camera_mode === '3d' ? "يرجى مسك الهاتف بشكل عمودي ثابت أمام المجسم" : "يرجى وضع الهاتف بشكل أفقي وموزون تماماً فوق المشروع");
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      clearTimeout(gyroTimeout);
    };
  }, [hasGyro, projectData]);

  // 2. Attach stream to video element whenever stream and videoRef are available
  useEffect(() => {
    if (isCameraStarted && stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => {
        console.warn("Auto-play error:", err);
      });
    }
  }, [isCameraStarted, stream, photos]);

  // 3. Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setIsLoadingCamera(true);
    setHasError("");

    // Request device orientation permission for iOS 13+
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState !== 'granted') {
          console.warn("Device orientation permission denied");
        }
      } catch (err) {
        console.error("Device orientation permission error", err);
      }
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setHasError("عفواً، المتصفح لا يدعم الوصول المباشر للكاميرا.");
      setIsLoadingCamera(false);
      return;
    }
    
    try {
      // Try back camera first, fallback to any camera
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      setStream(mediaStream);
      setIsCameraStarted(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setHasError("تم رفض إذن الكاميرا. يرجى السماح للكاميرا من إعدادات المتصفح/تليجرام والمحاولة مرة أخرى.");
      } else {
        setHasError("تعذر تشغيل الكاميرا (" + (err.message || err.name) + "). يرجى التأكد من عدم استخدامها في تطبيق آخر.");
      }
    } finally {
      setIsLoadingCamera(false);
    }
  };

  // Store perceptual hash
  const [imageHash, setImageHash] = useState<string>("");

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, width, height);
    
    // 1. Calculate 64-bit Difference Hash (dHash) for fast similarity detection
    try {
      const hashCanvas = document.createElement("canvas");
      hashCanvas.width = 9;
      hashCanvas.height = 8;
      const hCtx = hashCanvas.getContext("2d");
      if (hCtx) {
        hCtx.drawImage(canvas, 0, 0, 9, 8);
        const hData = hCtx.getImageData(0, 0, 9, 8).data;
        let hashStr = "";
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const i1 = (y * 9 + x) * 4;
            const i2 = (y * 9 + (x + 1)) * 4;
            const g1 = hData[i1] * 0.299 + hData[i1 + 1] * 0.587 + hData[i1 + 2] * 0.114;
            const g2 = hData[i2] * 0.299 + hData[i2 + 1] * 0.587 + hData[i2 + 2] * 0.114;
            hashStr += g1 < g2 ? "1" : "0";
          }
        }
        setImageHash(hashStr);
      }
    } catch (e) {
      console.warn("dHash error:", e);
    }

    // 2. Quick heuristic image analysis
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      let totalBrightness = 0;
      let rSum = 0, gSum = 0, bSum = 0;
      const step = 16; // sample every 16th pixel for performance
      let sampleCount = 0;
      
      for (let i = 0; i < data.length; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        totalBrightness += (r * 299 + g * 587 + b * 114) / 1000;
        rSum += r;
        gSum += g;
        bSum += b;
        sampleCount++;
      }
      
      const avgBrightness = totalBrightness / sampleCount;
      const avgR = rSum / sampleCount;
      const avgG = gSum / sampleCount;
      const avgB = bSum / sampleCount;
      
      let variance = 0;
      for (let i = 0; i < data.length; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        variance += Math.pow(r - avgR, 2) + Math.pow(g - avgG, 2) + Math.pow(b - avgB, 2);
      }
      variance = variance / (sampleCount * 3);
      
      const warnings = [];
      if (avgBrightness < 35) warnings.push("الإضاءة ضعيفة جداً.");
      if (avgBrightness > 245) warnings.push("الإضاءة ساطعة جداً (تجنب تصوير ورقة بيضاء فقط).");
      if (variance < 80) warnings.push("يبدو أن المشروع فارغ أو ذو لون مسطح.");
      
      setFilterWarnings(warnings);
    } catch (e) {
      console.warn("Analysis error:", e);
    }
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhotos(prev => [...prev, dataUrl]);
  };

  const retakePhoto = () => {
    setPhotos([]);
    setImageHash("");
    setFilterWarnings([]);
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => console.warn("Retake play error:", err));
    }
  };

  const uploadPhoto = async () => {
    if (photos.length === 0 || !stuId || !crsId || !projId) return;
    
    setIsUploading(true);
    
    try {
      let finalPhoto = photos[0];
      
      if (photos.length > 1) {
        // Create collage
        const imgElements = await Promise.all(photos.map(p => {
          return new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = p;
          });
        }));
        
        const canvas = document.createElement('canvas');
        const width = imgElements[0].width;
        const height = imgElements[0].height;
        
        canvas.width = width;
        canvas.height = height * photos.length;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          imgElements.forEach((img, i) => {
            ctx.drawImage(img, 0, i * height, width, height);
          });
          finalPhoto = canvas.toDataURL('image/jpeg', 0.8);
        }
      }

      const tgInitData = typeof window !== "undefined" ? ((window as any).Telegram?.WebApp?.initData || "") : "";
      const response = await fetch("/api/student/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: finalPhoto, stuId, crsId, projId, imageHash, initData: tgInitData }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "فشل الرفع");
      }
      
      setUploadSuccess(true);
    } catch (err: any) {
      console.error("Upload failed", err);
      alert(err.message || "حدث خطأ أثناء الرفع. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsUploading(false);
    }
  };

  if (uploadSuccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--background)', color: 'var(--text)', fontFamily: 'inherit', padding: '24px', textAlign: 'center', direction: 'rtl' }}>
        <div style={{ marginBottom: '12px', color: 'var(--success)' }}>
          <CheckCircle2 size={48} strokeWidth={1.5} />
        </div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>تم رفع المشروع بنجاح</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13.5px' }}>يمكنك الآن إغلاق هذه النافذة والعودة للتليجرام.</p>
        <button 
          onClick={() => {
             if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
               (window as any).Telegram.WebApp.close();
             } else {
               window.close();
             }
          }}
          style={{ marginTop: '24px', padding: '12px 32px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 500, cursor: 'pointer' }}
        >
          إغلاق النافذة
        </button>
      </div>
    );
  }

  if (!stuId || !crsId || !projId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--background)', color: 'var(--text)', padding: '24px', textAlign: 'center', direction: 'rtl' }}>
        <p style={{ color: 'var(--error-ink)', fontSize: '15px', fontWeight: 500 }}>رابط غير صالح. يرجى الدخول من تليجرام مرة أخرى.</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </Head>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000000', overflow: 'hidden', fontFamily: 'inherit' }}>
        
        {/* Intro Screen when camera is not started yet */}
        {!isCameraStarted ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)', color: 'var(--text)', padding: '24px', textAlign: 'center', direction: 'rtl' }}>
            <div style={{ margin: '0 0 16px 0', color: 'var(--accent-ink)' }}>
              <Camera size={48} strokeWidth={1.5} />
            </div>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '19px', fontWeight: 600 }}>مستعد لتصوير المشروع؟</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.6, maxWidth: '360px', fontSize: '13.5px' }}>
              ضع المشروع على سطح مستوٍ (طاولة أو أرضية)، وسنساعدك في التقاطه بشكل موزون لتجنب تشوه المنظور.
            </p>
            
            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '24px', textAlign: 'right', direction: 'rtl', fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '360px', lineHeight: 1.55, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Info size={16} strokeWidth={1.5} color="var(--accent-ink)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span><strong style={{ fontWeight: 600, color: 'var(--accent-ink)' }}>ملاحظة أمنية:</strong> عند الضغط بالأسفل، سيطلب منك تليجرام السماح بالوصول للكاميرا. هذه الصلاحية تستخدم حصراً في هذه اللحظة لالتقاط صورة مشروعك فقط ولا يتم مشاركتها.</span>
            </div>

            {hasError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', padding: '12px', marginBottom: '20px', color: 'var(--error-ink)', fontSize: '13px', maxWidth: '360px' }}>
                {hasError}
              </div>
            )}

            <button 
              onClick={startCamera}
              disabled={isLoadingCamera}
              style={{ padding: '14px 36px', backgroundColor: 'var(--success)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 500, cursor: isLoadingCamera ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Camera size={18} strokeWidth={1.5} />
              <span>{isLoadingCamera ? 'جاري تشغيل الكاميرا...' : 'تشغيل الكاميرا'}</span>
            </button>
          </div>
        ) : (
          /* Live Camera / Captured Photo View */
          <>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  display: photos.length >= (projectData?.required_photos || 1) ? 'none' : 'block' 
                }} 
              />
              {photos.length >= (projectData?.required_photos || 1) && (
                <img 
                  src={photos[photos.length - 1]} 
                  alt="Captured" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                />
              )}
              
              {/* Leveling Indicator Overlay (only in live mode) */}
              {photos.length < (projectData?.required_photos || 1) && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ 
                    width: '88px', 
                    height: '88px', 
                    border: `2.5px solid ${isLeveled ? 'var(--success)' : 'var(--warning)'}`, 
                    borderRadius: '50%',
                    position: 'relative',
                    transition: 'border-color 0.25s var(--ease-out)'
                  }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '14px', height: '14px', backgroundColor: isLeveled ? 'var(--success)' : 'var(--warning)', borderRadius: '50%', transition: 'background-color 0.25s var(--ease-out)' }} />
                    
                    {/* Crosshairs */}
                    <div style={{ position: 'absolute', top: '-8px', left: '50%', width: '2px', height: '8px', backgroundColor: isLeveled ? 'var(--success)' : 'var(--warning)', transform: 'translateX(-50%)' }} />
                    <div style={{ position: 'absolute', bottom: '-8px', left: '50%', width: '2px', height: '8px', backgroundColor: isLeveled ? 'var(--success)' : 'var(--warning)', transform: 'translateX(-50%)' }} />
                    <div style={{ position: 'absolute', left: '-8px', top: '50%', width: '8px', height: '2px', backgroundColor: isLeveled ? 'var(--success)' : 'var(--warning)', transform: 'translateY(-50%)' }} />
                    <div style={{ position: 'absolute', right: '-8px', top: '50%', width: '8px', height: '2px', backgroundColor: isLeveled ? 'var(--success)' : 'var(--warning)', transform: 'translateY(-50%)' }} />
                  </div>

                  <div style={{ marginTop: '16px', backgroundColor: 'rgba(11, 13, 20, 0.85)', border: '1px solid var(--border-light)', padding: '8px 16px', borderRadius: '8px', color: isLeveled ? 'var(--success-ink)' : 'var(--text)', fontWeight: 500, fontSize: '13px', direction: 'rtl' }}>
                    {tiltStatus}
                  </div>
                </div>
              )}
              
              {/* AI Warnings Overlay */}
              {filterWarnings.length > 0 && photos.length > 0 && (
                <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', backgroundColor: 'rgba(220, 38, 38, 0.92)', color: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--error)', zIndex: 10, textAlign: 'right', direction: 'rtl' }}>
                  {filterWarnings.map((w, i) => (
                    <div key={i} style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                      <span>{w}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>يمكنك إعادة الالتقاط للحصول على صورة أفضل وأوضح.</div>
                </div>
              )}
              
              {/* Hidden Canvas */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            {/* Bottom Controls */}
            <div style={{ padding: "10px 12px", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", gap: "8px", overflowX: "auto" }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: "relative", width: "56px", height: "56px", flexShrink: 0, border: "1.5px solid var(--success)", borderRadius: "8px", overflow: "hidden" }}>
                  <img src={p} alt={`Photo ${i+1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
              {projectData?.required_photos > 1 && photos.length < projectData.required_photos && (
                <div className="tabular-nums" style={{ width: "56px", height: "56px", flexShrink: 0, border: "1.5px dashed var(--border-light)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
                  {photos.length} / {projectData.required_photos}
                </div>
              )}
            </div>

            <div style={{ height: '104px', backgroundColor: 'var(--bg-deep)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 20px', direction: 'rtl' }}>
              {photos.length < (projectData?.required_photos || 1) ? (
                <button 
                  onClick={capturePhoto}
                  disabled={!isLeveled}
                  style={{ 
                    width: '68px', 
                    height: '68px', 
                    borderRadius: '50%', 
                    backgroundColor: isLeveled ? 'var(--success)' : 'var(--secondary)', 
                    border: `4px solid ${isLeveled ? '#ffffff' : 'var(--border-light)'}`, 
                    cursor: isLeveled ? 'pointer' : 'not-allowed', 
                    outline: 'none',
                    opacity: isLeveled ? 1 : 0.45,
                    transition: 'background-color 0.2s var(--ease-out), border-color 0.2s var(--ease-out)'
                  }}
                  aria-label="Capture"
                />
              ) : (
                <>
                  <button 
                    onClick={retakePhoto}
                    disabled={isUploading}
                    style={{ padding: '12px 20px', backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: isUploading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <RefreshCw size={15} strokeWidth={1.5} />
                    <span>إعادة الالتقاط</span>
                  </button>
                  
                  <button 
                    onClick={uploadPhoto}
                    disabled={isUploading}
                    style={{ padding: '12px 24px', backgroundColor: 'var(--success)', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: isUploading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <UploadCloud size={16} strokeWidth={1.5} />
                    <span>{isUploading ? 'جاري الرفع...' : 'اعتماد ورفع'}</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}></div>}>
      <CameraApp />
    </Suspense>
  );
}
