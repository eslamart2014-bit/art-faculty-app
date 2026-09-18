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
  X,
  Smartphone
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
  const [activeTab, setActiveTab] = useState<"attendance" | "evaluation" | "warnings" | "complaints">("attendance");
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Project Submission & Camera State
  const [selectedCourseForEval, setSelectedCourseForEval] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectPhotos, setProjectPhotos] = useState<any[]>([]);
  const [showArtworkCamera, setShowArtworkCamera] = useState(false);
  const [cameraOrientationRequired, setCameraOrientationRequired] = useState<"portrait" | "landscape">("portrait");
  const [lightingWarning, setLightingWarning] = useState(false);
  const [uploadingProject, setUploadingProject] = useState(false);

  // Complaint Form
  const [complaintTarget, setComplaintTarget] = useState("أستاذ المقرر");
  const [complaintText, setComplaintText] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Camera video elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Initial Load: Check cached session & fetch coordinators
  useEffect(() => {
    fetchCoordinators();

    const cachedStudent = localStorage.getItem("fania_student_session");
    const cachedStatus = localStorage.getItem("fania_account_status");

    if (cachedStudent) {
      try {
        const parsed = JSON.parse(cachedStudent);
        setCurrentStudent(parsed);
        setAccountStatus((cachedStatus as any) || "active");
        if (cachedStatus === "active") {
          loadDashboard(parsed.student_code, parsed.pin_code);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // مراقبة كتابة الكود والبحث التلقائي في كشوف الكلية
  useEffect(() => {
    const trimmed = regCode.trim();
    if (!trimmed) {
      setMatchedStudent(null);
      setLookupMessage(null);
      setRegName("");
      return;
    }

    const timer = setTimeout(async () => {
      setIsLookingUpCode(true);
      setLookupMessage(null);
      try {
        const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success && data.student) {
          setMatchedStudent(data.student);
          setRegName(data.student.full_name);
          if (data.isAlreadyActive) {
            setLookupMessage("⚠️ هذا الحساب مسجل ومفعل بالفعل! يرجى الضغط على 'تسجيل الدخول' أعلاه.");
          } else if (data.isPending) {
            setLookupMessage("ℹ️ بياناتك مسجلة مسبقاً وبانتظار تفعيل الرقم السري من المنسق.");
          } else {
            setLookupMessage(null);
          }
        } else {
          setMatchedStudent(null);
          setRegName("");
          setLookupMessage(data.message || "كود الطالب غير موجود في كشوف الكلية");
        }
      } catch (err) {
        setMatchedStudent(null);
      } finally {
        setIsLookingUpCode(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [regCode]);

  const fetchCoordinators = async () => {
    try {
      const res = await fetch("/api/coordinators");
      const data = await res.json();
      if (data.coordinators) setCoordinators(data.coordinators);
    } catch (e) {}
  };

  const loadDashboard = async (code: string, pin?: string) => {
    try {
      const activePin = pin || currentStudent?.pin_code || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("fania_student_session") || '{}')?.pin_code : '');
      const pinParam = activePin ? `&pin=${encodeURIComponent(activePin)}` : '';
      const res = await fetch(`/api/students/dashboard-data?code=${encodeURIComponent(code)}${pinParam}`);
      const data = await res.json();
      if (data.student) {
        setDashboardData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 2. Camera Management for ID & Artwork
  const startCamera = async (type: "id" | "artwork") => {
    setErrorMsg("");
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      if (type === "id") setShowIdCamera(true);
      else setShowArtworkCamera(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      alert("تعذر فتح الكاميرا، يرجى السماح بالوصول إلى الكاميرا من إعدادات المتصفح.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowIdCamera(false);
    setShowArtworkCamera(false);
    setLightingWarning(false);
    setTorchOn(false);
    setTempIdCardPreview(null);
  };

  const toggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
        if (capabilities && capabilities.torch) {
          try {
            const next = !torchOn;
            await (track as any).applyConstraints({ advanced: [{ torch: next }] });
            setTorchOn(next);
          } catch (e) {
            console.error("Torch error:", e);
          }
        } else {
          alert("فلاش الكاميرا غير مدعوم على هذا الجهاز أو المتصفح");
        }
      }
    }
  };

  // التقاط صورة بطاقة الرقم القومي
  const captureIdCard = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.85);

    // ضغط فوري إلى WebP خفيف جداً
    const compressed = await compressImageToWebP(rawDataUrl, 1000, 0.75);
    setTempIdCardPreview(compressed.dataUrl);
  };

  const confirmIdCardPhoto = () => {
    if (tempIdCardPreview) {
      setIdCardPhoto(tempIdCardPreview);
      setTempIdCardPreview(null);
      stopCamera();
    }
  };

  const retakeIdCardPhoto = () => {
    setTempIdCardPreview(null);
  };

  // التقاط صورة العمل الفني للمشروع
  const captureArtworkPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    // التحقق من اتجاه الكاميرا (رأسي أو أفقي فقط وفق المقرر)
    const isPortrait = height > width;
    if (cameraOrientationRequired === "portrait" && !isPortrait) {
      alert("تنبيه: يجب تدوير الهاتف لالتقاط الصورة بالوضع الرأسي (Portrait) وفق تعليمات هذا المشروع!");
      return;
    }
    if (cameraOrientationRequired === "landscape" && isPortrait) {
      alert("تنبيه: يجب تدوير الهاتف لالتقاط الصورة بالوضع الأفقي (Landscape) وفق تعليمات هذا المشروع!");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.9);

    // ضغط فوري وفحص الإضاءة وحساب البصمة الرقمية
    const compressed = await compressImageToWebP(rawDataUrl, 1400, 0.78);

    if (!compressed.isGoodLighting) {
      setLightingWarning(true);
      const proceed = confirm("الإضاءة تبدو ضعيفة أو معتمة في هذا المكان! هل ترغب في المتابعة بهذا الوضع أم تفضل تشغيل إضاءة واضحة وإعادة المحاولة؟");
      if (!proceed) return;
    }

    setProjectPhotos(prev => [
      ...prev,
      {
        dataUrl: compressed.dataUrl,
        dhash: compressed.dhash,
        width: compressed.width,
        height: compressed.height,
        orientation: isPortrait ? "portrait" : "landscape",
        timestamp: new Date().toISOString()
      }
    ]);

    stopCamera();
  };

  // 3. New Registration Submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!regCode || !regMobile) {
      setErrorMsg("يرجى إدخال الكود ورقم الموبايل");
      return;
    }

    if (!matchedStudent) {
      setErrorMsg("يرجى التأكد من كتابة كود طالب صحيح ومسجل في كشوف الكلية");
      return;
    }

    if (!idCardPhoto) {
      setErrorMsg("يجب تصوير وجه بطاقة الهوية / الرقم القومي بوضوح للاستمرار");
      return;
    }

    setLoading(true);
    const deviceInfo = getOrCreateDeviceInfo();

    try {
      const res = await fetch("/api/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: matchedStudent.student_code,
          full_name: matchedStudent.full_name,
          mobile: regMobile,
          id_card_image: idCardPhoto,
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "حدث خطأ أثناء التسجيل");
        setLoading(false);
        return;
      }

      // حفظ الجلسة المبدئية على الهاتف
      localStorage.setItem("fania_student_session", JSON.stringify(data.student));
      localStorage.setItem("fania_account_status", "pending");
      setCurrentStudent(data.student);
      setAccountStatus("pending");
      setSuccessMsg(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  // 4. Normal Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!regCode || !enteredPin) {
      setErrorMsg("يرجى إدخال الكود الجامعي والرقم السري");
      return;
    }

    setLoading(true);
    const deviceInfo = getOrCreateDeviceInfo();

    try {
      const res = await fetch("/api/students/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: regCode,
          pin_code: enteredPin,
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "بيانات الدخول غير صحيحة");
        setLoading(false);
        return;
      }

      // حفظ الحساب المفعل بالكامل
      localStorage.setItem("fania_student_session", JSON.stringify(data.student));
      localStorage.setItem("fania_account_status", "active");
      setCurrentStudent(data.student);
      setAccountStatus("active");
      loadDashboard(data.student.student_code, data.student.pin_code);
    } catch (err: any) {
      setErrorMsg(err.message || "خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  };

  // 5. Complete PIN Verification
  const handleVerifyPinSubmit = async () => {
    if (!enteredPin || !currentStudent) {
      setErrorMsg("يرجى كتابة الرقم السري المكون من 8 خانات");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    const deviceInfo = getOrCreateDeviceInfo();

    try {
      const res = await fetch("/api/students/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: currentStudent.student_code,
          pin_code: enteredPin,
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "الرقم السري غير مطابق");
        setLoading(false);
        return;
      }

      localStorage.setItem("fania_account_status", "active");
      setAccountStatus("active");
      alert(data.message);
      loadDashboard(currentStudent.student_code, enteredPin);
    } catch (err: any) {
      setErrorMsg(err.message || "خطأ في التحقق");
    } finally {
      setLoading(false);
    }
  };

  // 6. Submit Artwork Project
  const handleUploadArtwork = async () => {
    if (!selectedCourseForEval || !selectedProject || projectPhotos.length === 0) {
      alert("يرجى التقاط صورة العمل الفني أولاً!");
      return;
    }

    const confirmUpload = confirm("هل أنت متأكد من رغبتك في رفع هذه الصور للتقييم؟ لن تتمكن من تعديلها أو تصوير صور أخرى إلا بإذن أستاذ المقرر.");
    if (!confirmUpload) return;

    setUploadingProject(true);
    const deviceInfo = getOrCreateDeviceInfo();

    try {
      const res = await fetch("/api/students/submit-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: currentStudent.student_code,
          student_name: currentStudent.full_name,
          course_id: selectedCourseForEval.courseId,
          course_name: selectedCourseForEval.courseName,
          project_name: selectedProject,
          images: projectPhotos,
          device_info: deviceInfo,
          pin_code: currentStudent?.pin_code || enteredPin || '',
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "تعذر رفع العمل");
        setUploadingProject(false);
        return;
      }

      alert(data.message);
      setProjectPhotos([]);
      loadDashboard(currentStudent.student_code, currentStudent?.pin_code || enteredPin);
    } catch (e: any) {
      alert("خطأ أثناء الرفع: " + e.message);
    } finally {
      setUploadingProject(false);
    }
  };

  // 7. Submit Complaint
  const handleSendComplaint = async (e: React.FormEvent) => {
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
          content: complaintText
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert("تم إرسال شكواك بنجاح وسيتم النظر فيها قريباً.");
        setComplaintText("");
        loadDashboard(currentStudent.student_code, currentStudent?.pin_code || enteredPin);
      } else {
        alert(data.error || "تعذر إرسال الشكوى");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingComplaint(false);
    }
  };

  // تسجيل الخروج
  const handleLogout = () => {
    localStorage.removeItem("fania_student_session");
    localStorage.removeItem("fania_account_status");
    setCurrentStudent(null);
    setAccountStatus(null);
    setDashboardData(null);
  };

  // ==========================================
  // VIEW 1: شاشة الحساب المبدئي (بانتظار الرقم السري من المنسق)
  // ==========================================
  if (currentStudent && accountStatus === "pending") {
    return (
      <div style={{ minHeight: "100vh", padding: "18px", maxWidth: "480px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        
        {/* شريط أعلى به اسم الطالب وزر خروج */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#141b29", borderRadius: "14px", border: "1px solid #2a374f", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
              <UserCheck size={20} />
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>{currentStudent.full_name}</div>
              <div style={{ color: "#94a3b8", fontSize: "11px" }}>كود: {formatStudentCode(currentStudent.student_code)}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>
            <LogOut size={14} />
            <span>خروج</span>
          </button>
        </div>

        {/* الرسالة الإجبارية والتعليمات */}
        <div className="glass-card animate-fade-in" style={{ padding: "24px 18px", textAlign: "center", marginBottom: "20px" }}>
          
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", marginBottom: "16px" }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff", marginBottom: "12px", lineHeight: "1.5" }}>
            يجب عليك إدخال الرقم السري أدناه للاستمرار داخل المنظومة
          </h2>

          <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.7", marginBottom: "18px" }}>
            لكي تستطيع عرض سجل حضورك في السكاشن والمحاضرات ورفع أعمالك ومشاريعك الفنية للتقييم، يجب تأكيد هويتك بواسطة أحد منسقي النظام المعتمدين.
          </p>

          {/* بوكس تعليمات المنسقين */}
          <div style={{ background: "rgba(37, 99, 235, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "14px", padding: "16px", textAlign: "right", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontWeight: "bold", fontSize: "13px", marginBottom: "8px" }}>
              <Sparkles size={16} />
              <span>تعليمات الحصول على الرقم السري:</span>
            </div>
            <p style={{ color: "#e2e8f0", fontSize: "13px", lineHeight: "1.7", margin: 0 }}>
              توجه ببطاقة الـ QR Code الخاصة بك لأحد منسقي نظام فنية المعتمدين لمطابقة بطاقة هويتك والحصول على رقمك السري، وهم:
            </p>
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {coordinators.map((c: any) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "6px", color: "#34d399", fontSize: "13px", fontWeight: "bold" }}>
                  <span>✓</span>
                  <span>{c.name}</span>
                  <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: "normal" }}>({c.title || "منسق"})</span>
                </div>
              ))}
            </div>
          </div>

          {/* خانة إدخال الرقم السري وإتمام التسجيل */}
          <div style={{ textAlign: "right", marginBottom: "12px" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", fontWeight: "bold", marginBottom: "8px" }}>
              أدخل الرقم السري المكون من 8 خانات:
            </label>
            <input 
              type="text" 
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              placeholder="مثال: X7#k9@B2"
              style={{ textAlign: "center", letterSpacing: "3px", fontSize: "20px", fontWeight: "bold", fontFamily: "monospace" }}
            />
          </div>

          {errorMsg && (
            <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px" }}>
              {errorMsg}
            </div>
          )}

          <button 
            onClick={handleVerifyPinSubmit}
            disabled={loading}
            className="btn-primary"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)", fontSize: "16px", padding: "16px" }}
          >
            {loading ? "جاري التحقق..." : "إتمام التسجيل وتفعيل الحساب"}
          </button>

        </div>

        <div style={{ textAlign: "center", color: "#64748b", fontSize: "11px" }}>
          بوابة طلاب فنية • نظام التربية الفنية الجديد
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: لوحة تحكم الطالب الكاملة (بعد التفعيل)
  // ==========================================
  if (currentStudent && accountStatus === "active") {
    return (
      <div style={{ minHeight: "100vh", padding: "16px", maxWidth: "520px", margin: "0 auto" }}>
        
        {/* هيدر الطالب */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "#141b29", borderRadius: "16px", border: "1px solid #2a374f", marginBottom: "18px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #2563eb, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", fontSize: "18px" }}>
              {currentStudent.full_name.charAt(0)}
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>{currentStudent.full_name}</div>
              <div style={{ color: "#38bdf8", fontSize: "12px", display: "flex", gap: "6px" }}>
                <span>كود: {formatStudentCode(currentStudent.student_code)}</span>
                <span>•</span>
                <span>{currentStudent.academic_year}</span>
              </div>
            </div>
          </div>

          <button onClick={handleLogout} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "12px" }}>
            <LogOut size={15} />
            <span>خروج</span>
          </button>
        </div>

        {/* أزرار التنقل الرئيسية الأربعة */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
          
          <button 
            onClick={() => setActiveTab("attendance")}
            style={{ 
              padding: "14px 10px", 
              borderRadius: "14px", 
              border: activeTab === "attendance" ? "2px solid #3b82f6" : "1px solid #2a374f", 
              background: activeTab === "attendance" ? "rgba(37, 99, 235, 0.2)" : "#141b29", 
              color: activeTab === "attendance" ? "#60a5fa" : "#94a3b8",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <CalendarCheck size={18} />
            <span>سجل الحضور</span>
          </button>

          <button 
            onClick={() => setActiveTab("evaluation")}
            style={{ 
              padding: "14px 10px", 
              borderRadius: "14px", 
              border: activeTab === "evaluation" ? "2px solid #10b981" : "1px solid #2a374f", 
              background: activeTab === "evaluation" ? "rgba(16, 185, 129, 0.2)" : "#141b29", 
              color: activeTab === "evaluation" ? "#34d399" : "#94a3b8",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <Award size={18} />
            <span>التقييم والمشاريع</span>
          </button>

          <button 
            onClick={() => setActiveTab("warnings")}
            style={{ 
              padding: "14px 10px", 
              borderRadius: "14px", 
              border: activeTab === "warnings" ? "2px solid #f59e0b" : "1px solid #2a374f", 
              background: activeTab === "warnings" ? "rgba(245, 158, 11, 0.2)" : "#141b29", 
              color: activeTab === "warnings" ? "#fbbf24" : "#94a3b8",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <AlertTriangle size={18} />
            <span>إنذارات الحضور</span>
          </button>

          <button 
            onClick={() => setActiveTab("complaints")}
            style={{ 
              padding: "14px 10px", 
              borderRadius: "14px", 
              border: activeTab === "complaints" ? "2px solid #ec4899" : "1px solid #2a374f", 
              background: activeTab === "complaints" ? "rgba(236, 72, 153, 0.2)" : "#141b29", 
              color: activeTab === "complaints" ? "#f472b6" : "#94a3b8",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <MessageSquare size={18} />
            <span>الشكاوى والمقترحات</span>
          </button>

        </div>

        {/* 1. تبويب سجل الحضور والغياب */}
        {activeTab === "attendance" && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "16px", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarCheck size={18} color="#3b82f6" />
              <span>سجل الحضور لجميع المقررات:</span>
            </h3>

            {dashboardData?.attendance?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {dashboardData.attendance.map((c: any) => (
                  <div key={c.courseId} className="glass-card" style={{ padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>{c.courseName}</span>
                      <span style={{ 
                        fontSize: "12px", 
                        padding: "3px 10px", 
                        borderRadius: "12px", 
                        fontWeight: "bold",
                        background: c.rate >= 75 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: c.rate >= 75 ? "#34d399" : "#f87171"
                      }}>
                        نسبة الالتزام: {c.rate}%
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center", background: "#0d131f", padding: "10px", borderRadius: "10px" }}>
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: "11px" }}>حاضر</div>
                        <div style={{ color: "#10b981", fontWeight: "bold", fontSize: "16px" }}>{c.attended}</div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: "11px" }}>غائب</div>
                        <div style={{ color: "#ef4444", fontWeight: "bold", fontSize: "16px" }}>{c.absent}</div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: "11px" }}>إذن/عذر</div>
                        <div style={{ color: "#f59e0b", fontWeight: "bold", fontSize: "16px" }}>{c.excused}</div>
                      </div>
                    </div>

                    {c.records?.length > 0 && (
                      <div style={{ marginTop: "10px", borderTop: "1px solid #1a2336", paddingTop: "8px" }}>
                        <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>تواريخ المحاضرات المسجلة:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {c.records.map((r: any, idx: number) => (
                            <span key={idx} style={{ 
                              fontSize: "11px", 
                              padding: "2px 8px", 
                              borderRadius: "6px", 
                              background: r.status === "حاضر" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              color: r.status === "حاضر" ? "#34d399" : "#f87171"
                            }}>
                              {r.date} ({r.status})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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

        {/* 2. تبويب التقييم والمشاريع ورفع اللوحات */}
        {activeTab === "evaluation" && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "16px", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Award size={18} color="#10b981" />
              <span>المقررات والمشاريع العملية:</span>
            </h3>

            {dashboardData?.projects?.map((courseObj: any) => (
              <div key={courseObj.courseId} className="glass-card" style={{ padding: "16px", marginBottom: "14px" }}>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "16px", marginBottom: "12px", borderBottom: "1px solid #1e293b", paddingBottom: "8px" }}>
                  {courseObj.courseName}
                </div>

                {/* استعراض المشاريع أو المهام */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* مشاريع مسجلة مسبقاً */}
                  {courseObj.submissions?.map((sub: any) => (
                    <div key={sub.id} style={{ background: "#0d131f", padding: "12px", borderRadius: "10px", border: "1px solid #2a374f" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ color: "#e2e8f0", fontWeight: "bold", fontSize: "14px" }}>{sub.project_name}</span>
                        <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "8px", background: sub.score !== null ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)", color: sub.score !== null ? "#34d399" : "#fbbf24", fontWeight: "bold" }}>
                          {sub.score !== null ? `الدرجة: ${sub.score}` : "في انتظار التقييم"}
                        </span>
                      </div>

                      {/* معرض صور العمل المرفوع */}
                      <div style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "6px 0" }}>
                        {sub.images?.map((img: any, i: number) => (
                          <div key={i} style={{ width: "80px", height: "80px", borderRadius: "8px", overflow: "hidden", border: "1px solid #334155", flexShrink: 0 }}>
                            <img src={img.url} alt="عمل فني" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ))}
                      </div>

                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                        تاريخ الرفع: {new Date(sub.created_at).toLocaleDateString("ar-EG")} • يمكنك العودة لاحقاً لمتابعة رصد الدرجة
                      </div>
                    </div>
                  ))}

                  {/* زر رفع مشروع جديد */}
                  <div style={{ marginTop: "6px" }}>
                    <button 
                      onClick={() => {
                        const pName = prompt("أدخل اسم المشروع أو العمل الفني الذي ترغب في تصويره ورفعه:");
                        if (pName && pName.trim()) {
                          setSelectedCourseForEval(courseObj);
                          setSelectedProject(pName.trim());
                          setProjectPhotos([]);
                          startCamera("artwork");
                        }
                      }}
                      className="btn-primary"
                      style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)", fontSize: "13px", padding: "10px" }}
                    >
                      <Camera size={16} />
                      <span>تصوير ورفع مشروع جديد لهذا المقرر</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. تبويب إنذارات الحضور */}
        {activeTab === "warnings" && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "16px", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={18} color="#f59e0b" />
              <span>إنذارات الغياب الرسمية:</span>
            </h3>

            {dashboardData?.warnings?.length > 0 ? (
              dashboardData.warnings.map((w: any) => (
                <div key={w.courseId} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f87171", fontWeight: "bold", fontSize: "15px", marginBottom: "6px" }}>
                    <AlertTriangle size={20} />
                    <span>إنذار غياب رسمي - {w.courseName}</span>
                  </div>
                  <p style={{ color: "#fca5a5", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                    تنبيه: لقد تجاوزت عدد مرات الغياب المسموح بها في هذا المقرر (غياب {w.absent} مرات، بنسبة التزام {w.rate}%). يرجى مراجعة أستاذ المقرر فوراً لتجنب الحرمان من دخول الامتحان العملي.
                  </p>
                </div>
              ))
            ) : (
              <div className="glass-card" style={{ padding: "26px", textAlign: "center" }}>
                <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#10b981", marginBottom: "10px" }}>
                  <CheckCircle2 size={28} />
                </div>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}>
                  سجلك الأكاديمي ممتاز!
                </div>
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                  لا توجد أي إنذارات غياب مسجلة بحقك في أي مقرر.
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. تبويب الشكاوى والمقترحات */}
        {activeTab === "complaints" && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "16px", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={18} color="#ec4899" />
              <span>صندوق الشكاوى والمقترحات:</span>
            </h3>

            {/* فورم إرسال شكوى */}
            <form onSubmit={handleSendComplaint} className="glass-card" style={{ padding: "18px", marginBottom: "18px" }}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                  الجهة المقدم إليها الشكوى:
                </label>
                <select value={complaintTarget} onChange={(e) => setComplaintTarget(e.target.value)}>
                  <option value="أستاذ المقرر">أستاذ المقرر</option>
                  <option value="رئيس القسم">رئيس القسم</option>
                  <option value="إدارة الكلية">إدارة الكلية</option>
                </select>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                  نص الشكوى أو المقترح:
                </label>
                <textarea 
                  rows={3}
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  placeholder="اكتب تفاصيل الشكوى أو المقترح بوضوح..."
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={submittingComplaint}
                className="btn-primary"
                style={{ background: "linear-gradient(135deg, #ec4899, #be185d)" }}
              >
                {submittingComplaint ? "جاري الإرسال..." : "إرسال الشكوى"}
              </button>
            </form>

            {/* سجل الشكاوى السابقة */}
            {dashboardData?.complaints?.length > 0 && (
              <div>
                <h4 style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "8px" }}>سجل الشكاوى المرسلة:</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {dashboardData.complaints.map((comp: any) => (
                    <div key={comp.id} style={{ background: "#0d131f", border: "1px solid #2a374f", padding: "12px", borderRadius: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "12px" }}>إلى: {comp.target_entity}</span>
                        <span style={{ color: "#f59e0b", fontSize: "11px" }}>{comp.status}</span>
                      </div>
                      <div style={{ color: "#e2e8f0", fontSize: "13px", marginBottom: "6px" }}>{comp.content}</div>
                      {comp.reply && (
                        <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "8px", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#34d399", fontSize: "12px" }}>
                          <b>رد الإدارة:</b> {comp.reply}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* نافذة كاميرا تصوير المشروع الإجبارية */}
        {showArtworkCamera && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px" }}>
            
            {/* بار تحكم علوي */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>
                تصوير عمل: {selectedProject}
              </div>
              <button onClick={stopCamera} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "18px" }}>
                ✕
              </button>
            </div>

            {/* شاشة الفيديو */}
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "14px 0", borderRadius: "16px", border: "2px solid #38bdf8" }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              
              {/* إطار دليلي للكاميرا */}
              <div style={{ position: "absolute", inset: "20px", border: "2px dashed rgba(255,255,255,0.5)", borderRadius: "12px", pointerEvents: "none" }} />
            </div>

            {/* بار التقاط سفلي */}
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "12px" }}>
                تأكد من وضوح الإضاءة واكتمال حدود اللوحة داخل الإطار
              </div>
              <button 
                onClick={captureArtworkPhoto}
                style={{ width: "70px", height: "70px", borderRadius: "50%", background: "#fff", border: "5px solid #2563eb", cursor: "pointer", outline: "none" }}
              />
            </div>

          </div>
        )}

        {/* استعراض الصور الملتقطة قبل الرفع النهائي */}
        {projectPhotos.length > 0 && !showArtworkCamera && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(10, 14, 23, 0.95)", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
              <h3 style={{ color: "#fff", marginBottom: "12px" }}>معاينة العمل الفني قبل الرفع:</h3>
              
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "16px" }}>
                {projectPhotos.map((p, idx) => (
                  <div key={idx} style={{ width: "120px", height: "120px", borderRadius: "12px", overflow: "hidden", border: "2px solid #38bdf8" }}>
                    <img src={p.dataUrl} alt="معاينة" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>

              <div style={{ color: "#f59e0b", fontSize: "12px", marginBottom: "16px" }}>
                ⚠️ تنبيه: بمجرد الضغط على رفع لن تتمكن من حذف الصور أو تصوير غيرها إلا بإذن دكتور المقرر.
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  onClick={handleUploadArtwork}
                  disabled={uploadingProject}
                  className="btn-primary"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)", flex: 2 }}
                >
                  <UploadCloud size={18} />
                  <span>{uploadingProject ? "جاري الرفع السحابي..." : "تأكيد ورفع العمل للتقييم"}</span>
                </button>

                <button 
                  onClick={() => setProjectPhotos([])}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ==========================================
  // VIEW 3: شاشة الدخول والتسجيل الأولى (اختيار تسجيل جديد / دخول)
  // ==========================================
  return (
    <div style={{ minHeight: "100vh", padding: "16px", maxWidth: "440px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      
      <div>
        {/* زر العودة للصفحة الرئيسية */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
            <ChevronLeft size={16} />
            <span>العودة لبوابة فنية</span>
          </Link>
          <span style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "bold" }}>نظام فنية التفاعلي</span>
        </div>

        {/* سويتش بين تسجيل جديد ودخول */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "#141b29", padding: "6px", borderRadius: "14px", border: "1px solid #2a374f", marginBottom: "18px" }}>
          <button 
            onClick={() => { setAuthMode("login"); setErrorMsg(""); }}
            style={{ 
              padding: "10px", 
              borderRadius: "10px", 
              border: "none", 
              background: authMode === "login" ? "#2563eb" : "transparent", 
              color: "#fff", 
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            تسجيل الدخول
          </button>
          <button 
            onClick={() => { setAuthMode("register"); setErrorMsg(""); }}
            style={{ 
              padding: "10px", 
              borderRadius: "10px", 
              border: "none", 
              background: authMode === "register" ? "#2563eb" : "transparent", 
              color: "#fff", 
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            تسجيل دخول جديد
          </button>
        </div>

        {/* نموذج تسجيل جديد */}
        {authMode === "register" ? (
          <form onSubmit={handleRegisterSubmit} className="glass-card animate-fade-in" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "17px", color: "#fff", fontWeight: "bold", marginBottom: "14px", textAlign: "center" }}>
              تسجيل حساب طالب جديد
            </h2>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                الكود الجامعي:
              </label>
              <input 
                type="text"
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                placeholder="أدخل كودك (مثال: 0001 أو 159)"
                required
              />
            </div>

            {/* حالة البحث وظهور اسم الطالب تلقائياً من الكشوف */}
            {isLookingUpCode && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px", color: "#38bdf8", fontSize: "12px" }}>
                <div style={{ width: "14px", height: "14px", border: "2px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span>جاري مطابقة الكود مع كشوف الكلية...</span>
              </div>
            )}

            {matchedStudent && (
              <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.35)", borderRadius: "12px", padding: "12px 14px", marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={13} />
                    <span>تم التحقق من الطالب</span>
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                    كود: {formatStudentCode(matchedStudent.student_code)}
                  </span>
                </div>
                <div style={{ color: "#ffffff", fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}>
                  {matchedStudent.full_name}
                </div>
                <div style={{ color: "#38bdf8", fontSize: "12px" }}>
                  الفرقة: {matchedStudent.academic_year} • السكشن: {matchedStudent.section || "1"}
                </div>
              </div>
            )}

            {lookupMessage && !matchedStudent && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px", color: "#f87171", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <ShieldAlert size={16} />
                <span>{lookupMessage}</span>
              </div>
            )}

            {lookupMessage && matchedStudent && (
              <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px", color: "#f59e0b", fontSize: "12px" }}>
                <div style={{ marginBottom: "8px" }}>{lookupMessage}</div>
                <button
                  type="button"
                  onClick={() => { setAuthMode("login"); }}
                  style={{ background: "#2563eb", border: "none", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
                >
                  الانتقال لتسجيل الدخول
                </button>
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                رقم الموبايل:
              </label>
              <input 
                type="tel"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value)}
                placeholder="010xxxxxxxx"
                required
              />
            </div>

            {/* خانة تصوير وجه البطاقة */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                صورة بطاقة الهوية / الرقم القومي:
              </label>

              {idCardPhoto ? (
                <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", border: "2px solid #10b981", height: "130px" }}>
                  <img src={idCardPhoto} alt="بطاقة الهوية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button 
                    type="button"
                    onClick={() => startCamera("id")}
                    style={{ position: "absolute", bottom: "8px", right: "8px", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
                  >
                    إعادة التقاط
                  </button>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => startCamera("id")}
                  style={{ width: "100%", padding: "18px", background: "#1a2336", border: "2px dashed #3b82f6", borderRadius: "12px", color: "#38bdf8", fontWeight: "bold", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer" }}
                >
                  <Camera size={26} />
                  <span>فتح الكاميرا لتصوير وجه البطاقة</span>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "normal" }}>تأكد من وضوح الصورة وتطابق الاسم مع الكود</span>
                </button>
              )}
            </div>

            {errorMsg && (
              <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                {errorMsg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "جاري التسجيل..." : "تسجيل الدخول ومتابعة التفعيل"}
            </button>
          </form>
        ) : (
          /* نموذج تسجيل الدخول العادي بالرقم السري */
          <form onSubmit={handleLoginSubmit} className="glass-card animate-fade-in" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "17px", color: "#fff", fontWeight: "bold", marginBottom: "14px", textAlign: "center" }}>
              تسجيل الدخول إلى المنظومة
            </h2>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                الكود الجامعي:
              </label>
              <input 
                type="text"
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                placeholder="مثال: 0001"
                required
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                الرقم السري (PIN):
              </label>
              <input 
                type="password"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder="أدخل الرقم السري الممنوح من المنسق"
                style={{ textAlign: "center", letterSpacing: "2px", fontWeight: "bold" }}
                required
              />
            </div>

            {errorMsg && (
              <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                {errorMsg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "جاري الدخول..." : "دخول"}
            </button>
          </form>
        )}

      </div>

      {/* كاميرا تصوير بطاقة الهوية */}
      {showIdCamera && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#fff", fontWeight: "bold" }}>
              {tempIdCardPreview ? "مراجعة وتأكيد صورة البطاقة" : "تصوير وجه بطاقة الرقم القومي"}
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {!tempIdCardPreview && (
                <button 
                  type="button" 
                  onClick={toggleTorch} 
                  style={{ background: torchOn ? "#eab308" : "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "6px 12px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <span>{torchOn ? "🔦 الفلاش مفعّل" : "💡 تشغيل الفلاش"}</span>
                </button>
              )}
              <button onClick={stopCamera} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "18px" }}>✕</button>
            </div>
          </div>

          {tempIdCardPreview ? (
            /* شاشة معاينة الصورة للتأكيد قبل الاعتماد */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", margin: "14px 0" }}>
              <div style={{ position: "relative", width: "100%", maxHeight: "65vh", borderRadius: "16px", overflow: "hidden", border: "3px solid #10b981", background: "#111" }}>
                <img src={tempIdCardPreview} alt="معاينة البطاقة" style={{ width: "100%", height: "100%", maxHeight: "65vh", objectFit: "contain", display: "block" }} />
              </div>
              <div style={{ color: "#fbbf24", fontSize: "13px", marginTop: "12px", textAlign: "center" }}>
                🔍 تأكد من وضوح الصورة وظهور كافة البيانات والرقم القومي بوضوح تام قبل التأكيد.
              </div>
            </div>
          ) : (
            /* الكاميرا الحية */
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "14px 0", borderRadius: "16px", border: "2px solid #38bdf8" }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", width: "85%", height: "60%", border: "2px dashed #10b981", borderRadius: "14px", pointerEvents: "none" }} />
            </div>
          )}

          {tempIdCardPreview ? (
            /* أزرار التأكيد أو إعادة الالتقاط */
            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
              <button
                type="button"
                onClick={retakeIdCardPhoto}
                style={{ flex: 1, padding: "14px", background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#fca5a5", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
              >
                🔄 إعادة التقاط
              </button>
              <button
                type="button"
                onClick={confirmIdCardPhoto}
                style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "#fff", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
              >
                ✓ اعتماد واستخدام الصورة
              </button>
            </div>
          ) : (
            /* زر التقاط الصورة */
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "10px" }}>
                ضع البطاقة داخل الإطار الأخضر وتأكد من وضوح الصورة والبيانات
              </div>
              <button 
                type="button"
                onClick={captureIdCard}
                style={{ width: "66px", height: "66px", borderRadius: "50%", background: "#fff", border: "4px solid #10b981", cursor: "pointer" }}
              />
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: "center", color: "#64748b", fontSize: "11px", marginTop: "20px" }}>
        نظام فنية الجديد • مطور المنظومة: د/ إسلام عبد اللطيف حسن
      </div>

    </div>
  );
}
