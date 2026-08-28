"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Head from "next/head";

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
  const [photo, setPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Camera start state & stream
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  
  // Orientation states
  const [isLeveled, setIsLeveled] = useState(true); // Default true so user is not blocked if gyro unavailable
  const [hasGyro, setHasGyro] = useState(false);
  const [tiltStatus, setTiltStatus] = useState("قم بوزن الهاتف أفقياً فوق المشروع 📱");
  
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

      // When the phone is flat above a table, beta and gamma are both near 0.
      // Margin of error: 9 degrees for smooth user experience
      const threshold = 9;
      const isFlat = Math.abs(beta) < threshold && Math.abs(gamma) < threshold;
      
      setIsLeveled(isFlat);
      
      if (isFlat) {
        setTiltStatus("الوضع ممتاز! يمكنك التصوير الآن ✅");
      } else {
        setTiltStatus("يرجى وضع الهاتف بشكل أفقي وموزون تماماً فوق المشروع 📱");
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      clearTimeout(gyroTimeout);
    };
  }, [hasGyro]);

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
  }, [isCameraStarted, stream, photo]);

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
    
    // Quick heuristic image analysis
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
      if (avgBrightness < 35) warnings.push("⚠️ الإضاءة ضعيفة جداً.");
      if (avgBrightness > 245) warnings.push("⚠️ الإضاءة ساطعة جداً (تجنب تصوير ورقة بيضاء فقط).");
      if (variance < 80) warnings.push("⚠️ يبدو أن المشروع فارغ أو ذو لون مسطح.");
      
      setFilterWarnings(warnings);
    } catch (e) {
      console.warn("Analysis error:", e);
    }
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhoto(dataUrl);
  };

  const retakePhoto = () => {
    setPhoto(null);
    setFilterWarnings([]);
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => console.warn("Retake play error:", err));
    }
  };

  const uploadPhoto = async () => {
    if (!photo || !stuId || !crsId || !projId) return;
    
    setIsUploading(true);
    
    try {
      const response = await fetch("/api/student/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo, stuId, crsId, projId }),
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'system-ui', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ color: '#4caf50', fontSize: '3.5rem', marginBottom: '10px' }}>✅</h1>
        <h2>تم رفع المشروع بنجاح!</h2>
        <p style={{ color: '#aaa', marginTop: '10px' }}>يمكنك الآن إغلاق هذه النافذة والعودة للتليجرام.</p>
        <button 
          onClick={() => {
             if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
               (window as any).Telegram.WebApp.close();
             } else {
               window.close();
             }
          }}
          style={{ marginTop: '30px', padding: '15px 40px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' }}
        >
          إغلاق النافذة
        </button>
      </div>
    );
  }

  if (!stuId || !crsId || !projId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: 'white', padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#ff5252', fontSize: '1.2rem' }}>رابط غير صالح. يرجى الدخول من تليجرام مرة أخرى.</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </Head>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000', overflow: 'hidden', fontFamily: 'system-ui' }}>
        
        {/* Intro Screen when camera is not started yet */}
        {!isCameraStarted ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212', color: 'white', padding: '24px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.5rem', margin: '0 0 16px 0' }}>📷</h1>
            <h2 style={{ margin: '0 0 12px 0' }}>مستعد لتصوير المشروع؟</h2>
            <p style={{ color: '#bbb', marginBottom: '20px', lineHeight: '1.6', maxWidth: '360px' }}>
              ضع المشروع على سطح مستوٍ (طاولة أو أرضية)، وسنساعدك في التقاطه بشكل موزون لتجنب تشوه المنظور.
            </p>
            
            <div style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', border: '1px solid #2196F3', borderRadius: '10px', padding: '14px', marginBottom: '28px', textAlign: 'right', direction: 'rtl', fontSize: '0.85rem', color: '#90caf9', maxWidth: '360px', lineHeight: '1.5' }}>
              ℹ️ <strong>ملاحظة أمنية:</strong> عند الضغط بالأسفل، سيطلب منك تليجرام السماح بالوصول للكاميرا. هذه الصلاحية تستخدم حصراً في هذه اللحظة لالتقاط صورة مشروعك فقط ولا يتم مشاركتها.
            </div>

            {hasError && (
              <div style={{ backgroundColor: 'rgba(244, 67, 54, 0.15)', border: '1px solid #f44336', borderRadius: '8px', padding: '12px', marginBottom: '20px', color: '#ff8a80', fontSize: '0.9rem', maxWidth: '360px' }}>
                {hasError}
              </div>
            )}

            <button 
              onClick={startCamera}
              disabled={isLoadingCamera}
              style={{ padding: '16px 48px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '14px', fontSize: '1.25rem', fontWeight: 'bold', cursor: isLoadingCamera ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(76, 175, 80, 0.4)' }}
            >
              {isLoadingCamera ? 'جاري تشغيل الكاميرا...' : 'تشغيل الكاميرا 📸'}
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
                  display: photo ? 'none' : 'block' 
                }} 
              />
              {photo && (
                <img 
                  src={photo} 
                  alt="Captured" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                />
              )}
              
              {/* Leveling Indicator Overlay (only in live mode) */}
              {!photo && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ 
                    width: '90px', 
                    height: '90px', 
                    border: `3px solid ${isLeveled ? '#4caf50' : '#ff9800'}`, 
                    borderRadius: '50%',
                    position: 'relative',
                    boxShadow: isLeveled ? '0 0 20px rgba(76, 175, 80, 0.6)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '16px', height: '16px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', borderRadius: '50%', transition: 'background-color 0.3s ease' }} />
                    
                    {/* Crosshairs */}
                    <div style={{ position: 'absolute', top: '-8px', left: '50%', width: '2px', height: '8px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', transform: 'translateX(-50%)' }} />
                    <div style={{ position: 'absolute', bottom: '-8px', left: '50%', width: '2px', height: '8px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', transform: 'translateX(-50%)' }} />
                    <div style={{ position: 'absolute', left: '-8px', top: '50%', width: '8px', height: '2px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', transform: 'translateY(-50%)' }} />
                    <div style={{ position: 'absolute', right: '-8px', top: '50%', width: '8px', height: '2px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', transform: 'translateY(-50%)' }} />
                  </div>

                  <div style={{ marginTop: '16px', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '8px 18px', borderRadius: '20px', color: isLeveled ? '#4caf50' : '#fff', fontWeight: 'bold', fontSize: '0.9rem', direction: 'rtl' }}>
                    {tiltStatus}
                  </div>
                </div>
              )}
              
              {/* AI Warnings Overlay */}
              {filterWarnings.length > 0 && photo && (
                <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', backgroundColor: 'rgba(255, 82, 82, 0.92)', color: 'white', padding: '12px', borderRadius: '10px', zIndex: 10, textAlign: 'right', direction: 'rtl', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  {filterWarnings.map((w, i) => <div key={i} style={{ fontWeight: 'bold' }}>{w}</div>)}
                  <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.9 }}>يمكنك إعادة الالتقاط للحصول على صورة أفضل وأوضح.</div>
                </div>
              )}
              
              {/* Hidden Canvas */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            {/* Bottom Controls */}
            <div style={{ height: '110px', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 20px' }}>
              {!photo ? (
                <button 
                  onClick={capturePhoto}
                  disabled={!isLeveled}
                  style={{ 
                    width: '74px', 
                    height: '74px', 
                    borderRadius: '50%', 
                    backgroundColor: isLeveled ? '#4caf50' : '#444', 
                    border: `5px solid ${isLeveled ? '#fff' : '#222'}`, 
                    cursor: isLeveled ? 'pointer' : 'not-allowed', 
                    outline: 'none',
                    opacity: isLeveled ? 1 : 0.4,
                    boxShadow: isLeveled ? '0 0 16px rgba(76, 175, 80, 0.6)' : 'none',
                    transition: 'all 0.25s ease'
                  }}
                  aria-label="Capture"
                />
              ) : (
                <>
                  <button 
                    onClick={retakePhoto}
                    disabled={isUploading}
                    style={{ padding: '14px 24px', backgroundColor: '#2c2c2c', color: 'white', border: '1px solid #444', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer' }}
                  >
                    إعادة الالتقاط 🔄
                  </button>
                  
                  <button 
                    onClick={uploadPhoto}
                    disabled={isUploading}
                    style={{ padding: '14px 32px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.15rem', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)' }}
                  >
                    {isUploading ? 'جاري الرفع...' : 'اعتماد ورفع 🚀'}
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
    <Suspense fallback={<div style={{ backgroundColor: '#000', height: '100vh' }}></div>}>
      <CameraApp />
    </Suspense>
  );
}
