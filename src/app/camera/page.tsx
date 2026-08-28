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
  const [isLandscape, setIsLandscape] = useState(true);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Filter warnings
  const [filterWarnings, setFilterWarnings] = useState<string[]>([]);

  useEffect(() => {
    // Check orientation
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  useEffect(() => {
    // Initialize Camera
    async function initCamera() {
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
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        setHasError("لا يمكن الوصول للكاميرا. يرجى إعطاء الصلاحيات اللازمة.");
      }
    }
    
    if (stuId && crsId && projId) {
      initCamera();
    } else {
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
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for AI filters
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    
    // Simple heuristic filters
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
    
    // Variance (for flat color / ceiling detection)
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
    if (variance < 100) warnings.push("⚠️ يبدو أن اللوحة فارغة أو ذات لون مسطح.");
    
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
      // 1. Fetch course details to get project_name
      const { data: course } = await supabase.from("courses").select("custom_week_names").eq("id", crsId).single();
      const projects = (course?.custom_week_names as any)?.__projects__ || [];
      const project = projects.find((p: any) => p.id === projId);
      const projectName = project ? project.name : "غير معروف";

      // 2. Convert base64 to Blob
      const res = await fetch(photo);
      const blob = await res.blob();
      
      const fileName = `${stuId}/${crsId}/${projId}_${Date.now()}.jpg`;
      
      // 3. Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from("artworks")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage.from("artworks").getPublicUrl(fileName);
      const photoUrl = publicUrlData.publicUrl;
      
      // 4. Save to evaluations table
      // It upserts based on course_id, student_id, project_id, project_name.
      const { error: dbError } = await supabase.from("evaluations").upsert({
        course_id: crsId,
        student_id: stuId,
        project_id: projId,
        project_name: projectName,
        photo_url: photoUrl,
        score: null, // null because it's a new submission
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
        <h2>تم رفع اللوحة بنجاح!</h2>
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

  if (!isLandscape) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: 'white', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', margin: 0 }}>📱➡️🖥️</h1>
        <h2 style={{ marginTop: '20px' }}>يرجى تدوير الهاتف بالعرض</h2>
        <p style={{ color: '#aaa' }}>لضمان التقاط اللوحة بشكل صحيح، يجب أن يكون الهاتف في الوضع الأفقي.</p>
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
              style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'white', border: '5px solid #ccc', cursor: 'pointer', outline: 'none' }}
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
