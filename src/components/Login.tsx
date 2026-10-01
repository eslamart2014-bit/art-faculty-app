"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import QRCode from "react-qr-code";
import { 
  Eye, 
  EyeOff, 
  Search, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  GraduationCap, 
  ArrowRight,
  LogIn,
  RotateCw,
  AlertCircle
} from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";
import { getOrCreateDeviceInfo } from "@/lib/deviceFingerprint";

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
    setAppVersion(localStorage.getItem('appVersion') || "1.7");
  }, []);

  // Main role mode switcher: Student vs Faculty (Students first)
  const [roleMode, setRoleMode] = useState<"student" | "faculty">("student");

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
      ctx.font = "bold 22px Cairo, sans-serif";
      ctx.fillText("📸 احتفظ بهذه البطاقة في معرض الصور لتسجيل حضورك وتقييمك يومياً", 500, 1262);

      // ذيل البطاقة
      ctx.fillStyle = "#64748b";
      ctx.font = "20px Cairo, sans-serif";
      ctx.fillText("نظام التربية الفنية الجديد • مطور المنظومة: د/ إسلام عبد اللطيف حسن", 500, 1340);

      // التنزيل المباشر
      const link = document.createElement("a");
      link.download = `بطاقة_طالب_${selectedStudent.student_code}_${selectedStudent.full_name.split(" ")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
      alert("تعذر تنزيل الصورة، يرجى أخذ لقطة شاشة (Screenshot)");
    } finally {
      setDownloading(false);
    }
  };

  // Student PIN Login
  const handleStudentLogin = async () => {
    if (!studentCode.trim() || !studentPin.trim()) {
      setStudentError("يرجى إدخال كود الطالب والرقم السري");
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
        localStorage.setItem("fania_last_portal", "/system");
        localStorage.setItem("fania_app_mode", "student");
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
        try {
          await fetch('/api/auth/lock', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': 'art-faculty-lock-internal-2026'
            },
            body: JSON.stringify({ email })
          });
        } catch (err) {}
      } else {
        setError(`بيانات الدخول غير صحيحة. (تبقت لك ${3 - newAttempts} محاولات)`);
      }
    } else if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      onLogin({ ...data.user, ...profile });
    }
  };

  return (
    <div className="login-container">
      <div 
        className="card" 
        style={{ 
          width: "100%", 
          maxWidth: roleMode === "student" ? "480px" : "400px",
          transition: "max-width 0.25s ease" 
        }}
      >
        {/* App Logo & Header */}
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <img
            src="/app-logo.png"
            alt="شعار فنية"
            style={{
              width: "90px",
              height: "90px",
              borderRadius: "22px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
              border: "2px solid rgba(255,255,255,0.15)",
              display: "inline-block",
              backgroundColor: "#222"
            }}
          />
          <div style={{ fontSize: "13px", color: "#4CAF50", fontWeight: "bold", marginTop: "8px" }}>
            تحديث {appVersion}
          </div>
        </div>

        <h2 style={{ textAlign: "center", marginTop: "2px", marginBottom: "4px", color: "var(--primary)" }}>
          نظام التربية الفنية
        </h2>
        <div style={{ textAlign: "center", fontSize: "11px", color: "#94a3b8", marginBottom: "16px", fontWeight: "bold" }}>
          جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
        </div>

        {/* Top Segmented Role Switcher: Student vs Faculty (Students First) */}
        <div style={{
          display: "flex",
          background: "rgba(255, 255, 255, 0.08)",
          borderRadius: "14px",
          padding: "4px",
          marginBottom: "18px",
          border: "1px solid rgba(255, 255, 255, 0.12)"
        }}>
          <button
            type="button"
            onClick={() => { setRoleMode("student"); setError(""); setStudentError(""); }}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: "14px",
              fontWeight: "bold",
              background: roleMode === "student" ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "transparent",
              color: roleMode === "student" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: roleMode === "student" ? "0 4px 12px rgba(37, 99, 235, 0.3)" : "none",
              transition: "all 0.2s ease"
            }}
          >
            <span>🎓</span>
            <span>بوابة الطلاب</span>
          </button>
          <button
            type="button"
            onClick={() => { setRoleMode("faculty"); setError(""); }}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: "14px",
              fontWeight: "bold",
              background: roleMode === "faculty" ? "linear-gradient(135deg, #10b981, #059669)" : "transparent",
              color: roleMode === "faculty" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: roleMode === "faculty" ? "0 4px 12px rgba(16, 185, 129, 0.3)" : "none",
              transition: "all 0.2s ease"
            }}
          >
            <span>👨‍🏫</span>
            <span>أعضاء هيئة التدريس</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* FACULTY MODE: DIRECT LOGIN ONLY (NO FIRST-TIME TAB) */}
        {/* ========================================================= */}
        {roleMode === "faculty" && (
          <div>
            <div style={{ marginBottom: "14px" }}>
              <input
                type="email"
                placeholder="البريد الإلكتروني للزميل (Gmail)"
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
                  style={{ width: "100%", paddingLeft: "42px", boxSizing: "border-box", margin: 0 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
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
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div style={{ textAlign: "right", marginBottom: "15px", display: "flex", justifyContent: "space-between" }}>
                <span 
                  onClick={async () => {
                    if (!email) { alert("أدخل بريدك الإلكتروني أولاً"); return; }
                    const { error } = await supabase.auth.resetPasswordForEmail(email);
                    if (error) alert("خطأ: " + error.message);
                    else alert("تم إرسال رابط استعادة كلمة المرور لبريدك (إذا كان مسجلاً).");
                  }} 
                  style={{ color: "var(--primary)", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}
                >
                  نسيت كلمة المرور؟
                </span>
              </div>

              <button 
                onClick={handleLogin} 
                disabled={loading || isLocked} 
                style={{ 
                  width: "100%",
                  background: isLocked ? "#555" : "linear-gradient(135deg, #10b981, #059669)",
                  padding: "12px",
                  fontSize: "15px",
                  fontWeight: "bold",
                  borderRadius: "10px",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)"
                }}
              >
                {loading ? "جاري التحقق والدخول..." : (isLocked ? "مغلق مؤقتاً" : "دخول النظام")}
              </button>
            </div>

            {error && (
              <div style={{ color: "var(--error)", marginTop: "10px", textAlign: "center", fontWeight: "bold", fontSize: "13px" }}>
                {error}
              </div>
            )}

            <div style={{
              marginTop: "18px",
              padding: "12px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px dashed rgba(255, 255, 255, 0.15)",
              textAlign: "center"
            }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", lineHeight: "1.5" }}>
                ℹ️ يتم تفعيل حسابات السادة أعضاء هيئة التدريس مباشرة من قِبل إدارة القسم. إذا لم تستلم بيانات حسابك بعد، يرجى التواصل مع الإدارة.
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
              background: "rgba(37, 99, 235, 0.12)",
              borderRadius: "10px",
              padding: "4px",
              marginBottom: "16px",
              border: "1px solid rgba(59, 130, 246, 0.25)"
            }}>
              <button
                type="button"
                onClick={() => { setStudentTab("qr"); setStudentError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  background: studentTab === "qr" ? "#2563eb" : "transparent",
                  color: studentTab === "qr" ? "#ffffff" : "#94a3b8",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                🪪 استخراج الـ QR
              </button>
              <button
                type="button"
                onClick={() => { setStudentTab("login"); setStudentError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  background: studentTab === "login" ? "#2563eb" : "transparent",
                  color: studentTab === "login" ? "#ffffff" : "#94a3b8",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                🔑 تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => { setStudentTab("first_time"); setStudentError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  background: studentTab === "first_time" ? "#2563eb" : "transparent",
                  color: studentTab === "first_time" ? "#ffffff" : "#94a3b8",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                ✨ تفعيل أول مرة
              </button>
            </div>

            {/* TAB 1: QR CARD SEARCH & DOWNLOAD */}
            {studentTab === "qr" && (
              <div>
                {!selectedStudent ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                      <div>
                        <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>تصفية بالفرقة:</label>
                        <select 
                          value={level} 
                          onChange={(e) => setLevel(e.target.value)}
                          style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "#111", border: "1px solid #333", color: "#fff", fontSize: "13px" }}
                        >
                          {LEVELS.map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>بحث بالاسم أو الكود:</label>
                        <input
                          type="text"
                          placeholder="اكتب اسمك..."
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "#111", border: "1px solid #333", color: "#fff", fontSize: "13px", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {searchLoading && (
                      <div style={{ textAlign: "center", color: "#60a5fa", padding: "12px", fontSize: "13px" }}>
                        جاري البحث...
                      </div>
                    )}

                    {query.trim().length >= 2 && !searchLoading && students.length === 0 && (
                      <div style={{ textAlign: "center", color: "#f87171", padding: "14px", fontSize: "13px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "8px" }}>
                        لم يتم العثور على طالب يطابق البحث
                      </div>
                    )}

                    {students.length > 0 && (
                      <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                        {students.map((st) => (
                          <div
                            key={st.id || st.student_code}
                            onClick={() => handleSelectStudent(st)}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "8px",
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              transition: "background 0.15s ease"
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: "bold", color: "#fff" }}>{st.full_name}</div>
                              <div style={{ fontSize: "11px", color: "#94a3b8" }}>{st.academic_year} • سكشن {st.section || 'عام'}</div>
                            </div>
                            <span style={{ fontSize: "12px", color: "#38bdf8", fontFamily: "monospace", fontWeight: "bold" }}>
                              {formatStudentCode(st.student_code)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {query.trim().length < 2 && (
                      <div style={{ textAlign: "center", padding: "16px 8px", color: "#64748b", fontSize: "12px" }}>
                        🔍 اكتب أول حرفين من اسمك أو كودك للبحث عن بطاقتك واستخراجها
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    {/* QR Card Preview */}
                    <div style={{
                      background: "linear-gradient(135deg, #0e1626, #152238)",
                      border: "2px solid #3b82f6",
                      borderRadius: "16px",
                      padding: "16px",
                      marginBottom: "14px"
                    }}>
                      <div style={{ fontSize: "12px", color: "#93c5fd", fontWeight: "bold", marginBottom: "4px" }}>
                        جامعة قنا • كلية التربية النوعية
                      </div>
                      <div style={{ fontSize: "11px", color: "#38bdf8", marginBottom: "12px" }}>
                        قسم التربية الفنية
                      </div>

                      <div style={{
                        background: "#fff",
                        padding: "14px",
                        borderRadius: "16px",
                        display: "inline-block",
                        marginBottom: "14px",
                        boxShadow: "0 8px 25px rgba(0, 0, 0, 0.45)"
                      }}>
                        <QRCode
                          id="student-login-qr-svg"
                          value={`كود الطالب: ${formatStudentCode(selectedStudent.student_code)}\nاسم الطالب: ${selectedStudent.full_name}`}
                          size={230}
                          level="H"
                        />
                      </div>

                      <div style={{ fontSize: "15px", fontWeight: "bold", color: "#fff", marginBottom: "4px" }}>
                        {selectedStudent.full_name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#60a5fa", marginBottom: "4px" }}>
                        {selectedStudent.academic_year} • سكشن {selectedStudent.section || 'عام'}
                      </div>
                      <div style={{ fontSize: "14px", color: "#f59e0b", fontFamily: "monospace", fontWeight: "bold" }}>
                        الكود: {formatStudentCode(selectedStudent.student_code)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={downloadCardAsImage}
                      disabled={downloading}
                      style={{
                        width: "100%",
                        padding: "12px",
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        cursor: downloading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        marginBottom: "8px",
                        boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)"
                      }}
                    >
                      <Download size={18} />
                      <span>{downloading ? "جاري تحميل البطاقة..." : "تحميل بطاقة الـ QR (PNG)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "transparent",
                        color: "#94a3b8",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      🔄 اختيار طالب آخر
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
                  placeholder="كود الطالب الجامعي (مثال: 0045)"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  style={{ textAlign: "center", fontSize: "14px", marginBottom: "12px" }}
                  onKeyDown={(e) => e.key === "Enter" && handleStudentLogin()}
                />

                <div style={{ position: "relative", width: "100%", marginBottom: "14px" }}>
                  <input
                    type={showStudentPin ? "text" : "password"}
                    placeholder="الرقم السري (PIN)"
                    value={studentPin}
                    onChange={(e) => setStudentPin(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStudentLogin()}
                    style={{ width: "100%", paddingLeft: "42px", boxSizing: "border-box", textAlign: "center", fontSize: "14px", margin: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPin(!showStudentPin)}
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
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
                    {showStudentPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleStudentLogin}
                  disabled={studentLoginLoading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: studentLoginLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)"
                  }}
                >
                  <LogIn size={18} />
                  <span>{studentLoginLoading ? "جاري التحقق والدخول..." : "دخول إلى بوابة الطالب"}</span>
                </button>

                {studentError && (
                  <div style={{ color: "var(--error)", marginTop: "10px", textAlign: "center", fontWeight: "bold", fontSize: "13px" }}>
                    {studentError}
                  </div>
                )}

                <div style={{ textAlign: "center", marginTop: "14px" }}>
                  <span
                    onClick={() => { setStudentTab("first_time"); setStudentError(""); }}
                    style={{ color: "#60a5fa", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
                  >
                    طالب جديد؟ اضغط هنا لتفعيل حسابك لأول مرة
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: FIRST-TIME STUDENT ACTIVATION */}
            {studentTab === "first_time" && (
              <div>
                <div style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  marginBottom: "14px",
                  fontSize: "12px",
                  color: "#34d399",
                  lineHeight: "1.5",
                  textAlign: "center"
                }}>
                  ✨ أدخل كودك الجامعي للتحقق من بياناتك والبدء في تفعيل الحساب الطلابي.
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <input
                    type="text"
                    placeholder="أدخل كود الطالب الجامعي"
                    value={firstTimeCode}
                    onChange={(e) => {
                      setFirstTimeCode(e.target.value);
                      handleLookupStudentCode(e.target.value);
                    }}
                    style={{ textAlign: "center", fontSize: "14px" }}
                  />
                </div>

                {firstTimeLookupLoading && (
                  <div style={{ textAlign: "center", color: "#60a5fa", fontSize: "12px", marginBottom: "10px" }}>
                    جاري فحص الكود...
                  </div>
                )}

                {lookedUpStudent && (
                  <div style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    marginBottom: "14px",
                    textAlign: "right"
                  }}>
                    <div style={{ fontSize: "13px", fontWeight: "bold", color: "#fff", marginBottom: "4px" }}>
                      الطالب: {lookedUpStudent.full_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "#93c5fd" }}>
                      الفرقة: {lookedUpStudent.academic_year} • سكشن {lookedUpStudent.section || 'عام'}
                    </div>
                  </div>
                )}

                {firstTimeLookupError && (
                  <div style={{ color: "var(--error)", marginBottom: "12px", textAlign: "center", fontSize: "12px" }}>
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
                    padding: "12px",
                    background: (!firstTimeCode.trim() || !!firstTimeLookupError || firstTimeLookupLoading)
                      ? "#334155"
                      : "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: (!firstTimeCode.trim() || !!firstTimeLookupError || firstTimeLookupLoading) ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)",
                    opacity: (!firstTimeCode.trim() || !!firstTimeLookupError || firstTimeLookupLoading) ? 0.6 : 1
                  }}
                >
                  <span>استكمال التفعيل ورفع الهوية في البوابة</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
