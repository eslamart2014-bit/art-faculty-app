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
  
  // Camera start state
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  
  // Orientation states
  const [isLeveled, setIsLeveled] = useState(false);
  const [tiltStatus, setTiltStatus] = useState("يرجى وضع الهاتف بشكل أفقي تماماً فوق اللوحة 📱");
  
  // Filter warnings
  const [filterWarnings, setFilterWarnings] = useState<string[]>([]);

  useEffect(() => {
    // We remove the old landscape check because we want top-down horizontal position
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta; // In degree in the range [-180,180) - front to back
      const gamma = event.gamma; // In degree in the range [-90,90) - left to right

      if (beta === null || gamma === null) return;

      // When the phone is flat on a table, beta and gamma are both near 0.
      // We allow a margin of error of 7 degrees.
      const threshold = 7;
      const isFlat = Math.abs(beta) < threshold && Math.abs(gamma) < threshold;
      
      setIsLeveled(isFlat);
      
      if (isFlat) {
        setTiltStatus("الوضع ممتاز! يمكنك التصوير الآن ✅");
      } else {
        setTiltStatus("يرجى وضع الهاتف بشكل أفقي وموزون تماماً فوق المشروع 📱");
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  const startCamera = async () => {
    // Request device orientation permission for iOS 13+
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState !== 'granted') {
          console.warn("Device orientation permission denied");
        }
      } catch (err) {
        console.error("Device orientation permission error", err);
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasError("عفواً، المتصفح لا يدعم الوصول للكاميرا.");
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraStarted(true);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setHasError("لا يمكن الوصول للكاميرا. يرجى إعطاء الصلاحيات اللازمة.");
    }
  };

  useEffect(() => {
    if (!stuId || !crsId || !projId) {
      setHasError("رابط غير صالح. يرجى الدخول من تليجرام مرة أخرى.");
    }
    
    return () => {
      // Cleanup stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stuId, crsId, projId]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      totalBrightness += brightness;
      
      rSum += r;
      gSum += g;
      bSum += b;
    }
    
    const pixelCount = data.length / 4;
    const avgBrightness = totalBrightness / pixelCount;
    const avgR = rSum / pixelCount;
    const avgG = gSum / pixelCount;
    const avgB = bSum / pixelCount;
    
    let variance = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      variance += Math.pow(r - avgR, 2) + Math.pow(g - avgG, 2) + Math.pow(b - avgB, 2);
    }
    variance = variance / (pixelCount * 3);
    
    const warnings = [];
    if (avgBrightness < 40) warnings.push("⚠️ الإضاءة ضعيفة جداً.");
    if (avgBrightness > 240) warnings.push("⚠️ الإضاءة ساطعة جداً (تجنب تصوير ورقة بيضاء فقط).");
    if (variance < 100) warnings.push("⚠️ يبدو أن المشروع فارغ أو ذو لون مسطح.");
    
    setFilterWarnings(warnings);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhoto(dataUrl);
  };

  const retakePhoto = () => {
    setPhoto(null);
    setFilterWarnings([]);
  };

  const uploadPhoto = async () => {
    if (!photo || !stuId || !crsId || !projId) return;
    
    setIsUploading(true);
    
    try {
      const { data: course } = await supabase.from("courses").select("custom_week_names").eq("id", crsId).single();
      const projects = (course?.custom_week_names as any)?.__projects__ || [];
      const project = projects.find((p: any) => p.id === projId);
      const projectName = project ? project.name : "غير معروف";

      const res = await fetch(photo);
      const blob = await res.blob();
      
      const fileName = `${stuId}/${crsId}/${projId}_${Date.now()}.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from("artworks")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage.from("artworks").getPublicUrl(fileName);
      const photoUrl = publicUrlData.publicUrl;
      
      const { error: dbError } = await supabase.from("evaluations").upsert({
        course_id: crsId,
        student_id: stuId,
        project_id: projId,
        project_name: projectName,
        photo_url: photoUrl,
        score: null, 
        ai_status: "pending"
      }, { onConflict: "course_id,student_id,project_name" });
      
      if (dbError) throw dbError;
      
      setUploadSuccess(true);
    } catch (err) {
      console.error("Upload failed", err);
      alert("حدث خطأ أثناء الرفع. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsUploading(false);
    }
  };

  if (uploadSuccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'system-ui' }}>
        <h1 style={{ color: '#4caf50', fontSize: '3rem', marginBottom: '10px' }}>✅</h1>
        <h2>تم رفع المشروع بنجاح!</h2>
        <p style={{ color: '#aaa', marginTop: '10px' }}>يمكنك الآن إغلاق هذه النافذة والعودة للتليجرام.</p>
        <button 
          onClick={() => {
             if ((window as any).Telegram?.WebApp) {
               (window as any).Telegram.WebApp.close();
             } else {
               window.close();
             }
          }}
          style={{ marginTop: '30px', padding: '15px 30px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer' }}
        >
          إغلاق
        </button>
      </div>
    );
  }

  if (hasError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: 'white', padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#ff5252', fontSize: '1.2rem' }}>{hasError}</p>
      </div>
    );
  }

  if (!isCameraStarted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: 'white', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', margin: 0 }}>📷</h1>
        <h2 style={{ marginTop: '20px' }}>مستعد لتصوير المشروع؟</h2>
        <p style={{ color: '#aaa', marginBottom: '15px' }}>ضع المشروع على سطح مستوٍ (طاولة أو أرضية)، وسنساعدك في التقاطه بشكل موزون لتجنب تشوه المنظور.</p>
        
        <div style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', border: '1px solid #ff9800', borderRadius: '8px', padding: '12px', marginBottom: '30px', textAlign: 'right', direction: 'rtl', fontSize: '0.9rem', color: '#ffcc80' }}>
          <strong>ملاحظة أمنية:</strong> سيطلب منك تليجرام الآن السماح للبوابة بالوصول للكاميرا (سيعرض رسالة تنبيه قياسية من النظام). هذه الصلاحية تستخدم حصراً في هذه اللحظة لالتقاط صورتك ولا يتم مشاركتها.
        </div>

        <button 
          onClick={startCamera}
          style={{ padding: '15px 40px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' }}
        >
          بدء الكاميرا
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </Head>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000', overflow: 'hidden' }}>
        
        {/* Viewport for Camera / Captured Photo */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!photo && (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )}
          {photo && (
            <img 
              src={photo} 
              alt="Captured" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          )}
          
          {/* Leveling Indicator Overlay */}
          {!photo && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ 
                width: '100px', 
                height: '100px', 
                border: `4px solid ${isLeveled ? '#4caf50' : '#ff9800'}`, 
                borderRadius: '50%',
                position: 'relative',
                transition: 'border-color 0.3s ease'
              }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '20px', height: '20px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', borderRadius: '50%', transition: 'background-color 0.3s ease' }} />
                
                {/* Crosshairs */}
                <div style={{ position: 'absolute', top: '-10px', left: '50%', width: '2px', height: '10px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', transform: 'translateX(-50%)' }} />
                <div style={{ position: 'absolute', bottom: '-10px', left: '50%', width: '2px', height: '10px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', transform: 'translateX(-50%)' }} />
                <div style={{ position: 'absolute', left: '-10px', top: '50%', width: '10px', height: '2px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', transform: 'translateY(-50%)' }} />
                <div style={{ position: 'absolute', right: '-10px', top: '50%', width: '10px', height: '2px', backgroundColor: isLeveled ? '#4caf50' : '#ff9800', transform: 'translateY(-50%)' }} />
              </div>
              <div style={{ marginTop: '20px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '20px', color: isLeveled ? '#4caf50' : 'white', fontWeight: 'bold' }}>
                {tiltStatus}
              </div>
            </div>
          )}
          
          {/* AI Warnings Overlay */}
          {filterWarnings.length > 0 && photo && (
            <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', backgroundColor: 'rgba(255, 82, 82, 0.9)', color: 'white', padding: '10px', borderRadius: '8px', zIndex: 10, textAlign: 'right', direction: 'rtl' }}>
              {filterWarnings.map((w, i) => <div key={i}>{w}</div>)}
              <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>يمكنك إعادة الالتقاط للحصول على صورة أفضل.</div>
            </div>
          )}
          
          {/* Hidden Canvas for processing */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Controls */}
        <div style={{ height: '100px', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 20px' }}>
          {!photo ? (
            <button 
              onClick={capturePhoto}
              disabled={!isLeveled} // Only clickable when leveled
              style={{ 
                width: '70px', 
                height: '70px', 
                borderRadius: '50%', 
                backgroundColor: isLeveled ? '#4caf50' : '#555', 
                border: `5px solid ${isLeveled ? 'white' : '#333'}`, 
                cursor: isLeveled ? 'pointer' : 'not-allowed', 
                outline: 'none',
                opacity: isLeveled ? 1 : 0.5,
                transition: 'all 0.3s ease'
              }}
              aria-label="Capture"
            />
          ) : (
            <>
              <button 
                onClick={retakePhoto}
                disabled={isUploading}
                style={{ padding: '12px 24px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', cursor: isUploading ? 'not-allowed' : 'pointer' }}
              >
                إعادة الالتقاط 🔄
              </button>
              
              <button 
                onClick={uploadPhoto}
                disabled={isUploading}
                style={{ padding: '12px 32px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isUploading ? 'جاري الرفع...' : 'اعتماد ورفع 🚀'}
              </button>
            </>
          )}
        </div>
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
