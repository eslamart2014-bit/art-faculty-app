"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/core/supabase";
import QRCode from "react-qr-code";
import { 
  Eye, 
  EyeOff, 
  Search, 
  Download, 
  GraduationCap, 
  ArrowRight,
  LogIn,
  Smartphone,
  BookUser,
  Info,
  QrCode,
  KeyRound,
  UserPlus,
  RefreshCw,
  Lightbulb
} from "lucide-react";
import { formatStudentCode } from "@/lib/students/codeHelper";
import { getOrCreateDeviceInfo, isAndroidAppClient, isInstalledPWA } from "@/lib/auth/deviceFingerprint";
import { normalizeAcademicDegree } from "@/lib/courses/academicHelper";

const LEVELS = [
  "الكل",
  "الفرقة الأولى",
  "الفرقة الثانية",
  "الفرقة الثالثة",
  "الفرقة الرابعة"
];

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    setAppVersion(localStorage.getItem('appVersion') || "4.0.1");
  }, []);

  // Main role mode switcher: Student vs Faculty (Students first)
  const [roleMode, setRoleMode] = useState<"student" | "faculty">("student");
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const [isPwaClient, setIsPwaClient] = useState(false);

  useEffect(() => {
    const isApp = isAndroidAppClient();
    const isPWA = isInstalledPWA();
    const isFaculty = Boolean(localStorage.getItem('cached_profile'));

    if (isPWA) {
      setIsPwaClient(true);
      // إذا كان يفتح من اختصار PWA المثبت وليس دكتور: التوجيه فوراً لشاشة ترقية الأندرويد
      if (!isApp && !isFaculty) {
        let savedCode = localStorage.getItem("fania_student_code") || "";
        try {
          const s = localStorage.getItem("fania_student_session");
          if (s) {
            const parsed = JSON.parse(s);
            if (parsed?.student_code) savedCode = parsed.student_code;
          }
        } catch (e) {}
        window.location.replace(`/student-portal/update-notice${savedCode ? `?code=${encodeURIComponent(savedCode)}` : ""}`);
        return;
      }
    }

    if (isAndroidAppClient()) {
      setIsAndroidApp(true);
      setRoleMode("student");
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "qr" || tabParam === "login" || tabParam === "first_time") {
        setStudentTab(tabParam as any);
      }
      const modeParam = params.get("mode");
      if (modeParam === "faculty" && !isApp && !isPWA) {
        setRoleMode("faculty");
      } else if (modeParam === "student") {
        setRoleMode("student");
      }
    }
  }, []);

  // ==========================================
  // FACULTY LOGIN STATE
  // ==========================================
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // ==========================================
  // STUDENT PORTAL TABS & STATE
  // ==========================================
  const [studentTab, setStudentTab] = useState<"qr" | "login" | "first_time">("qr");

  // Tab 1: QR Card Search & Download
  const [level, setLevel] = useState("الكل");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  // Tab 2: Student Login
  const [studentCode, setStudentCode] = useState("");
  const [studentPin, setStudentPin] = useState("");
  const [showStudentPin, setShowStudentPin] = useState(false);
  const [studentLoginLoading, setStudentLoginLoading] = useState(false);
  const [studentError, setStudentError] = useState("");

  // Tab 3: First Time Activation Lookup
  const [firstTimeCode, setFirstTimeCode] = useState("");
  const [firstTimeLookupLoading, setFirstTimeLookupLoading] = useState(false);
  const [lookedUpStudent, setLookedUpStudent] = useState<any>(null);
  const [firstTimeLookupError, setFirstTimeLookupError] = useState("");

  // Debounced search for student QR
  useEffect(() => {
    if (roleMode !== "student" || studentTab !== "qr") return;
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchStudents();
      } else {
        setStudents([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, level, roleMode, studentTab]);

  const searchStudents = async () => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(query)}&level=${encodeURIComponent(level)}`);
      const data = await res.json();
      if (data.students) {
        setStudents(data.students);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectStudent = (st: any) => {
    setSelectedStudent(st);
    try {
      const dev = getOrCreateDeviceInfo();
      fetch('/api/students/search-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'student_search',
          student_code: st.student_code,
          student_name: st.full_name,
          academic_year: st.academic_year,
          section: st.section,
          query: query,
          device_id: dev.deviceId,
          device_info: dev
        })
      }).catch(() => {});
    } catch (e) {}
  };

  const downloadCardAsImage = async () => {
    if (!selectedStudent) return;
    setDownloading(true);

    try {
      const dev = getOrCreateDeviceInfo();
      fetch('/api/students/search-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download_card',
          student_code: selectedStudent.student_code,
          student_name: selectedStudent.full_name,
          academic_year: selectedStudent.academic_year,
          section: selectedStudent.section,
          device_id: dev.deviceId,
          device_info: dev
        })
      }).catch(() => {});
    } catch (e) {}

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 1000;
      canvas.height = 1400;

      // خلفية متدرجة فخمة
      const gradient = ctx.createLinearGradient(0, 0, 1000, 1400);
      gradient.addColorStop(0, "#0e1626");
      gradient.addColorStop(0.5, "#152238");
      gradient.addColorStop(1, "#0a0f1d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1000, 1400);

      // برواز علوي ملون
      const topBar = ctx.createLinearGradient(0, 0, 1000, 0);
      topBar.addColorStop(0, "#3b82f6");
      topBar.addColorStop(0.5, "#06b6d4");
      topBar.addColorStop(1, "#10b981");
      ctx.fillStyle = topBar;
      ctx.fillRect(0, 0, 1000, 24);

      // إطار البطاقة الأنيق
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 45, 940, 1315);

      // الترويسة الأكاديمية
      ctx.textAlign = "center";
      ctx.fillStyle = "#93c5fd";
      ctx.font = "bold 30px Cairo, sans-serif";
      ctx.fillText("جامعة قنا • كلية التربية النوعية", 500, 85);
      ctx.font = "bold 24px Cairo, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("قسم التربية الفنية • المنظومة الذكية", 500, 122);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 145);
      ctx.lineTo(900, 145);
      ctx.stroke();

      // عنوان البطاقة
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 36px Cairo, sans-serif";
      ctx.fillText("بطاقة الهوية الرقمية للطالب", 500, 190);

      // رسم حاوية الـ QR البيضاء (كبيرة جداً وسريعة المسح)
      const qrBoxSize = 720;
      const qrBoxX = (1000 - qrBoxSize) / 2;
      const qrBoxY = 215;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
      ctx.fill();

      // إطار خفيف أنيق لحاوية الـ QR
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineWidth = 4;
      ctx.stroke();

      // استخراج صورة الـ QR من العنصر
      const svgElement = document.getElementById("student-login-qr-svg");
      if (svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);

        const qrImg = new Image();
        await new Promise((resolve) => {
          qrImg.onload = () => {
            const qrPadding = 20;
            ctx.drawImage(qrImg, qrBoxX + qrPadding, qrBoxY + qrPadding, qrBoxSize - (qrPadding * 2), qrBoxSize - (qrPadding * 2));
            resolve(true);
          };
          qrImg.src = blobURL;
        });
      }

      // بيانات الطالب تحت الـ QR
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 42px Cairo, sans-serif";
      ctx.fillText(selectedStudent.full_name, 500, 990);

      // شارة الفرقة والسكشن
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(220, 1018, 560, 58, 29);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 28px Cairo, sans-serif";
      ctx.fillText(`${selectedStudent.academic_year} • سكشن ${selectedStudent.section || 'عام'}`, 500, 1056);

      // كود الطالب البارز
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 24px Cairo, sans-serif";
      ctx.fillText("الكود الجامعي المعتمد", 500, 1118);

      ctx.fillStyle = "#f59e0b";
      ctx.font = "900 64px monospace, Cairo";
      ctx.fillText(formatStudentCode(selectedStudent.student_code), 500, 1184);

      // تعليمات التنبيه
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.beginPath();
      ctx.roundRect(80, 1220, 840, 68, 16);
      ctx.fill();

      ctx.fillStyle = "#34d399";
      ctx.font = "600 22px Cairo, sans-serif";
      ctx.fillText("احتفظ بهذه البطاقة في معرض الصور لتسجيل حضورك وتقييمك يومياً", 500, 1262);

      // ذيل البطاقة
      ctx.fillStyle = "#64748b";
      ctx.font = "20px Cairo, sans-serif";
      ctx.fillText("نظام التربية الفنية الجديد • مطور المنظومة: د/ إسلام عبد اللطيف حسن", 500, 1340);

      // التنزيل والتسليم الذكي حسب نوع الجهاز
      const dataUrl = canvas.toDataURL("image/png");
      const fileName = `بطاقة_طالب_${selectedStudent.student_code}_${selectedStudent.full_name.split(" ")[0]}.png`;

      // 1. تطبيق أندرويد الأصلي (APK)
      if (typeof window !== "undefined" && (window as any).ArtEduNativeBridge?.saveBase64File) {
        try {
          (window as any).ArtEduNativeBridge.saveBase64File(dataUrl, fileName, "image/png");
          return;
        } catch (bridgeErr) {}
      }

      // 2. أجهزة iOS أو المتصفحات الداعمة لـ Web Share
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob && typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          const file = new File([blob], fileName, { type: "image/png" });
          if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `بطاقة الطالب QR - ${selectedStudent.student_code}`,
              text: `بطاقة الطالب: ${selectedStudent.full_name} (${selectedStudent.student_code})`
            });
            return;
          }
        } catch (shareErr: any) {
          if (shareErr.name === "AbortError") return;
        }
      }

      // 3. التنزيل المباشر في المتصفح
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = blobUrl;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 3000);
      }
    } catch (e) {
      console.error(e);
      alert("تعذر تنزيل الصورة، يرجى أخذ لقطة شاشة (Screenshot)");
    } finally {
      setDownloading(false);
    }
  };

  // Student PIN Login
  const handleStudentLogin = async () => {
    if (!studentCode.trim()) {
      setStudentError("يرجى إدخال كود الطالب الجامعي");
      return;
    }
    if (!studentPin.trim()) {
      setStudentError("يرجى إدخال الرقم السري الخاص بك");
      return;
    }

    setStudentLoginLoading(true);
    setStudentError("");

    try {
      const dev = getOrCreateDeviceInfo();
      const res = await fetch('/api/students/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_code: formatStudentCode(studentCode),
          pin_code: studentPin.trim(),
          device_info: dev
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.device_locked) {
          setStudentError("هذا الحساب مقيّد بجهاز آخر. يرجى التوجه إلى منسقك لفك القيد.");
        } else {
          setStudentError(data.error || "بيانات الدخول غير صحيحة");
        }
        setStudentLoginLoading(false);
        return;
      }

      // Login Successful! Store student session and redirect
      if (typeof window !== "undefined") {
        localStorage.setItem("fania_student_session", JSON.stringify(data.student));
        const finalCode = data.student.student_code || formatStudentCode(studentCode);
        localStorage.setItem("fania_student_code", finalCode);
        localStorage.setItem("fania_last_portal", "/system");
        localStorage.setItem("fania_app_mode", "student");

        if (isAndroidAppClient()) {
          fetch('/api/students/track-install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_code: finalCode,
              action: 'install',
              version: '1.0.6',
              source: 'android_native_app_login'
            })
          }).catch(() => {});
        }

        window.location.href = "/system";
      }
    } catch (e: any) {
      setStudentError("حدث خطأ في الاتصال بالخادم");
      setStudentLoginLoading(false);
    }
  };

  // Student First-Time Lookup
  const handleLookupStudentCode = async (codeToLookup: string) => {
    const clean = formatStudentCode(codeToLookup);
    if (!clean || clean.length < 3) {
      setLookedUpStudent(null);
      setFirstTimeLookupError("");
      return;
    }

    setFirstTimeLookupLoading(true);
    setFirstTimeLookupError("");
    try {
      const dev = getOrCreateDeviceInfo();
      const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(clean)}&deviceId=${encodeURIComponent(dev.deviceId)}`);
      const data = await res.json();
      if (data.student) {
        setLookedUpStudent(data.student);
        setFirstTimeLookupError("");
      } else {
        setLookedUpStudent(null);
        setFirstTimeLookupError(data.error || "الكود غير مسجل في قوائم الكلية");
      }
    } catch (e) {
      setFirstTimeLookupError("تعذر التحقق من الكود حالياً");
    } finally {
      setFirstTimeLookupLoading(false);
    }
  };

  // Faculty Login Handler
  const handleLogin = async () => {
    if (isLocked) {
      setError("تم تعليق الحساب مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى مراجعة الإدارة.");
      return;
    }
    if (!email || !password) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) {
        setIsLocked(true);
        setError("تم قفل الحساب بسبب تجاوز 3 محاولات خاطئة. يرجى مراجعة الإدارة.");
      } else {
        setError(`بيانات الدخول غير صحيحة. (تبقت لك ${3 - newAttempts} محاولات)`);
      }
    } else if (data.user) {
      if (!data.session?.access_token) {
        setError("تعذر بدء الجلسة. يرجى المحاولة مجدداً.");
        await supabase.auth.signOut();
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.is_suspended || (profile?.locked_until && new Date(profile.locked_until) > new Date())) {
        await supabase.auth.signOut();
        setError("تم إيقاف حسابك أو قفله بواسطة الإدارة. يرجى التواصل مع الإدارة.");
        return;
      }

      try {
        const sessionRes = await fetch("/api/auth/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          credentials: "same-origin",
        });
        if (!sessionRes.ok) {
          await supabase.auth.signOut();
          setError("حسابك غير مسجل في قائمة الكادر. يرجى مراجعة الإدارة.");
          return;
        }
      } catch {
        setError("تعذر تأمين جلسة الدخول. تحقق من الاتصال وحاول مجدداً.");
        return;
      }

      const userMeta = data.user.user_metadata || {};
      const safeProfile = profile || {
        id: data.user.id,
        email: data.user.email,
        full_name: userMeta.full_name || data.user.email?.split('@')[0] || 'عضو هيئة تدريس',
        degree: normalizeAcademicDegree(userMeta.degree || 'د'),
        role: 'عضو هيئة تدريس'
      };
      onLogin({ ...data.user, ...safeProfile });
    }
  };

  return (
    <div className="login-container">
      <div 
        className="card" 
        style={{ 
          width: "100%", 
          maxWidth: roleMode === "student" ? "480px" : "420px",
          padding: "24px",
          borderRadius: "16px",
          transition: "max-width 200ms cubic-bezier(0.22, 1, 0.36, 1)",
          marginBottom: 0
        }}
      >
        {/* App Logo & Header */}
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <img
            src="/app-logo.png"
            alt="شعار قسم التربية الفنية"
            style={{
              width: "76px",
              height: "76px",
              borderRadius: "16px",
              border: "1px solid var(--border-light)",
              display: "inline-block",
              backgroundColor: "var(--bg-deep)"
            }}
          />
          <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--success-ink)", fontWeight: 500, marginTop: "8px" }}>
            الإصدار {appVersion}
          </div>
        </div>

        <h2 style={{ textAlign: "center", marginTop: "0", marginBottom: "4px", color: "var(--text)", fontSize: "20px", fontWeight: 600 }}>
          نظام التربية الفنية
        </h2>
        <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px", fontWeight: 400 }}>
          جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
        </div>

        {/* If in Android APK, show return to app login */}
        {isAndroidApp && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "8px 12px", background: "rgba(56, 189, 248, 0.08)", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
            <span style={{ fontSize: "12px", color: "var(--accent-ink)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Smartphone size={15} strokeWidth={1.5} />
              <span>تطبيق الأندرويد • بوابة الطلاب</span>
            </span>
            <a 
              href="/system" 
              style={{ fontSize: "12px", color: "var(--text)", textDecoration: "none", background: "var(--surface-hover)", border: "1px solid var(--border-light)", padding: "4px 10px", borderRadius: "6px", fontWeight: 500 }}
            >
              العودة لدخول التطبيق
            </a>
          </div>
        )}

        {/* Top Segmented Role Switcher: Student vs Faculty - HIDDEN IN ANDROID APK & PWA */}
        {!isAndroidApp && !isPwaClient && (
          <div style={{
          display: "flex",
          gap: "4px",
          background: "var(--bg-deep)",
          borderRadius: "12px",
          padding: "4px",
          marginBottom: "20px",
          border: "1px solid var(--border)"
        }}>
          <button
            type="button"
            onClick={() => { setRoleMode("student"); setError(""); setStudentError(""); }}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: "13px",
              fontWeight: 500,
              background: roleMode === "student" ? "var(--primary)" : "transparent",
              color: roleMode === "student" ? "#ffffff" : "var(--text-secondary)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)"
            }}
          >
            <GraduationCap size={16} strokeWidth={1.5} />
            <span>بوابة الطلاب</span>
          </button>
          <button
            type="button"
            onClick={() => { setRoleMode("faculty"); setError(""); }}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: "13px",
              fontWeight: 500,
              background: roleMode === "faculty" ? "var(--success)" : "transparent",
              color: roleMode === "faculty" ? "#0b0d14" : "var(--text-secondary)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)"
            }}
          >
            <BookUser size={16} strokeWidth={1.5} />
            <span>أعضاء هيئة التدريس</span>
          </button>
        </div>
        )}

        {/* ========================================================= */}
        {/* FACULTY MODE: DIRECT LOGIN ONLY (NO FIRST-TIME TAB) */}
        {/* ========================================================= */}
        {roleMode === "faculty" && (
          <div>
            <div>
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                style={{ textAlign: "left", direction: "ltr", marginBottom: "12px" }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <div style={{ position: "relative", width: "100%", marginBottom: "12px" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  style={{ width: "100%", paddingLeft: "40px", boxSizing: "border-box", margin: 0 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="icon-btn"
                  style={{
                    position: "absolute",
                    left: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "auto",
                    margin: 0
                  }}
                  title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                </button>
              </div>

              <div style={{ textAlign: "right", marginBottom: "16px", display: "flex", justifyContent: "space-between" }}>
                <span 
                  onClick={async () => {
                    if (!email) { alert("أدخل بريدك الإلكتروني أولاً"); return; }
                    const { error } = await supabase.auth.resetPasswordForEmail(email);
                    if (error) alert("خطأ: " + error.message);
                    else alert("تم إرسال رابط استعادة كلمة المرور لبريدك (إذا كان مسجلاً).");
                  }} 
                  style={{ color: "var(--accent-ink)", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}
                >
                  نسيت كلمة المرور؟
                </span>
              </div>

              <button 
                onClick={handleLogin} 
                disabled={loading || isLocked} 
                style={{ 
                  width: "100%",
                  background: isLocked ? "var(--surface-hover)" : "var(--success)",
                  color: isLocked ? "var(--text-muted)" : "#0b0d14",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginTop: 0
                }}
              >
                <LogIn size={16} strokeWidth={1.5} />
                <span>{loading ? "جاري التحقق والدخول" : (isLocked ? "مغلق مؤقتاً" : "دخول النظام")}</span>
              </button>
            </div>

            {error && (
              <div style={{ color: "var(--error-ink)", marginTop: "12px", textAlign: "center", fontWeight: 500, fontSize: "13px" }}>
                {error}
              </div>
            )}

            <div style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "8px",
              background: "var(--bg-deep)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              textAlign: "right"
            }}>
              <Info size={16} strokeWidth={1.5} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "2px" }} />
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                يتم تفعيل حسابات أعضاء هيئة التدريس مباشرة من قِبل إدارة القسم. إذا لم تستلم بيانات حسابك بعد، يرجى التواصل مع الإدارة.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STUDENT MODE: 3 INTEGRATED TABS */}
        {/* ========================================================= */}
        {roleMode === "student" && (
          <div>
            {/* Student Sub-Tabs */}
            <div style={{
              display: "flex",
              gap: "4px",
              background: "var(--bg-deep)",
              borderRadius: "10px",
              padding: "4px",
              marginBottom: "16px",
              border: "1px solid var(--border)"
            }}>
              <button
                type="button"
                onClick={() => { setStudentTab("qr"); setStudentError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: studentTab === "qr" ? "var(--primary)" : "transparent",
                  color: studentTab === "qr" ? "#ffffff" : "var(--text-secondary)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)"
                }}
              >
                <QrCode size={14} strokeWidth={1.5} />
                <span>بطاقة QR</span>
              </button>
              <button
                type="button"
                onClick={() => { setStudentTab("login"); setStudentError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: studentTab === "login" ? "var(--primary)" : "transparent",
                  color: studentTab === "login" ? "#ffffff" : "var(--text-secondary)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)"
                }}
              >
                <KeyRound size={14} strokeWidth={1.5} />
                <span>تسجيل الدخول</span>
              </button>
              <button
                type="button"
                onClick={() => { setStudentTab("first_time"); setStudentError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: studentTab === "first_time" ? "var(--primary)" : "transparent",
                  color: studentTab === "first_time" ? "#ffffff" : "var(--text-secondary)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)"
                }}
              >
                <UserPlus size={14} strokeWidth={1.5} />
                <span>تفعيل أول مرة</span>
              </button>
            </div>

            {/* TAB 1: QR CARD SEARCH & DOWNLOAD */}
            {studentTab === "qr" && (
              <div>
                {!selectedStudent ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                      <div>
                        <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>الفرقة</label>
                        <select 
                          value={level} 
                          onChange={(e) => setLevel(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text)", fontSize: "13px", marginBottom: 0 }}
                        >
                          {LEVELS.map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>الاسم أو الكود</label>
                        <input
                          type="text"
                          placeholder="بحث"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text)", fontSize: "13px", boxSizing: "border-box", marginBottom: 0 }}
                        />
                      </div>
                    </div>

                    {searchLoading && (
                      <div style={{ textAlign: "center", color: "var(--accent-ink)", padding: "12px", fontSize: "13px" }}>
                        جاري البحث
                      </div>
                    )}

                    {query.trim().length >= 2 && !searchLoading && students.length === 0 && (
                      <div style={{ textAlign: "center", color: "var(--error-ink)", padding: "12px", fontSize: "13px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "8px" }}>
                        لم يتم العثور على طالب يطابق البحث
                      </div>
                    )}

                    {students.length > 0 && (
                      <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                        {students.map((st) => (
                          <div
                            key={st.id || st.student_code}
                            onClick={() => handleSelectStudent(st)}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "8px",
                              background: "var(--bg-deep)",
                              border: "1px solid var(--border)",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              transition: "background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms cubic-bezier(0.22, 1, 0.36, 1)"
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>{st.full_name}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{st.academic_year} • سكشن {st.section || 'عام'}</div>
                            </div>
                            <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--accent-ink)", fontFamily: "monospace", fontWeight: 600 }}>
                              {formatStudentCode(st.student_code)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {query.trim().length < 2 && (
                      <div style={{ textAlign: "center", padding: "16px 8px", color: "var(--text-muted)", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <Search size={14} strokeWidth={1.5} />
                        <span>اكتب أول حرفين من اسمك أو كودك للبحث عن بطاقتك</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    {/* QR Card Preview */}
                    <div style={{
                      background: "var(--bg-deep)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      borderRadius: "12px",
                      padding: "16px",
                      marginBottom: "12px"
                    }}>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "4px" }}>
                        جامعة قنا • كلية التربية النوعية
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--accent-ink)", marginBottom: "12px" }}>
                        قسم التربية الفنية
                      </div>

                      <div style={{
                        background: "#fff",
                        padding: "12px",
                        borderRadius: "12px",
                        display: "inline-block",
                        marginBottom: "12px",
                      }}>
                        <QRCode
                          id="student-login-qr-svg"
                          value={`كود الطالب: ${formatStudentCode(selectedStudent.student_code)}\nاسم الطالب: ${selectedStudent.full_name}`}
                          size={220}
                          level="H"
                        />
                      </div>

                      <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                        {selectedStudent.full_name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--accent-ink)", marginBottom: "4px" }}>
                        {selectedStudent.academic_year} • سكشن {selectedStudent.section || 'عام'}
                      </div>
                      <div className="tabular-nums" style={{ fontSize: "14px", color: "var(--warning-ink)", fontFamily: "monospace", fontWeight: 600 }}>
                        الكود: {formatStudentCode(selectedStudent.student_code)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={downloadCardAsImage}
                      disabled={downloading}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "var(--success)",
                        color: "#0b0d14",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: downloading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <Download size={16} strokeWidth={1.5} />
                      <span>{downloading ? "جاري تحميل البطاقة" : "تحميل بطاقة الـ QR (PNG)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "transparent",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      <RefreshCw size={14} strokeWidth={1.5} />
                      <span>اختيار طالب آخر</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STUDENT PIN LOGIN */}
            {studentTab === "login" && (
              <div>
                <input
                  type="text"
                  placeholder="كود الطالب الجامعي"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  className="tabular-nums"
                  style={{ textAlign: "center", fontSize: "14px", marginBottom: "12px" }}
                  onKeyDown={(e) => e.key === "Enter" && handleStudentLogin()}
                />

                <div style={{ position: "relative", width: "100%", marginBottom: "12px" }}>
                  <input
                    type={showStudentPin ? "text" : "password"}
                    placeholder="الرقم السري (PIN)"
                    value={studentPin}
                    onChange={(e) => setStudentPin(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStudentLogin()}
                    style={{ width: "100%", paddingLeft: "40px", boxSizing: "border-box", textAlign: "center", fontSize: "14px", margin: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPin(!showStudentPin)}
                    className="icon-btn"
                    style={{
                      position: "absolute",
                      left: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "auto",
                      margin: 0
                    }}
                    title={showStudentPin ? "إخفاء الرقم السري" : "إظهار الرقم السري"}
                  >
                    {showStudentPin ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                  </button>
                </div>

                <div style={{ textAlign: "center", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <Lightbulb size={14} strokeWidth={1.5} style={{ color: "var(--accent-ink)", flexShrink: 0 }} />
                  <span style={{ color: "var(--text-secondary)", fontSize: "12px", lineHeight: 1.4 }}>
                    الدخول يتطلب كود الطالب والرقم السري المعتمد من منسق المنظومة
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleStudentLogin}
                  disabled={studentLoginLoading}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "var(--primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: studentLoginLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <LogIn size={16} strokeWidth={1.5} />
                  <span>{studentLoginLoading ? "جاري التحقق والدخول" : "دخول إلى بوابة الطالب"}</span>
                </button>

                {studentError && (
                  <div style={{ color: "var(--error-ink)", marginTop: "12px", textAlign: "center", fontWeight: 500, fontSize: "13px" }}>
                    {studentError}
                  </div>
                )}

                <div style={{ textAlign: "center", marginTop: "16px" }}>
                  <span
                    onClick={() => { setStudentTab("first_time"); setStudentError(""); }}
                    style={{ color: "var(--accent-ink)", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
                  >
                    طالب جديد؟ تفعيل الحساب لأول مرة
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: FIRST-TIME STUDENT ACTIVATION */}
            {studentTab === "first_time" && (
              <div>
                <div style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.22)",
                  marginBottom: "12px",
                  fontSize: "12px",
                  color: "var(--success-ink)",
                  lineHeight: 1.5,
                  textAlign: "center"
                }}>
                  أدخل كودك الجامعي للتحقق من بياناتك والبدء في تفعيل الحساب الطلابي
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <input
                    type="text"
                    placeholder="كود الطالب الجامعي"
                    value={firstTimeCode}
                    onChange={(e) => {
                      setFirstTimeCode(e.target.value);
                      handleLookupStudentCode(e.target.value);
                    }}
                    className="tabular-nums"
                    style={{ textAlign: "center", fontSize: "14px", marginBottom: 0 }}
                  />
                </div>

                {firstTimeLookupLoading && (
                  <div style={{ textAlign: "center", color: "var(--accent-ink)", fontSize: "12px", marginBottom: "12px" }}>
                    جاري فحص الكود
                  </div>
                )}

                {lookedUpStudent && (
                  <div style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "rgba(37, 99, 235, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    marginBottom: "12px",
                    textAlign: "right"
                  }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                      الطالب: {lookedUpStudent.full_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--accent-ink)" }}>
                      الفرقة: {lookedUpStudent.academic_year} • سكشن {lookedUpStudent.section || 'عام'}
                    </div>
                  </div>
                )}

                {firstTimeLookupError && (
                  <div style={{ color: "var(--error-ink)", marginBottom: "12px", textAlign: "center", fontSize: "12px" }}>
                    {firstTimeLookupError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!firstTimeCode.trim() || !!firstTimeLookupError || firstTimeLookupLoading}
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const codeToUse = firstTimeCode ? formatStudentCode(firstTimeCode) : "";
                      if (codeToUse) {
                        localStorage.setItem("fania_pending_reg_code", codeToUse);
                        if (lookedUpStudent) {
                          try {
                            sessionStorage.setItem("fania_prefetched_student", JSON.stringify(lookedUpStudent));
                          } catch (e) {}
                        }
                      }
                      localStorage.setItem("fania_last_portal", "/system");
                      localStorage.setItem("fania_app_mode", "student");
                      const targetUrl = codeToUse ? `/system?mode=register&code=${encodeURIComponent(codeToUse)}` : "/system?mode=register";
                      window.location.href = targetUrl;
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: (!firstTimeCode.trim() || !!firstTimeLookupError || firstTimeLookupLoading)
                      ? "var(--surface-hover)"
                      : "var(--success)",
                    color: (!firstTimeCode.trim() || !!firstTimeLookupError || firstTimeLookupLoading)
                      ? "var(--text-muted)"
                      : "#0b0d14",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: (!firstTimeCode.trim() || !!firstTimeLookupError || firstTimeLookupLoading) ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    opacity: (!firstTimeCode.trim() || !!firstTimeLookupError || firstTimeLookupLoading) ? 0.6 : 1
                  }}
                >
                  <span>استكمال التفعيل ورفع الهوية في البوابة</span>
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
