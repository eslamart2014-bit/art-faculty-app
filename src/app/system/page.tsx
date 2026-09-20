"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  UserCheck, 
  LogIn, 
  Camera, 
  RefreshCw, 
  LogOut, 
  CalendarCheck, 
  Award, 
  AlertTriangle, 
  MessageSquare, 
  CheckCircle2, 
  Layers, 
  ShieldAlert, 
  Sparkles, 
  UploadCloud, 
  ChevronLeft,
  ChevronDown,
  X,
  Smartphone,
  ImageIcon,
  FolderOpen,
  ArrowRight,
  Sun,
  RotateCw,
  ShieldCheck,
  Check
} from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";
import { getOrCreateDeviceInfo } from "@/lib/deviceFingerprint";
import { compressImageToWebP } from "@/lib/imageCompressor";

export default function SystemPage() {
  // Navigation & Auth State
  const [authMode, setAuthMode] = useState<"register" | "login">("login");
  const [currentStudent, setCurrentStudent] = useState<any>(null);
  const [accountStatus, setAccountStatus] = useState<"pending" | "active" | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Coordinators list
  const [coordinators, setCoordinators] = useState<any[]>([]);

  // Impersonation mode (Admin browsing as student)
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedStudentName, setImpersonatedStudentName] = useState("");

  // Registration Form State & Auto Lookup
  const [regCode, setRegCode] = useState("");
  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [matchedStudent, setMatchedStudent] = useState<any>(null);
  const [isLookingUpCode, setIsLookingUpCode] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [idCardPhoto, setIdCardPhoto] = useState<string | null>(null);
  const [showIdCamera, setShowIdCamera] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [tempIdCardPreview, setTempIdCardPreview] = useState<string | null>(null);

  // PIN Verification State
  const [enteredPin, setEnteredPin] = useState("");

  // Active Tab in Student Dashboard
  const [activeTab, setActiveTab] = useState<"attendance" | "evaluation" | "warnings" | "complaints">("evaluation");
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Course WhatsApp-Style Chat State
  const [selectedCourseForEval, setSelectedCourseForEval] = useState<any>(null);
  const [selectedProjectTab, setSelectedProjectTab] = useState<string>("all");
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  // Smart Camera State (Strict Live Camera, 2D/3D Mode, Anti-flicker)
  const [showArtworkCamera, setShowArtworkCamera] = useState(false);
  const [activeProjectForUpload, setActiveProjectForUpload] = useState<any>(null);
  const [cameraMode, setCameraMode] = useState<"2d" | "3d">("2d");
  const [orientationFrame, setOrientationFrame] = useState<"portrait" | "landscape">("portrait");
  const [capturedPhotos, setCapturedPhotos] = useState<any[]>([]);
  const [currentPhotoStep, setCurrentPhotoStep] = useState(1);
  const [requiredPhotosCount, setRequiredPhotosCount] = useState(1);
  const [cameraFrameState, setCameraFrameState] = useState<{
    quality: "good" | "dark" | "shaky";
    orientationMatches: boolean;
    message: string;
    frameColor: string;
    isReady: boolean;
  }>({
    quality: "shaky",
    orientationMatches: true,
    message: "جاري تهيئة الكاميرا وفحص الزاوية والإضاءة...",
    frameColor: "#f59e0b",
    isReady: false
  });
  const [uploadingProject, setUploadingProject] = useState(false);
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);

  // Complaint Form
  const [complaintTarget, setComplaintTarget] = useState("أستاذ المقرر");
  const [complaintText, setComplaintText] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Video and Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gyroListenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const gyroActiveRef = useRef(false);
  const isGyroLevelRef = useRef(true);
  const gyroMessageRef = useRef("");
  const lastFrameStateRef = useRef<{
    quality: "good" | "dark" | "shaky";
    orientationMatches: boolean;
    message: string;
    frameColor: string;
    isReady: boolean;
  }>({
    quality: "shaky",
    orientationMatches: true,
    message: "جاري تهيئة الكاميرا وفحص الزاوية والإضاءة...",
    frameColor: "#f59e0b",
    isReady: false
  });
  const idFileInputRef = useRef<HTMLInputElement>(null);

  // Safe ref setter: NEVER reassign srcObject if it's already set to the stream to eliminate flickering!
  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(e => console.log("video play err:", e));
    }
  };

  // Auto-detect screen rotation for camera frame aspect ratio
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        setOrientationFrame(window.innerWidth > window.innerHeight ? "landscape" : "portrait");
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Restore Session or Impersonate on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const impCode = params.get("impersonate");
      if (impCode) {
        setIsImpersonating(true);
        fetch(`/api/students/lookup?code=${encodeURIComponent(impCode)}`)
          .then(r => r.json())
          .then(data => {
            if (data.student) {
              setCurrentStudent(data.student);
              setImpersonatedStudentName(data.student.full_name);
              setAccountStatus("active");
              loadDashboard(data.student.student_code, undefined, true);
            }
          })
          .catch(err => console.error(err));
        return;
      }
    }

    try {
      const saved = localStorage.getItem("fania_student_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.student_code) {
          setCurrentStudent(parsed);
          setAccountStatus(parsed.is_pin_used || parsed.status === "active" ? "active" : "pending");
          loadDashboard(parsed.student_code, parsed.pin_code);
          fetchCoordinators(parsed.student_code);
          return;
        }
      }
    } catch (e) {}

    fetchCoordinators();

    return () => {
      stopCamera();
    };
  }, []);

  const fetchCoordinators = async (studentCode?: string) => {
    try {
      const code = studentCode || currentStudent?.student_code;
      const url = code ? `/api/coordinators?student_code=${encodeURIComponent(code)}` : "/api/coordinators";
      const res = await fetch(url);
      const data = await res.json();
      if (data.coordinators) setCoordinators(data.coordinators);
    } catch (e) {}
  };

  // Automated Code Lookup with debounce
  useEffect(() => {
    if (authMode !== "register" || !regCode.trim()) {
      setMatchedStudent(null);
      setLookupMessage(null);
      return;
    }

    const timer = setTimeout(async () => {
      const queryCode = regCode.trim();
      if (queryCode.length < 2) return;

      setIsLookingUpCode(true);
      setLookupMessage(null);

      try {
        const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(queryCode)}`);
        const data = await res.json();

        if (res.ok && data.student) {
          setMatchedStudent(data.student);
          setRegName(data.student.full_name);
          setLookupMessage(null);
        } else {
          setMatchedStudent(null);
          setLookupMessage(data.message || "الكود غير مسجل في كشوف الكلية الرسمية.");
        }
      } catch (e) {
        setLookupMessage("تعذر التحقق من الكود حالياً.");
      } finally {
        setIsLookingUpCode(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [regCode, authMode]);

  // Load Dashboard Data
  const loadDashboard = async (code: string, pin?: string, isImpersonationMode?: boolean) => {
    setLoading(true);
    setErrorMsg("");
    try {
      let activePin = pin;
      if (!activePin) {
        try {
          const sessionSaved = localStorage.getItem("fania_student_session");
          if (sessionSaved) {
            const parsed = JSON.parse(sessionSaved);
            activePin = parsed?.pin_code;
          }
        } catch (e) {}
      }
      if (!activePin && currentStudent?.pin_code) {
        activePin = currentStudent.pin_code;
      }

      const pinParam = activePin ? `&pin=${encodeURIComponent(activePin)}` : "";
      const impParam = isImpersonationMode || isImpersonating ? "&impersonate=true" : "";
      const res = await fetch(`/api/students/dashboard-data?code=${encodeURIComponent(code)}${pinParam}${impParam}&_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setAccountStatus("pending");
          setErrorMsg(data.error || "مطلوب الرقم السري لتفعيل الحساب");
        } else {
          setErrorMsg(data.error || "تعذر تحميل بيانات الطالب");
        }
      } else {
        setDashboardData(data);
        // تزامن فوري لكائن المقرر المختار لتحديث الأعمال والمشاريع تلقائياً
        if (data.projects) {
          setSelectedCourseForEval((prevCourse: any) => {
            if (!prevCourse) return prevCourse;
            const fresh = data.projects.find((c: any) => c.courseId === prevCourse.courseId);
            return fresh || prevCourse;
          });
        }
        if (data.student) {
          const mergedStudent = { ...(currentStudent || {}), ...data.student };
          if (activePin) mergedStudent.pin_code = activePin;
          setCurrentStudent(mergedStudent);
          if (!isImpersonationMode && !isImpersonating) {
            localStorage.setItem("fania_student_session", JSON.stringify(mergedStudent));
          }
          setAccountStatus("active");
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  // Real-time camera quality & anti-shake analyzer loop (Throttled, No 60fps flicker)
  const startQualityAnalysisLoop = (mode: "2d" | "3d") => {
    if (frameAnalysisIntervalRef.current) {
      clearInterval(frameAnalysisIntervalRef.current);
      frameAnalysisIntervalRef.current = null;
    }
    if (gyroListenerRef.current) {
      window.removeEventListener("deviceorientation", gyroListenerRef.current);
      gyroListenerRef.current = null;
    }

    gyroActiveRef.current = false;
    isGyroLevelRef.current = true;
    gyroMessageRef.current = "";

    // Gyro fallback timer: if no sensor data received after 1800ms, do not block student
    const gyroTimer = setTimeout(() => {
      if (!gyroActiveRef.current) {
        isGyroLevelRef.current = true;
      }
    }, 1800);

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta;
      const gamma = event.gamma;
      if (beta === null || gamma === null) return;

      gyroActiveRef.current = true;
      clearTimeout(gyroTimer);

      if (mode === "3d") {
        // 3D Sculpture: phone upright in front of the sculpture (|beta| ~ 90)
        const isUpright = Math.abs(Math.abs(beta) - 90) < 35 && Math.abs(gamma) < 40;
        isGyroLevelRef.current = isUpright;
        gyroMessageRef.current = isUpright ? "" : "📱 وجّه الهاتف عمودياً وثابتاً أمام المجسم";
      } else {
        // 2D Flat work: phone flat over table (|beta| < 35 & |gamma| < 35)
        // OR upright in front of easel/wall (|beta| ~ 90)
        const isFlat = Math.abs(beta) < 35 && Math.abs(gamma) < 35;
        const isUpright = Math.abs(Math.abs(beta) - 90) < 35 && Math.abs(gamma) < 40;
        const isOk = isFlat || isUpright;
        isGyroLevelRef.current = isOk;
        gyroMessageRef.current = isOk ? "" : "📱 وازِ الهاتف مع العمل الفني (أفقياً فوقه أو عمودياً أمامه)";
      }
    };

    gyroListenerRef.current = handleDeviceOrientation;
    window.addEventListener("deviceorientation", handleDeviceOrientation);

    // Frame evaluation run at steady 350ms interval (completely prevents screen tremor and battery drain)
    const checkFrame = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;

      canvas.width = 120;
      canvas.height = 90;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 120, 90);
      const imgData = ctx.getImageData(0, 0, 120, 90);
      const data = imgData.data;

      // 1. Average Brightness
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      }
      const avgBrightness = totalBrightness / (data.length / 4);

      // 2. Sharpness / Variance check
      let variance = 0;
      for (let i = 0; i < data.length - 8; i += 8) {
        variance += Math.abs(data[i] - data[i + 4]);
      }
      const avgVariance = variance / (data.length / 8);

      let quality: "good" | "dark" | "shaky" = "good";
      let message = "✅ الوضعية ممتازة وثابتة — اضغط زر الالتقاط 📸";
      let frameColor = "#10b981"; // Green
      let isReady = true;

      if (avgBrightness < 28) {
        quality = "dark";
        frameColor = "#ef4444";
        message = "🌙 الإضاءة ضعيفة — اقترب من مصدر إضاءة أو شغّل الفلاش 🔦";
        isReady = false;
      } else if (avgVariance < 3.2) {
        quality = "shaky";
        frameColor = "#f59e0b";
        message = "⚡ الصورة غير واضحة أو مهتزة — ثبّت يدك جيداً";
        isReady = false;
      } else if (gyroActiveRef.current && !isGyroLevelRef.current) {
        quality = "shaky";
        frameColor = "#f59e0b";
        message = gyroMessageRef.current || "يرجى وزن وضعية الهاتف أمام العمل الفني";
        isReady = false;
      }

      // ONLY trigger React re-render when state changes!
      if (
        lastFrameStateRef.current.isReady !== isReady ||
        lastFrameStateRef.current.quality !== quality ||
        lastFrameStateRef.current.frameColor !== frameColor ||
        lastFrameStateRef.current.message !== message
      ) {
        const nextState = { quality, orientationMatches: true, message, frameColor, isReady };
        lastFrameStateRef.current = nextState;
        setCameraFrameState(nextState);
      }
    };

    frameAnalysisIntervalRef.current = setInterval(checkFrame, 350);
  };

  // Start Camera Stream (Live Camera Only)
  const startCamera = async (type: "id" | "artwork", mode: "2d" | "3d" = "2d") => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === "id") {
        setShowIdCamera(true);
        setTempIdCardPreview(null);
      } else {
        setShowArtworkCamera(true);
        startQualityAnalysisLoop(mode);
      }

      if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log("video play err:", e));
      }
    } catch (err) {
      console.warn("Camera getUserMedia error:", err);
      if (type === "id") {
        idFileInputRef.current?.click();
      } else {
        alert("⚠️ تنبيه أمني: يشترط النظام التقاط الصورة مباشرة عبر كاميرا الهاتف لتوثيق أعمال الطلاب ومنع استخدام صور سابقة أو منتحلة. يرجى تفعيل إذن الكاميرا في متصفحك والمحاولة مرة أخرى.");
        setShowArtworkCamera(false);
      }
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (frameAnalysisIntervalRef.current) {
      clearInterval(frameAnalysisIntervalRef.current);
      frameAnalysisIntervalRef.current = null;
    }
    if (gyroListenerRef.current) {
      window.removeEventListener("deviceorientation", gyroListenerRef.current);
      gyroListenerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities: any = track.getCapabilities?.() || {};
        if (capabilities.torch) {
          const nextState = !torchOn;
          await (track as any).applyConstraints({ advanced: [{ torch: nextState }] });
          setTorchOn(nextState);
        } else {
          alert("كشاف الفلاش غير مدعوم على هذه الكاميرا في هذا المتصفح.");
        }
      } catch (e) {
        console.warn("Torch error:", e);
      }
    }
  };

  // Capture Single Photo Frame from Video
  const captureVideoFrame = (): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  // Snap Artwork Photo (Multi-photo support, Live Only, Always responsive)
  const handleSnapArtworkPhoto = async () => {
    const rawData = captureVideoFrame();
    if (!rawData) {
      alert("تعذر التقاط الصورة من تدفق الكاميرا، يرجى المحاولة مرة أخرى.");
      return;
    }

    // Shutter haptics
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(80); } catch(e) {}
    }

    // Trigger visual shutter flash
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 120);

    try {
      const compressed = await compressImageToWebP(rawData, 1280, 0.85);
      const newPhoto = {
        url: compressed.dataUrl,
        dhash: compressed.dhash,
        width: compressed.width,
        height: compressed.height,
        orientation: orientationFrame,
        step: currentPhotoStep
      };

      const nextList = [...capturedPhotos, newPhoto];
      setCapturedPhotos(nextList);

      if (nextList.length < requiredPhotosCount) {
        setCurrentPhotoStep(nextList.length + 1);
      } else {
        // All required photos captured! Close camera & open review modal immediately!
        stopCamera();
        setShowArtworkCamera(false);
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء معالجة وضغط الصورة");
    }
  };

  // Submit Artwork Photos to API (Connected with Telegram & Supabase Evaluations)
  const handleSubmitArtwork = async () => {
    if (!currentStudent || !selectedCourseForEval || !activeProjectForUpload) return;
    if (capturedPhotos.length < requiredPhotosCount) {
      alert(`المشروع يتطلب التقاط ${requiredPhotosCount} صور لتوثيق العمل، قمت بالتقاط ${capturedPhotos.length} فقط!`);
      return;
    }

    setUploadingProject(true);
    try {
      const deviceInfo = getOrCreateDeviceInfo();
      const projTitle = (activeProjectForUpload.title || activeProjectForUpload.name || '').trim();
      const res = await fetch("/api/students/submit-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: currentStudent.student_code,
          student_name: currentStudent.full_name,
          pin_code: currentStudent?.pin_code || enteredPin || "",
          course_id: selectedCourseForEval.courseId,
          course_name: selectedCourseForEval.courseName,
          project_name: projTitle,
          images: capturedPhotos,
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "فشل رفع المشروع إلى السحابة");
      } else {
        // كائن التسليم الجديد للتحديث اللحظي المباشر في الواجهة
        const newSubObj = data.submission || {
          id: "sub_" + Date.now(),
          student_code: currentStudent.student_code,
          student_name: currentStudent.full_name,
          course_id: selectedCourseForEval.courseId,
          course_name: selectedCourseForEval.courseName,
          project_name: projTitle,
          images: capturedPhotos.map((p: any) => ({ url: p.url || p.dataUrl || p })),
          status: "pending_evaluation",
          score: null,
          created_at: new Date().toISOString()
        };

        // 1. تحديث فوري لكائن المقرر المختار ليظهر العمل في التاب فوراً ويختفي زر الرفع
        setSelectedCourseForEval((prev: any) => {
          if (!prev) return prev;
          const oldSubs = (prev.submissions || []).filter((s: any) => (s.project_name || '').trim() !== projTitle);
          const updatedSubs = [newSubObj, ...oldSubs];
          const updatedAssigned = (prev.assignedProjects || []).map((p: any) => {
            if ((p.title || '').trim() === projTitle) {
              return { ...p, status: "submitted", submission: newSubObj };
            }
            return p;
          });
          return {
            ...prev,
            submissions: updatedSubs,
            assignedProjects: updatedAssigned
          };
        });

        // 2. تحديث فوري لبيانات لوحة الطالب dashboardData
        setDashboardData((prevData: any) => {
          if (!prevData || !prevData.projects) return prevData;
          return {
            ...prevData,
            projects: prevData.projects.map((c: any) => {
              if (c.courseId === selectedCourseForEval.courseId) {
                const oldSubs = (c.submissions || []).filter((s: any) => (s.project_name || '').trim() !== projTitle);
                const updatedSubs = [newSubObj, ...oldSubs];
                const updatedAssigned = (c.assignedProjects || []).map((p: any) => {
                  if ((p.title || '').trim() === projTitle) {
                    return { ...p, status: "submitted", submission: newSubObj };
                  }
                  return p;
                });
                return {
                  ...c,
                  submissions: updatedSubs,
                  assignedProjects: updatedAssigned
                };
              }
              return c;
            })
          };
        });

        // 3. تثبيت التاب النشط على المشروع المرفوع ليرى الطالب صورته فوراً
        setSelectedProjectTab(projTitle);

        setShowArtworkCamera(false);
        setCapturedPhotos([]);
        setCurrentPhotoStep(1);
        setActiveProjectForUpload(null);

        alert("✓ تم تسليم العمل الفني بنجاح!\nالعمل الآن محفوظ في تبويب المشروع وبانتظار رصد الدرجة من أستاذ المقرر.");

        // 4. مزامنة البيانات في الخلفية
        loadDashboard(currentStudent.student_code, currentStudent?.pin_code || enteredPin);
      }
    } catch (e: any) {
      alert("خطأ أثناء رفع المشروع: " + e.message);
    } finally {
      setUploadingProject(false);
    }
  };

  // Open Smart Camera for a specific Assigned Project (Strict Live Camera)
  const handleOpenSmartCameraForProject = (proj: any) => {
    setActiveProjectForUpload(proj);
    const mode: "2d" | "3d" = (proj.cameraMode || proj.camera_mode) === "3d" ? "3d" : "2d";
    setCameraMode(mode);
    const reqPhotos = proj.requiredPhotos || proj.required_photos || (mode === "3d" ? 2 : 1);
    setRequiredPhotosCount(reqPhotos);
    setCapturedPhotos([]);
    setCurrentPhotoStep(1);

    const isLandscape = typeof window !== "undefined" && window.innerWidth > window.innerHeight;
    setOrientationFrame(isLandscape ? "landscape" : "portrait");

    startCamera("artwork", mode);
  };

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regCode || !regMobile) {
      setErrorMsg("يرجى إدخال الكود ورقم الموبايل");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const deviceInfo = getOrCreateDeviceInfo();
      const res = await fetch("/api/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: regCode.trim(),
          full_name: regName.trim(),
          mobile: regMobile.trim(),
          id_card_image: idCardPhoto,
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyActive) {
          setAuthMode("login");
          setErrorMsg(data.error);
        } else {
          setErrorMsg(data.error || "فشل التسجيل");
        }
      } else {
        setSuccessMsg(data.message);
        setCurrentStudent(data.student);
        setAccountStatus("pending");
        fetchCoordinators(data.student.student_code);
        localStorage.setItem("fania_student_session", JSON.stringify(data.student));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regCode || !enteredPin) {
      setErrorMsg("يرجى إدخال كود الطالب والرقم السري (PIN)");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const deviceInfo = getOrCreateDeviceInfo();
      const res = await fetch("/api/students/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: regCode.trim(),
          pin_code: enteredPin.trim(),
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "بيانات الدخول غير صحيحة");
      } else {
        const fullSession = {
          ...data.student,
          pin_code: enteredPin.trim(),
          status: "active",
          is_pin_used: true
        };
        setCurrentStudent(fullSession);
        setAccountStatus("active");
        localStorage.setItem("fania_student_session", JSON.stringify(fullSession));
        loadDashboard(data.student.student_code, enteredPin.trim());
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify PIN Submit (immediate session save without re-login)
  const handleVerifyPinSubmit = async () => {
    if (!enteredPin || !currentStudent) {
      setErrorMsg("يرجى إدخال الرقم السري الممنوح لك من المنسق");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const deviceInfo = getOrCreateDeviceInfo();
      const res = await fetch("/api/students/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: currentStudent.student_code,
          pin_code: enteredPin.trim(),
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "الرقم السري غير صحيح");
      } else {
        const updatedStudent = {
          ...currentStudent,
          ...(data.student || {}),
          pin_code: enteredPin.trim(),
          status: "active",
          is_pin_used: true
        };
        localStorage.setItem("fania_student_session", JSON.stringify(updatedStudent));
        setCurrentStudent(updatedStudent);
        setAccountStatus("active");
        setSuccessMsg("تم تفعيل حسابك بنجاح! جاري تحميل مقرراتك وحضورك...");
        loadDashboard(updatedStudent.student_code, enteredPin.trim());
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "خطأ أثناء التحقق من الرقم السري");
    } finally {
      setLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("fania_student_session");
    setCurrentStudent(null);
    setAccountStatus(null);
    setDashboardData(null);
    setSelectedCourseForEval(null);
    setEnteredPin("");
    setRegCode("");
    setRegMobile("");
  };

  // Handle Complaint Submit
  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText.trim()) return;

    setSubmittingComplaint(true);
    try {
      const res = await fetch("/api/students/complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: currentStudent.student_code,
          student_name: currentStudent.full_name,
          academic_year: currentStudent.academic_year,
          target_entity: complaintTarget,
          subject: `شكوى/مقترح طلابي موجه إلى: ${complaintTarget}`,
          content: complaintText.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert("✓ تم إرسال رسالتك ومقترحك بنجاح إلى الإدارة.");
        setComplaintText("");
        loadDashboard(currentStudent.student_code, currentStudent?.pin_code || enteredPin);
      } else {
        alert(data.error || "تعذر إرسال الشكوى");
      }
    } catch (e: any) {
      alert("خطأ في الإرسال: " + e.message);
    } finally {
      setSubmittingComplaint(false);
    }
  };

  // ==========================================
  // VIEW 1: شاشة انتظار الرقم السري (Pending PIN)
  // ==========================================
  if (currentStudent && accountStatus === "pending") {
    return (
      <div style={{ minHeight: "100vh", padding: "16px", maxWidth: "480px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        
        {/* شريط أعلى به اسم الطالب وزر خروج مدمج */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          gap: "10px",
          padding: "10px 14px", 
          background: "#141b29", 
          borderRadius: "14px", 
          border: "1px solid #2a374f", 
          marginBottom: "16px" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
            <div style={{ width: "36px", height: "36px", minWidth: "36px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
              <UserCheck size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentStudent.full_name}</div>
              <div style={{ color: "#94a3b8", fontSize: "11px" }}>كود: {formatStudentCode(currentStudent.student_code)}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn-compact"
            title="تسجيل الخروج"
            style={{ 
              background: "rgba(239, 68, 68, 0.12)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              padding: "6px 12px",
              cursor: "pointer"
            }}
          >
            <LogOut size={13} />
            <span>خروج</span>
          </button>
        </div>

        {/* الرسالة الإرشادية لإدخال الـ PIN */}
        <div className="glass-card animate-fade-in" style={{ padding: "24px 18px", textAlign: "center", marginBottom: "20px" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", marginBottom: "16px" }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff", marginBottom: "12px", lineHeight: "1.5" }}>
            الحساب مسجل وبانتظار التفعيل 🔐
          </h2>

          <p style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.7", marginBottom: "20px" }}>
            أهلاً بك يا <b>{currentStudent.full_name}</b>. تم تسجيل بياناتك بنجاح. للحفاظ على سرية درجاتك، يرجى التوجه لأحد منسقي الكلية لمطابقة بطاقتك واستلام <b>الرقم السري (PIN)</b> المكون من 8 خانات.
          </p>

          {errorMsg && (
            <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "12px" }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "12px" }}>
              ✓ {successMsg}
            </div>
          )}

          {/* إدخال الـ PIN للتفعيل الفوري */}
          <div style={{ background: "#0d131f", padding: "16px", borderRadius: "12px", border: "1px solid #1e293b", marginBottom: "20px" }}>
            <label style={{ display: "block", color: "#38bdf8", fontSize: "13px", fontWeight: "bold", marginBottom: "8px" }}>
              هل استلمت الرقم السري (PIN) من المنسق؟
            </label>
            <input 
              type="text"
              maxLength={8}
              placeholder="أدخل الـ PIN المكون من 8 خانات..."
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                textAlign: "center",
                fontSize: "18px",
                fontFamily: "monospace",
                letterSpacing: "4px",
                fontWeight: "bold",
                background: "#141b29",
                border: "1px solid #2a374f",
                borderRadius: "8px",
                color: "#fbbf24",
                marginBottom: "12px"
              }}
            />
            <button
              onClick={handleVerifyPinSubmit}
              disabled={loading || enteredPin.length < 4}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "جاري التحقق والتفعيل..." : "تأكيد وتفعيل الحساب فورياً ✅"}
            </button>
          </div>

          {/* قائمة المنسقين */}
          {coordinators.length > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "bold", marginBottom: "8px" }}>
                منسقو النظام المعتمدون بالكلية:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {coordinators.map((c) => (
                  <div key={c.id} style={{ background: "#101622", padding: "8px 12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", border: "1px solid #1e293b" }}>
                    <span style={{ color: "#fff", fontWeight: "600" }}>{c.full_name}</span>
                    <span style={{ color: "#38bdf8" }}>{c.role || "منسق المنظومة"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", color: "#64748b", fontSize: "11px", marginBottom: "10px" }}>
          جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: شاشة لوحة بيانات الطالب المفعل (Active Student Dashboard)
  // ==========================================
  if (currentStudent && accountStatus === "active") {
    // Filter projects for selected course
    const activeCourseAssignedProjects = selectedCourseForEval?.assignedProjects || [];
    const activeCourseSubmissions = selectedCourseForEval?.submissions || [];

    // Filter by active project tab
    const filteredSubmissions = selectedProjectTab === "all"
      ? activeCourseSubmissions
      : activeCourseSubmissions.filter((s: any) => s.project_name === selectedProjectTab);

    return (
      <div style={{ minHeight: "100vh", padding: "14px", maxWidth: "550px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
        
        {/* شريط وضع تصفح الإدارة العائم */}
        {isImpersonating && (
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 9999,
            background: "linear-gradient(135deg, #b91c1c, #991b1b)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: "12px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
            fontSize: "12px",
            fontWeight: "bold",
            border: "1px solid #ef4444"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>👑</span>
              <span>وضع تصفح الإدارة — حساب: {currentStudent.full_name} ({formatStudentCode(currentStudent.student_code)})</span>
            </div>
            <button
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  window.location.href = "/";
                }
              }}
              className="btn-compact"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.4)",
                padding: "4px 8px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "bold"
              }}
            >
              الرجوع للوحة الإدارة ✕
            </button>
          </div>
        )}

        {/* شريط أعلى به اسم الطالب والفرقة وزر خروج مدمج لا يطغى على المساحة */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          gap: "10px",
          padding: "10px 14px", 
          background: "#141b29", 
          borderRadius: "14px", 
          border: "1px solid #2a374f", 
          marginBottom: "12px" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
            <div style={{ 
              width: "36px", 
              height: "36px", 
              minWidth: "36px", 
              borderRadius: "10px", 
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "#fff", 
              fontWeight: "bold", 
              fontSize: "15px"
            }}>
              {currentStudent.full_name?.charAt(0) || "ط"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {currentStudent.full_name}
              </div>
              <div style={{ color: "#38bdf8", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>كود: {formatStudentCode(currentStudent.student_code)}</span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span style={{ color: "#94a3b8" }}>{currentStudent.academic_year}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button 
              onClick={() => loadDashboard(currentStudent.student_code, currentStudent?.pin_code || enteredPin)} 
              className="btn-compact"
              disabled={loading}
              title="تحديث البيانات فورياً"
              style={{ 
                background: "rgba(56, 189, 248, 0.12)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                padding: "6px 11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                fontWeight: "bold"
              }}
            >
              <RotateCw size={13} className={loading ? "animate-spin" : ""} />
              <span>تحديث</span>
            </button>

            <button 
              onClick={handleLogout} 
              className="btn-compact"
              title="تسجيل الخروج"
              style={{ 
                background: "rgba(239, 68, 68, 0.12)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                padding: "6px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px"
              }}
            >
              <LogOut size={13} />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* تابات التنقل الرئيسية لشاشة الطالب (صف أفقي سلس بدون التواء) */}
        <div 
          className="no-scrollbar"
          style={{ 
            display: "flex", 
            flexWrap: "nowrap", 
            overflowX: "auto", 
            whiteSpace: "nowrap", 
            gap: "8px", 
            paddingBottom: "8px", 
            marginBottom: "12px",
            scrollbarWidth: "none"
          }}
        >
          {[
            { id: "evaluation", label: "المقررات والتقييمات 🎨", color: "#10b981" },
            { id: "attendance", label: "سجل الحضور والغياب 📅", color: "#38bdf8" },
            { id: "warnings", label: "الإنذارات ⚠️", color: "#ef4444" },
            { id: "complaints", label: "الشكاوى والمقترحات 📬", color: "#f59e0b" }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id !== "evaluation") setSelectedCourseForEval(null);
                }}
                className="btn-compact"
                style={{
                  flexShrink: 0,
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: isActive ? `1px solid ${tab.color}` : "1px solid rgba(255,255,255,0.08)",
                  background: isActive ? `${tab.color}22` : "rgba(255,255,255,0.03)",
                  color: isActive ? "#fff" : "#94a3b8",
                  fontWeight: isActive ? "bold" : "normal",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================= */}
        {/* TAB 1: EVALUATION & PROJECTS (WhatsApp-Style Structured View) */}
        {/* ========================================================= */}
        {activeTab === "evaluation" && (
          <div className="animate-fade-in" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            
            {/* 1.1 شاشة عرض المقررات بأزرار واضحة إذا لم يختر الطالب مقرراً بعد */}
            {!selectedCourseForEval ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Award size={18} color="#10b981" />
                    <span>اختر المقرر الدراسي للاطلاع على المشاريع والتسليمات:</span>
                  </div>
                </div>

                {dashboardData?.projects?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {dashboardData.projects.map((course: any) => {
                      const assignedCount = course.assignedProjects?.length || 0;
                      const subsCount = course.submissions?.length || 0;
                      const gradedCount = (course.assignedProjects || []).filter((p: any) => p.status === "evaluated").length;

                      return (
                        <div
                          key={course.courseId}
                          onClick={() => {
                            setSelectedCourseForEval(course);
                            const firstProj = course.assignedProjects?.[0]?.title;
                            setSelectedProjectTab(firstProj || "all");
                          }}
                          style={{
                            background: "#141b29",
                            border: "1px solid #2a374f",
                            borderRadius: "14px",
                            padding: "16px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = "#38bdf8"}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = "#2a374f"}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}>
                              {course.courseName}
                            </div>
                            
                            {/* اسم المعيد أو الأستاذ بالدرجة الوظيفية الدقيقة */}
                            <div style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "600", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <span>👨‍🏫</span>
                              <span>{course.instructorTitle || "أستاذ / معيد المقرر"}</span>
                            </div>

                            <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "#94a3b8", flexWrap: "wrap" }}>
                              <span style={{ background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", padding: "2px 8px", borderRadius: "6px" }}>
                                🎨 {assignedCount} مشاريع معتمدة
                              </span>
                              <span style={{ background: "rgba(16, 185, 129, 0.1)", color: "#34d399", padding: "2px 8px", borderRadius: "6px" }}>
                                ✓ {gradedCount} تم تقييمها
                              </span>
                            </div>
                          </div>

                          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", flexShrink: 0, marginRight: "10px" }}>
                            ←
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass-card" style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                    <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎨</div>
                    <div>لا توجد مقررات دراسية مسجلة لفرقتك وسكشنك حالياً.</div>
                  </div>
                )}
              </div>
            ) : (
              /* 1.2 شاشة المقرر بنمط رسائل الواتس والمشاريع المنسدلة المحددة */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0b0f19", border: "1px solid #1e293b", borderRadius: "16px", overflow: "hidden" }}>
                
                {/* رأس المحادثة (WhatsApp-Style Header) */}
                <div style={{ 
                  background: "#141b29", 
                  padding: "12px 14px", 
                  borderBottom: "1px solid #2a374f", 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  gap: "10px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <button
                      onClick={() => setSelectedCourseForEval(null)}
                      className="btn-compact"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "#38bdf8",
                        padding: "6px 10px",
                        fontSize: "12px",
                        cursor: "pointer",
                        border: "none"
                      }}
                    >
                      ← المقررات
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {selectedCourseForEval.courseName}
                      </div>
                      <div style={{ color: "#34d399", fontSize: "11px" }}>
                        {selectedCourseForEval.instructorTitle || "أستاذ / معيد المقرر"}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: "11px", color: "#94a3b8", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "6px" }}>
                    مشاريع المقرر
                  </span>
                </div>

                {/* شريط تابات المشاريع المعتمدة لهذا المقرر (صف أفقي سلس بالأعلى) */}
                <div 
                  className="no-scrollbar"
                  style={{ 
                    display: "flex", 
                    flexWrap: "nowrap", 
                    overflowX: "auto", 
                    whiteSpace: "nowrap", 
                    gap: "6px", 
                    padding: "10px 12px", 
                    background: "#0e1524", 
                    borderBottom: "1px solid #1a2336",
                    scrollbarWidth: "none"
                  }}
                >
                  <button
                    onClick={() => setSelectedProjectTab("all")}
                    className="btn-compact"
                    style={{
                      flexShrink: 0,
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: selectedProjectTab === "all" ? "1px solid #38bdf8" : "1px solid #2a374f",
                      background: selectedProjectTab === "all" ? "rgba(56, 189, 248, 0.2)" : "transparent",
                      color: selectedProjectTab === "all" ? "#fff" : "#94a3b8",
                      fontSize: "12px",
                      fontWeight: selectedProjectTab === "all" ? "bold" : "normal"
                    }}
                  >
                    كل الأعمال ({activeCourseSubmissions.length})
                  </button>

                  {activeCourseAssignedProjects.map((p: any) => {
                    const isTabActive = selectedProjectTab === p.title;
                    const isProjSubmitted = p.status === "submitted" || p.status === "evaluated" || p.submission || activeCourseSubmissions.some((s: any) => (s.project_name || '').trim() === (p.title || '').trim());
                    const isProjGraded = p.status === "evaluated" || (p.evaluation && p.evaluation.score !== null && Number(p.evaluation.score) > 0);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProjectTab(p.title)}
                        className="btn-compact"
                        style={{
                          flexShrink: 0,
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: isTabActive ? "1px solid #10b981" : "1px solid #2a374f",
                          background: isTabActive ? "rgba(16, 185, 129, 0.2)" : "transparent",
                          color: isTabActive ? "#fff" : "#94a3b8",
                          fontSize: "12px",
                          fontWeight: isTabActive ? "bold" : "normal",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        <span>{p.title}</span>
                        <span>{isProjGraded ? "✅" : (isProjSubmitted ? "⏳" : "⚠️")}</span>
                      </button>
                    );
                  })}
                </div>

                {/* منطقة الرسائل والتسلسل الزمني (Chat Thread Body) */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  
                  {/* رسالة إرشادية للمشروع المختار من الأستاذ */}
                  {selectedProjectTab !== "all" && (() => {
                    const targetAssigned = activeCourseAssignedProjects.find((p: any) => (p.title || '').trim() === (selectedProjectTab || '').trim());
                    if (!targetAssigned) return null;

                    return (
                      <div style={{ 
                        alignSelf: "flex-start", 
                        maxWidth: "88%", 
                        background: "#162032", 
                        border: "1px solid #25334d", 
                        borderRadius: "14px 14px 14px 2px", 
                        padding: "12px 14px",
                        color: "#cbd5e1",
                        fontSize: "13px",
                        lineHeight: "1.6"
                      }}>
                        <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "13px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>📌 تكليف مشروع:</span>
                          <span style={{ color: "#fff" }}>{targetAssigned.title}</span>
                        </div>
                        <div>الدرجة العظمى: <b style={{ color: "#fbbf24" }}>{targetAssigned.maxScore} درجات</b></div>
                        <div>الوضعية المطلوبة: <b style={{ color: "#34d399" }}>{targetAssigned.cameraMode === "3d" ? "مجسم ثلاثي الأبعاد 🗿" : "لوحة ثنائية الأبعاد 🖼️"}</b></div>
                        <div>الصور المطلوبة: <b style={{ color: "#a78bfa" }}>{targetAssigned.requiredPhotos || 1} صور بزوايا مختلفة</b></div>
                      </div>
                    );
                  })()}

                  {/* الأعمال والتقييمات المسلمة لهذا المشروع */}
                  {filteredSubmissions.length > 0 ? (
                    filteredSubmissions.map((sub: any) => {
                      const isGraded = sub.score !== null && sub.score !== undefined && Number(sub.score) > 0;
                      
                      let imageList: any[] = [];
                      if (Array.isArray(sub.images)) {
                        imageList = sub.images;
                      } else if (typeof sub.images === 'string') {
                        try { imageList = JSON.parse(sub.images); } catch(e) { imageList = []; }
                      } else if (sub.images && typeof sub.images === 'object') {
                        imageList = [sub.images];
                      }

                      return (
                        <div 
                          key={sub.id}
                          style={{
                            alignSelf: "flex-end",
                            maxWidth: "92%",
                            background: "linear-gradient(135deg, #102318, #0e2b1d)",
                            border: "1px solid rgba(16, 185, 129, 0.4)",
                            borderRadius: "14px 14px 2px 14px",
                            padding: "12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: "#34d399", fontWeight: "bold", fontSize: "13px" }}>
                              {sub.project_name}
                            </span>
                            <span style={{ 
                              fontSize: "11px", 
                              fontWeight: "bold", 
                              padding: "3px 9px", 
                              borderRadius: "6px",
                              background: isGraded ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.2)",
                              color: isGraded ? "#34d399" : "#fbbf24",
                              border: isGraded ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)"
                            }}>
                              {isGraded ? `تم التقييم: ${sub.score} درجة ✅` : "بانتظار رصد الدرجة من أستاذ المقرر ⏳"}
                            </span>
                          </div>

                          {/* صور العمل الفني المسلم */}
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {imageList.map((img: any, i: number) => {
                              const imgUrl = typeof img === 'string' ? img : (img?.url || img?.dataUrl || '');
                              if (!imgUrl) return null;
                              return (
                                <div
                                  key={i}
                                  onClick={() => setPreviewModalImage(imgUrl)}
                                  title="اضغط للتكبير والمراجعة"
                                  style={{ width: "95px", height: "95px", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", background: "#000", position: "relative" }}
                                >
                                  <img src={imgUrl} alt="عمل فني" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                  <div style={{ position: "absolute", bottom: "2px", right: "2px", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "9px", padding: "1px 4px", borderRadius: "3px" }}>
                                    🔍 تكبير
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#86efac", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "6px" }}>
                            <span>
                              {sub.created_at ? new Date(sub.created_at).toLocaleDateString("ar-EG") : "تم التسليم"} ✓✓
                            </span>
                            <span style={{ color: "#94a3b8" }}>
                              {isGraded ? "تم الاعتماد والرصد بنجاح" : "قيد المراجعة لدى أستاذ المقرر"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: "center", padding: "28px 14px", color: "#94a3b8", fontSize: "13px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.1)" }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>📸</div>
                      <div>لم تقم برفع عمل فني لهذا المشروع بعد.</div>
                      <div style={{ color: "#38bdf8", fontSize: "11px", marginTop: "4px" }}>اضغط على زر التقاط أدناه لتصوير عملك لايف ورفعه فورياً للأستاذ!</div>
                    </div>
                  )}

                </div>

                {/* الشريط السفلي الثابت (Action Bar) مع ميزة قفل المشروع بعد التسليم */}
                <div style={{ padding: "12px 14px", background: "#141b29", borderTop: "1px solid #2a374f" }}>
                  {(() => {
                    const activeAssigned = activeCourseAssignedProjects.find((p: any) => (p.title || '').trim() === (selectedProjectTab || '').trim()) || (selectedProjectTab === "all" ? null : activeCourseAssignedProjects[0]);
                    
                    // التحقق مما إذا كان الطالب قد رفع هذا المشروع بالفعل
                    const isAlreadySubmitted = activeAssigned && (
                      activeAssigned.status === "submitted" ||
                      activeAssigned.status === "evaluated" ||
                      activeAssigned.submission ||
                      activeCourseSubmissions.some((s: any) => (s.project_name || '').trim() === (activeAssigned.title || '').trim())
                    );

                    if (isAlreadySubmitted) {
                      const isGraded = activeAssigned.status === "evaluated" || (activeAssigned.evaluation && activeAssigned.evaluation.score !== null && Number(activeAssigned.evaluation.score) > 0);
                      const currentScore = activeAssigned.evaluation?.score ?? activeAssigned.score;

                      return (
                        <div style={{
                          width: "100%",
                          padding: "12px 16px",
                          background: isGraded ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                          border: isGraded ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
                          borderRadius: "12px",
                          textAlign: "center",
                          color: isGraded ? "#34d399" : "#fbbf24",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px"
                        }}>
                          <div style={{ fontWeight: "bold", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <span>{isGraded ? "✅" : "⏳"}</span>
                            <span>
                              {isGraded
                                ? `تم تقييم هذا المشروع: (${currentScore} من ${activeAssigned.maxScore}) ✓`
                                : "تم تسليم هذا المشروع بنجاح — بانتظار رصد الدرجة من أستاذ المقرر ⏳"}
                            </span>
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: "11px" }}>
                            تم قفل الرفع لمنع تكرار التسليم. إذا أردت إعادة التصوير، يرجى طلب فك القفل من أستاذ المقرر.
                          </div>
                        </div>
                      );
                    }

                    if (selectedProjectTab === "all" && activeCourseAssignedProjects.length > 0) {
                      return (
                        <div style={{ textAlign: "center", padding: "10px", color: "#94a3b8", fontSize: "12px" }}>
                          👈 يرجى اختيار تبويب المشروع من الشريط بالأعلى لتصويره وتسليمه
                        </div>
                      );
                    }

                    return (
                      <button
                        onClick={() => {
                          if (activeAssigned) {
                            handleOpenSmartCameraForProject(activeAssigned);
                          } else {
                            handleOpenSmartCameraForProject({
                              title: selectedCourseForEval.courseName + " - عمل فني",
                              cameraMode: "2d",
                              requiredPhotos: 1
                            });
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "12px",
                          background: "linear-gradient(135deg, #2563eb, #10b981)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "10px",
                          fontWeight: "bold",
                          fontSize: "14px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px"
                        }}
                      >
                        <Camera size={18} />
                        <span>
                          {activeAssigned 
                            ? `📷 تصوير ورفع مشروع (${activeAssigned.title})` 
                            : "📷 تصوير ورفع عمل فني لهذا المقرر"}
                        </span>
                      </button>
                    );
                  })()}
                </div>

              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ATTENDANCE (سجل الحضور والغياب) */}
        {/* ========================================================= */}
        {activeTab === "attendance" && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "16px", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarCheck size={18} color="#38bdf8" />
              <span>سجلات حضور المحاضرات والسكاشن:</span>
            </h3>

            {dashboardData?.attendance?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {dashboardData.attendance.map((c: any) => (
                  <div key={c.courseId} className="glass-card" style={{ padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>{c.courseName}</span>
                      <span style={{ 
                        fontSize: "12px", 
                        padding: "3px 8px", 
                        borderRadius: "8px", 
                        background: c.rate >= 75 ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: c.rate >= 75 ? "#34d399" : "#f87171",
                        fontWeight: "bold"
                      }}>
                        نسبة الحضور: {c.rate}%
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#94a3b8" }}>
                      <span>حاضر: <b style={{ color: "#34d399" }}>{c.attended}</b></span>
                      <span>•</span>
                      <span>غائب: <b style={{ color: "#f87171" }}>{c.absent}</b></span>
                      <span>•</span>
                      <span>إجمالي المحاضرات: {c.totalLectures}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                لا توجد سجلات حضور مسجلة لك حتى الآن.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: WARNINGS (الإنذارات) */}
        {/* ========================================================= */}
        {activeTab === "warnings" && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "16px", color: "#f87171", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={18} />
              <span>إنذارات الغياب وتجاوز النسبة المقررة:</span>
            </h3>

            {dashboardData?.warnings?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {dashboardData.warnings.map((w: any) => (
                  <div key={w.courseId} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ color: "#fca5a5", fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
                      ⚠️ إنذار غياب في مقرر: {w.courseName}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                      تجاوزت عدد الغيابات المسموح بها ({w.absent} مرات غياب). يرجى مراجعة أستاذ المقرر تجنباً للحرمان من الامتحان.
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: "30px", textAlign: "center", color: "#34d399" }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontWeight: "bold" }}>سجلك الأكاديمي ممتاز!</div>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>لا توجد أي إنذارات غياب مسجلة بحقك.</div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: COMPLAINTS & SUGGESTIONS (الشكاوى والمقترحات) */}
        {/* ========================================================= */}
        {activeTab === "complaints" && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "16px", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={18} color="#f59e0b" />
              <span>إرسال شكوى أو مقترح رسمي للإدارة:</span>
            </h3>

            <form onSubmit={handleComplaintSubmit} className="glass-card" style={{ padding: "16px", marginBottom: "16px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                الجهة الموجه إليها:
              </label>
              <select
                value={complaintTarget}
                onChange={(e) => setComplaintTarget(e.target.value)}
                style={{ width: "100%", padding: "10px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "8px", color: "#fff", marginBottom: "12px", fontSize: "13px" }}
              >
                <option value="أستاذ المقرر">أستاذ المقرر</option>
                <option value="رئيس القسم">رئيس القسم</option>
                <option value="وكيل الكلية لشؤون التعليم والطلاب">وكيل الكلية لشؤون التعليم والطلاب</option>
                <option value="إدارة الكلية والدعم الفني">إدارة الكلية والدعم الفني</option>
              </select>

              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                نص الشكوى أو المقترح:
              </label>
              <textarea
                rows={4}
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="اكتب تفاصيل الشكوى أو المقترح هنا..."
                style={{ width: "100%", padding: "10px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "8px", color: "#fff", marginBottom: "12px", fontSize: "13px", resize: "none" }}
              />

              <button
                type="submit"
                disabled={submittingComplaint || !complaintText.trim()}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#f59e0b",
                  color: "#000",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  fontSize: "13px",
                  cursor: submittingComplaint ? "not-allowed" : "pointer"
                }}
              >
                {submittingComplaint ? "جاري الإرسال..." : "إرسال الشكوى رسمياً 📬"}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* نافذة الكاميرا المباشرة الذكية - لايف فقط بدون رفع ملفات */}
        {/* ========================================================= */}
        {showArtworkCamera && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "#000",
            zIndex: 99999,
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
            <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#000" }}>
              {/* وميض الالتقاط البصري للشاشة (Shutter Flash) */}
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
                {/* أركان الإطار لتحديد حدود العمل الفني بدقة */}
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

            {/* شريط التحكم السفلي: التقاط لايف إجباري 100% بدون أي زر لرفع ملفات */}
            <div style={{
              padding: "16px 20px",
              background: "rgba(0,0,0,0.92)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              {/* مصغرات الصور السابقة للمشروع متعدد الزوايا */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center", minWidth: "60px" }}>
                {capturedPhotos.map((p, idx) => (
                  <div key={idx} style={{ width: "38px", height: "38px", borderRadius: "6px", overflow: "hidden", border: "2px solid #10b981", position: "relative" }}>
                    <img src={p.url} alt="زاوية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>

              {/* زر الالتقاط الدائري الفوري - يستجيب دائماً مع وميض بصري وهزة خفيفة */}
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

              {/* مؤشر أمني إجباري يوضح أن النظام يفرض التصوير الحي المباشر فقط */}
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
                    padding: "12px",
                    background: "linear-gradient(135deg, #10b981, #059669)",
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

        {/* نافذة تكبير الصورة (Lightbox Modal) */}
        {previewModalImage && (
          <div 
            onClick={() => setPreviewModalImage(null)}
            style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.92)", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", cursor: "pointer" }}
          >
            <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
              <img src={previewModalImage} alt="عرض مكبر" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: "10px", objectFit: "contain" }} />
              <button 
                onClick={() => setPreviewModalImage(null)}
                className="btn-compact"
                style={{ position: "absolute", top: "-15px", right: "-15px", background: "#ef4444", color: "#fff", border: "none", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ملف الـ Input المخفي لبطاقة الرقم القومي وعنصر الـ canvas لفحص الجودة */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={idFileInputRef} 
          style={{ display: "none" }} 
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              const r = new FileReader();
              r.onload = (ev) => setIdCardPhoto(ev.target?.result as string);
              r.readAsDataURL(f);
            }
          }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <footer style={{ textAlign: "center", paddingTop: "24px", paddingBottom: "16px", color: "#64748b", fontSize: "11px" }}>
          جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
        </footer>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: شاشة تسجيل الدخول والتسجيل الجديد للطلاب (Auth Screen)
  // ==========================================
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px", maxWidth: "440px", margin: "0 auto", direction: "rtl" }}>
      
      <div>
        <header style={{ textAlign: "center", paddingTop: "15px", marginBottom: "16px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "56px", height: "56px", borderRadius: "16px", overflow: "hidden", marginBottom: "10px", boxShadow: "0 8px 20px rgba(37, 99, 235, 0.35)" }}>
            <img src="/icon-192.png" alt="فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginBottom: "3px" }}>
            بوابة فنية الذكية
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>
            تسجيل الحضور، متابعة التقييمات، ورفع الأعمال الفنية
          </p>
        </header>

        {/* مفتاح التبديل بين تسجيل الدخول والتسجيل الجديد */}
        <div style={{ display: "flex", background: "#141b29", padding: "4px", borderRadius: "12px", border: "1px solid #2a374f", marginBottom: "18px" }}>
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setErrorMsg(""); }}
            className="btn-compact"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: authMode === "login" ? "#2563eb" : "transparent",
              color: authMode === "login" ? "#fff" : "#94a3b8",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
              border: "none"
            }}
          >
            تسجيل الدخول (بالـ PIN) 🔐
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("register"); setErrorMsg(""); }}
            className="btn-compact"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: authMode === "register" ? "#2563eb" : "transparent",
              color: authMode === "register" ? "#fff" : "#94a3b8",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
              border: "none"
            }}
          >
            تسجيل طالب جديد 📝
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", borderRadius: "10px", marginBottom: "14px", fontSize: "12px" }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        {authMode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="glass-card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                كود الطالب الجامعي:
              </label>
              <input
                type="text"
                placeholder="أدخل كودك (مثل: 0001)..."
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                style={{ width: "100%", padding: "12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                الرقم السري (PIN):
              </label>
              <input
                type="password"
                maxLength={8}
                placeholder="••••••••"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                style={{ width: "100%", padding: "12px", textAlign: "center", letterSpacing: "4px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fbbf24", fontSize: "16px", fontWeight: "bold" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "جاري التحقق..." : "تسجيل الدخول 🚀"}
            </button>
          </form>
        ) : (
          /* نموذج تسجيل طالب جديد */
          <form onSubmit={handleRegisterSubmit} className="glass-card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                كود الطالب الجامعي:
              </label>
              <input
                type="text"
                placeholder="أدخل كودك الجامعي (مثل: 0001)..."
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                style={{ width: "100%", padding: "12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px" }}
              />
              {isLookingUpCode && (
                <div style={{ color: "#38bdf8", fontSize: "11px", marginTop: "4px" }}>جاري التحقق من الكود...</div>
              )}
              {matchedStudent && (
                <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "6px 10px", borderRadius: "8px", marginTop: "6px", fontSize: "12px" }}>
                  ✓ {matchedStudent.full_name} • {matchedStudent.academic_year} (سكشن {matchedStudent.section || 'عام'})
                </div>
              )}
              {lookupMessage && (
                <div style={{ color: "#f87171", fontSize: "11px", marginTop: "4px" }}>{lookupMessage}</div>
              )}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                الاسم الكامل:
              </label>
              <input
                type="text"
                placeholder="اسم الطالب الرباعي..."
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                style={{ width: "100%", padding: "12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                رقم الموبايل (واتساب):
              </label>
              <input
                type="tel"
                placeholder="01xxxxxxxxx"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value)}
                style={{ width: "100%", padding: "12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px", direction: "ltr", textAlign: "right" }}
              />
            </div>

            {/* تصوير بطاقة الهوية القومية */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                صورة بطاقة الرقم القومي (لتأكيد الهوية):
              </label>
              {idCardPhoto ? (
                <div style={{ position: "relative", height: "130px", borderRadius: "10px", overflow: "hidden", border: "2px solid #10b981", background: "#000" }}>
                  <img src={idCardPhoto} alt="البطاقة" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <button
                    type="button"
                    onClick={() => setIdCardPhoto(null)}
                    className="btn-compact"
                    style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(239, 68, 68, 0.8)", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                  >
                    تغيير الصورة
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => startCamera("id")}
                    style={{ flex: 1, padding: "10px", background: "#1e293b", color: "#38bdf8", border: "1px dashed #38bdf8", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Camera size={16} />
                    <span>فتح الكاميرا 📷</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => idFileInputRef.current?.click()}
                    style={{ flex: 1, padding: "10px", background: "#1e293b", color: "#94a3b8", border: "1px dashed #475569", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <FolderOpen size={16} />
                    <span>من الهاتف 📁</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !regCode || !regMobile}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #2563eb, #10b981)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "جاري التسجيل..." : "تسجيل بيانات الطالب 🚀"}
            </button>
          </form>
        )}
      </div>

      <footer style={{ textAlign: "center", paddingTop: "16px", color: "#64748b", fontSize: "11px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </footer>

      {/* نافذة كاميرا بطاقة الهوية */}
      {showIdCamera && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 99999, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px", background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#fff", fontSize: "13px", fontWeight: "bold" }}>تصوير بطاقة الرقم القومي</span>
            <button
              type="button"
              onClick={() => { stopCamera(); setShowIdCamera(false); }}
              className="btn-compact"
              style={{ background: "#ef4444", color: "#fff", border: "none", padding: "4px 8px", cursor: "pointer" }}
            >
              إلغاء ✕
            </button>
          </div>
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <video ref={setVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", width: "85%", height: "55%", border: "2px dashed #38bdf8", borderRadius: "12px", pointerEvents: "none" }} />
          </div>
          <div style={{ padding: "16px", background: "#000", textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                const photo = captureVideoFrame();
                if (photo) {
                  setIdCardPhoto(photo);
                  stopCamera();
                  setShowIdCamera(false);
                }
              }}
              style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#fff", border: "4px solid #38bdf8", cursor: "pointer", margin: "0 auto" }}
            />
          </div>
        </div>
      )}

      {/* عناصر input و canvas مخفية للكاميرا */}
      <input type="file" accept="image/*" capture="environment" ref={idFileInputRef} style={{ display: "none" }} onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) {
          const r = new FileReader();
          r.onload = (ev) => setIdCardPhoto(ev.target?.result as string);
          r.readAsDataURL(f);
        }
      }} />
    </div>
  );
}
