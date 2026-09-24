"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { 
  ShieldCheck, 
  Search, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw,
  ChevronLeft,
  XCircle,
  ShieldAlert,
  UserCheck,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  QrCode as QrIcon,
  Maximize2,
  Clock,
  Smartphone,
  Lock,
  UserX
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatStudentCode } from "@/lib/codeHelper";
import QRScanner from "@/components/QRScanner";
import { extractStudentCode } from "@/lib/scannerHelper";

export default function CoordinatorPortalPage() {
  const [user, setUser] = useState<any>(null);
  const [coordinatorName, setCoordinatorName] = useState<string>("");
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activatingAnim, setActivatingAnim] = useState(false);
  
  // خاصية إخفاء/إظهار الرقم السري حسب رغبة المستخدم
  const [showPin, setShowPin] = useState(false);
  
  // معاينة صورة البطاقة بالحجم الكامل
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // إظهار QR التسجيل للطلاب غير المسجلين
  const [showRegQr, setShowRegQr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    };
  }, []);

  // التحقق من صلاحية المستخدم كمنسق أو مدير
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, can_verify_students")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile) {
        setUser(profile);
        setCoordinatorName(profile.full_name || "منسق معتمد");
      }
    };

    checkAuth();
  }, []);

  // البحث عن الطالب بكوده
  const handleLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || searchCode).trim();
    if (!code) return;

    setLoading(true);
    setSearchResult(null);
    setShowPin(false);
    setZoomedImage(null);
    setShowRegQr(false);

    try {
      const res = await fetch("/api/coordinator/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup",
          student_code: code,
          coordinator_name: coordinatorName || "منسق النظام",
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "تعذر البحث عن الطالب");
      } else {
        setSearchResult(data);
      }
    } catch (e: any) {
      alert("خطأ في الاتصال: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 1. تفعيل حساب الطالب فورياً
  const handleActivateStudent = async () => {
    if (!searchResult?.student?.student_code) return;

    setActivatingAnim(true);
    try {
      const res = await fetch("/api/coordinator/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_student",
          student_code: searchResult.student.student_code,
          coordinator_name: coordinatorName || "منسق النظام",
        })
      });

      const data = await res.json();
      if (res.ok) {
        // اهتزاز تأكيد نجاح خفيف
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        
        // بعد ثانية واحدة العودة لحالة الاعتماد التام
        setTimeout(() => {
          setActivatingAnim(false);
          // تحديث الحالة محلياً ليصبح مسجلاً ومفعلاً
          setSearchResult((prev: any) => ({
            ...prev,
            isActivated: true,
            account: {
              ...prev.account,
              status: 'active',
              activated_by: coordinatorName || "منسق النظام",
              activated_at: new Date().toISOString()
            }
          }));
        }, 800);
      } else {
        setActivatingAnim(false);
        alert(data.error || "تعذر تفعيل الحساب");
      }
    } catch (e: any) {
      setActivatingAnim(false);
      alert("خطأ: " + e.message);
    }
  };

  // 2. رفض البيانات (بيانات خاطئة أو بطاقة غير مطابقة)
  const handleRejectData = async () => {
    if (!searchResult?.student?.student_code) return;
    if (!confirm("هل أنت متأكد من رفض بيانات هذا الطالب وحذف تسجيله؟\nسيتعين على الطالب التسجيل مجدداً من الصفر بهاتفه مع رفع بطاقة واضحة.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/coordinator/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_incorrect_data",
          student_code: searchResult.student.student_code,
          coordinator_name: coordinatorName || "منسق النظام",
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ تم رفض البيانات وتصفير حساب الطالب للبدء من جديد.");
        setSearchResult(null);
        setSearchCode("");
      } else {
        alert(data.error || "تعذر الرفض");
      }
    } catch (e: any) {
      alert("خطأ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. إنهاء جلسات الأجهزة الأخرى لمنع التحايل
  const handleResetSessions = async () => {
    if (!searchResult?.student?.student_code) return;

    setLoading(true);
    try {
      const res = await fetch("/api/coordinator/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_other_sessions",
          student_code: searchResult.student.student_code,
          coordinator_name: coordinatorName || "منسق النظام",
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert("🔒 " + (data.message || "تم إنهاء جلسات الطالب من الأجهزة الأخرى بنجاح."));
      } else {
        alert(data.error || "تعذر العملية");
      }
    } catch (e: any) {
      alert("خطأ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const getPortalUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/student-portal`;
    }
    return "/student-portal";
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(getPortalUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // تشغيل ماسح الـ QR بكاميرا الهاتف
  const startScanner = () => {
    setIsScanning(true);
  };

  const stopScanner = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
    setIsScanning(false);
  };

  return (
    <div style={{ minHeight: "100vh", padding: "16px", maxWidth: "520px", margin: "0 auto", direction: "rtl" }}>
      
      {/* هيدر الصفحة */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
          <ChevronLeft size={16} />
          <span>الرئيسية</span>
        </Link>
        <span style={{ color: "#10b981", fontSize: "12px", fontWeight: "bold", background: "rgba(16, 185, 129, 0.1)", padding: "4px 10px", borderRadius: "10px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
          مكتب منسقي نظام فنية 🪪
        </span>
      </div>

      <div className="glass-card" style={{ padding: "18px", marginBottom: "18px", borderRadius: "16px" }}>
        
        {/* المنسق الحالي المسؤول عن الاعتماد */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "11px" }}>المنسق المعتمد المسؤول:</div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>{coordinatorName || "منسق معتمد"}</div>
          </div>
        </div>

        <h1 style={{ fontSize: "17px", fontWeight: "bold", color: "#fff", marginBottom: "4px" }}>
          اعتماد هوية الطالب وتفعيل حسابه
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px", lineHeight: "1.5" }}>
          امسح كود الطالب بالـ QR أو أدخل الكود لفحص حالته ومطابقة بطاقته الشخصية.
        </p>

        {/* شريط البحث الموحد والمتناسق تماماً في الارتفاع والجمالية */}
        <div style={{ display: "flex", gap: "8px", alignItems: "stretch", marginBottom: "8px" }}>
          
          {/* مربع الإدخال */}
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <input 
              id="coordSearchInput"
              type="text"
              placeholder="كود الطالب (مثل: 0001)..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
              style={{ 
                width: "100%", 
                height: "46px",
                padding: "0 14px", 
                paddingLeft: "34px", 
                background: "#0d131f", 
                border: "1.5px solid #2a374f", 
                borderRadius: "12px", 
                color: "#fff", 
                fontSize: "14px",
                fontWeight: "bold",
                boxSizing: "border-box",
                outline: "none"
              }}
            />
            {searchCode && (
              <button 
                onClick={() => setSearchCode("")}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "13px" }}
              >
                ✕
              </button>
            )}
          </div>

          {/* زر الفحص */}
          <button 
            onClick={() => handleLookup()}
            disabled={loading}
            style={{ 
              height: "46px",
              padding: "0 18px", 
              fontSize: "13px", 
              fontWeight: "bold",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
              transition: "all 0.2s"
            }}
          >
            <Search size={16} />
            <span>{loading ? "فحص..." : "فحص"}</span>
          </button>

          {/* زر الكاميرا */}
          <button 
            onClick={isScanning ? stopScanner : startScanner}
            style={{ 
              height: "46px",
              width: "46px",
              background: isScanning ? "#ef4444" : "#1e293b", 
              border: "1.5px solid",
              borderColor: isScanning ? "#ef4444" : "#334155", 
              color: "#fff", 
              borderRadius: "12px", 
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s"
            }}
            title={isScanning ? "إغلاق الكاميرا" : "مسح QR بالكاميرا"}
          >
            <Camera size={19} />
          </button>
        </div>

        {/* شباك الكاميرا عند التفعيل */}
        {isScanning && (
          <div style={{ marginTop: "14px", borderRadius: "14px", overflow: "hidden", border: "2px solid #3b82f6" }}>
            <QRScanner 
              onScan={(decodedText) => {
                const extracted = extractStudentCode(decodedText) || decodedText.trim();
                if (extracted) {
                  setSearchCode(extracted);
                  stopScanner();
                  handleLookup(extracted);
                }
              }}
              onClose={stopScanner}
              height="260px"
              compact={true}
              title="ماسح كود الطالب"
            />
          </div>
        )}

      </div>

      {/* =============================================================== */}
      {/* نتيجة فحص هوية الطالب: 3 حالات متميزة بدقة */}
      {/* =============================================================== */}
      {searchResult && (
        <div className="glass-card animate-fade-in" style={{ padding: "20px", borderRadius: "16px", marginBottom: "20px" }}>
          
          {/* ========================================================= */}
          {/* الحالة 1: الطالب غير مسجل في البوابة إطلاقاً */}
          {/* ========================================================= */}
          {!searchResult.registered ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              
              {/* أيقونة الحالة */}
              <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "12px", border: "2px solid rgba(239, 68, 68, 0.3)" }}>
                <UserX size={32} />
              </div>

              {/* شارة مميزة */}
              <div style={{ marginBottom: "12px" }}>
                <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>
                  ❌ غير مسجل بالبوابة بعد
                </span>
              </div>

              {/* بيانات الطالب الرسمية من الكشوف */}
              <h2 style={{ color: "#fff", fontSize: "19px", fontWeight: "bold", marginBottom: "4px" }}>
                {searchResult.student?.full_name}
              </h2>
              <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold", marginBottom: "14px" }}>
                كود الطالب: {formatStudentCode(searchResult.student?.student_code)} • {searchResult.student?.academic_year} (سكشن {searchResult.student?.section || 'عام'})
              </div>

              {/* صندوق الشرح التوجيهي */}
              <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px dashed rgba(239, 68, 68, 0.35)", borderRadius: "12px", padding: "14px", color: "#fca5a5", fontSize: "13px", lineHeight: "1.7", textAlign: "right", marginBottom: "18px" }}>
                ⚠️ <b>تنبيه للمنسق:</b> هذا الطالب موجود بكشوف الكلية، ولكنه <b>لم يقم بفتح التطبيق والتسجيل حتى الآن</b>.
                <br />
                يجب على الطالب فتح رابط بوابة الطلاب بهاتفه، وإدخال كوده ورفع صورة بطاقة الهوية أولاً ليتمكن المنسق من اعتماده.
              </div>

              {/* أزرار مساعدة الطالب على التسجيل فورياً */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  onClick={handleCopyLink}
                  style={{
                    background: copiedLink ? "#10b981" : "#1e293b",
                    color: "#fff",
                    border: "1px solid #334155",
                    padding: "12px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.2s"
                  }}
                >
                  <Copy size={16} />
                  <span>{copiedLink ? "✓ تم نسخ رابط البوابة" : "📋 نسخ رابط البوابة للطالب"}</span>
                </button>

                <button
                  onClick={() => setShowRegQr(!showRegQr)}
                  style={{
                    background: "#0f172a",
                    color: "#38bdf8",
                    border: "1px solid #38bdf8",
                    padding: "12px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  <QrIcon size={16} />
                  <span>{showRegQr ? "إخفاء كود الـ QR" : "📱 إظهار QR التسجيل ليمسحه الطالب بهاتفه"}</span>
                </button>

                {/* كود QR فوري ليمسحه الطالب أمام المنسق */}
                {showRegQr && (
                  <div className="animate-fade-in" style={{ background: "#fff", padding: "16px", borderRadius: "14px", marginTop: "8px", textAlign: "center" }}>
                    <div style={{ display: "inline-block" }}>
                      <QRCode value={getPortalUrl()} size={180} />
                    </div>
                    <div style={{ color: "#000", fontWeight: "bold", fontSize: "12px", marginTop: "10px" }}>
                      وجّه كاميرا موبايل الطالب نحو الكود ليفتح التسجيل فوراً 📲
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : !searchResult.isActivated ? (

            /* ========================================================= */
            /* الحالة 2: طالب مسجل لأول مرة - بانتظار الاعتماد (Pending) */
            /* ========================================================= */
            <div>
              
              {/* هيدر الكارت */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1.5px solid #2a374f", paddingBottom: "14px", marginBottom: "14px" }}>
                <div>
                  <div style={{ display: "inline-block", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "3px 10px", borderRadius: "14px", fontSize: "11px", fontWeight: "bold", marginBottom: "6px" }}>
                    ⏳ بانتظار الاعتماد لأول مرة
                  </div>
                  <h2 style={{ color: "#fff", fontSize: "19px", fontWeight: "bold", margin: "0 0 4px 0" }}>
                    {searchResult.student?.full_name}
                  </h2>
                  <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold" }}>
                    كود: {formatStudentCode(searchResult.student?.student_code)} • {searchResult.student?.academic_year} (سكشن {searchResult.student?.section || 'عام'})
                  </div>
                </div>

                <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={24} />
                </div>
              </div>

              {/* بيانات الطالب المسجلة */}
              <div style={{ background: "#0d131f", border: "1px solid #1e293b", borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: "11px" }}>رقم الموبايل المسجل:</div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", direction: "ltr", textAlign: "right" }}>
                      {searchResult.account?.mobile || "غير مدخل"}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#94a3b8", fontSize: "11px" }}>الرقم السري (PIN):</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: "bold", fontSize: "16px" }}>
                        {showPin ? (searchResult.account?.pin_code || "----") : "••••"}
                      </span>
                      <button 
                        onClick={() => setShowPin(!showPin)}
                        style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}
                        title={showPin ? "إخفاء الرقم السري" : "إظهار الرقم السري"}
                      >
                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* صورة بطاقة الهوية مع زر التكبير المريح */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "bold" }}>
                    صورة بطاقة الرقم القومي (للمطابقة العينية):
                  </label>
                  {searchResult.account?.id_card_url && (
                    <button 
                      onClick={() => setZoomedImage(searchResult.account.id_card_url)}
                      style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <Maximize2 size={13} />
                      <span>تكبير الصورة</span>
                    </button>
                  )}
                </div>

                {searchResult.account?.id_card_url ? (
                  <div 
                    onClick={() => setZoomedImage(searchResult.account.id_card_url)}
                    style={{ 
                      borderRadius: "12px", 
                      overflow: "hidden", 
                      border: "2px solid #3b82f6", 
                      height: "200px", 
                      background: "#000",
                      cursor: "zoom-in",
                      position: "relative"
                    }}
                    title="انقر لتكبير البطاقة"
                  >
                    <img 
                      src={searchResult.account.id_card_url} 
                      alt="بطاقة الطالب" 
                      style={{ width: "100%", height: "100%", objectFit: "contain" }} 
                    />
                    <div style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontSize: "10px" }}>
                      انقر للتكبير 🔍
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "16px", borderRadius: "12px", background: "#0d131f", border: "1px dashed #334155", color: "#64748b", textAlign: "center", fontSize: "13px" }}>
                    لم يرفع الطالب صورة بطاقة الهوية بعد!
                  </div>
                )}
              </div>

              {/* أزرار الإجراء: تفعيل رسمي أو رفض التسجيل */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button 
                  onClick={handleActivateStudent}
                  disabled={activatingAnim || loading}
                  style={{
                    background: activatingAnim ? "linear-gradient(135deg, #059669, #047857)" : "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    border: activatingAnim ? "2px solid #34d399" : "none",
                    borderRadius: "14px",
                    padding: "16px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: activatingAnim ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 18px rgba(16, 185, 129, 0.4)",
                    transform: activatingAnim ? "scale(1.02)" : "scale(1)",
                    transition: "all 0.2s"
                  }}
                >
                  <CheckCircle2 size={20} className={activatingAnim ? "spin" : ""} />
                  <span>{activatingAnim ? "✓ تم اعتماد وتفعيل الحساب بنجاح!" : "✅ اعتماد هوية الطالب وتفعيل الحساب فوراً"}</span>
                </button>

                <button 
                  onClick={handleRejectData}
                  disabled={activatingAnim || loading}
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "12px",
                    padding: "12px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <XCircle size={16} />
                  <span>❌ رفض التسجيل (بيانات غير مطابقة للبطاقة)</span>
                </button>
              </div>

            </div>
          ) : (

            /* ========================================================= */
            /* الحالة 3: طالب مسجل ومفعل سابقاً (Already Activated) */
            /* ========================================================= */
            <div>
              
              {/* هيدر الكارت المعتمد */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1.5px solid #1e293b", paddingBottom: "14px", marginBottom: "14px" }}>
                <div>
                  <div style={{ display: "inline-block", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "3px 10px", borderRadius: "14px", fontSize: "11px", fontWeight: "bold", marginBottom: "6px" }}>
                    🛡️ هوية معتمدة ومفعلة مسبقاً
                  </div>
                  <h2 style={{ color: "#fff", fontSize: "19px", fontWeight: "bold", margin: "0 0 4px 0" }}>
                    {searchResult.student?.full_name}
                  </h2>
                  <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold" }}>
                    كود: {formatStudentCode(searchResult.student?.student_code)} • {searchResult.student?.academic_year} (سكشن {searchResult.student?.section || 'عام'})
                  </div>
                </div>

                <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserCheck size={24} />
                </div>
              </div>

              {/* سجل التوثيق والاعتماد السابق */}
              <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "12px", padding: "14px", marginBottom: "14px", color: "#34d399", fontSize: "13px", lineHeight: "1.8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", marginBottom: "4px" }}>
                  <CheckCircle2 size={16} />
                  <span>بيانات التوثيق والاعتماد الرسمي:</span>
                </div>
                <div>👤 <b>تم الاعتماد بواسطة:</b> <span style={{ color: "#fff" }}>{searchResult.account?.activated_by || "منسق معتمد"}</span></div>
                <div>🕒 <b>تاريخ الاعتماد:</b> <span style={{ color: "#fff" }}>{searchResult.account?.activated_at ? new Date(searchResult.account.activated_at).toLocaleString("ar-EG") : "مسجل ومعتمد"}</span></div>
                {searchResult.account?.mobile && (
                  <div>📱 <b>رقم الموبايل المربوط:</b> <span style={{ color: "#fff", direction: "ltr", display: "inline-block" }}>{searchResult.account.mobile}</span></div>
                )}
              </div>

              {/* استعراض الرقم السري بزر الإخفاء/الإظهار */}
              <div style={{ background: "#0d131f", border: "1px solid #1e293b", borderRadius: "12px", padding: "12px 14px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: "11px" }}>الرقم السري الخاص بالطالب (PIN):</div>
                  <div style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: "bold", fontSize: "16px", marginTop: "2px" }}>
                    {showPin ? (searchResult.account?.pin_code || "----") : "••••"}
                  </div>
                </div>
                <button
                  onClick={() => setShowPin(!showPin)}
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    color: "#38bdf8",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showPin ? "إخفاء الرقم" : "إظهار الرقم السري"}</span>
                </button>
              </div>

              {/* صورة البطاقة المعتمدة سلفاً إن وجدت */}
              {searchResult.account?.id_card_url && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ color: "#94a3b8", fontSize: "12px" }}>صورة بطاقة الهوية المحفوظة:</label>
                    <button 
                      onClick={() => setZoomedImage(searchResult.account.id_card_url)}
                      style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "11px" }}
                    >
                      تكبير 🔍
                    </button>
                  </div>
                  <div 
                    onClick={() => setZoomedImage(searchResult.account.id_card_url)}
                    style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #334155", height: "140px", background: "#000", cursor: "zoom-in" }}
                  >
                    <img src={searchResult.account.id_card_url} alt="بطاقة الطالب" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                </div>
              )}

              {/* زر أمان: إنهاء جلسات الأجهزة الأخرى للطالب */}
              <div style={{ marginTop: "14px" }}>
                <button
                  onClick={handleResetSessions}
                  disabled={loading}
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid #3b82f6",
                    color: "#38bdf8",
                    padding: "12px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  <Lock size={16} />
                  <span>🔒 إنهاء جلسات الأجهزة الأخرى وتجديد الأمان</span>
                </button>
                <div style={{ color: "#64748b", fontSize: "11px", textAlign: "center", marginTop: "6px" }}>
                  يستخدم عند تغيير الطالب لهاتفه أو رغبته في تأمين الحساب من أي أجهزة سابقة.
                </div>
              </div>

            </div>
          )}

          {/* زر فحص طالب آخر */}
          <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #1e293b", textAlign: "center" }}>
            <button 
              onClick={() => { setSearchResult(null); setSearchCode(""); setShowPin(false); }}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}
            >
              فحص طالب آخر ↵
            </button>
          </div>

        </div>
      )}

      {/* نافذة تكبير صورة بطاقة الهوية بالحجم الكامل */}
      {zoomedImage && (
        <div 
          onClick={() => setZoomedImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            cursor: "zoom-out"
          }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img 
              src={zoomedImage} 
              alt="بطاقة مكبرة" 
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: "12px", border: "2px solid #38bdf8" }} 
            />
            <div style={{ textAlign: "center", color: "#fff", marginTop: "8px", fontSize: "13px" }}>
              انقر في أي مكان للإغلاق ✕
            </div>
          </div>
        </div>
      )}

      {/* ذيل وتوقيع الصفحة */}
      <footer style={{ textAlign: "center", marginTop: "30px", color: "#64748b", fontSize: "11px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </footer>

    </div>
  );
}
