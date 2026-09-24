"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { 
  ShieldCheck, 
  Search, 
  Camera, 
  CheckCircle2, 
  ChevronLeft,
  XCircle,
  Eye,
  EyeOff,
  Copy,
  QrCode as QrIcon,
  Maximize2,
  Clock,
  Lock,
  UserX,
  Phone,
  KeyRound,
  UserCheck
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
  
  // إخفاء/إظهار الرقم السري
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

  // التحقق من صلاحية المستخدم
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
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        
        setTimeout(() => {
          setActivatingAnim(false);
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

  // 2. رفض البيانات
  const handleRejectData = async () => {
    if (!searchResult?.student?.student_code) return;
    if (!confirm("هل أنت متأكد من رفض بيانات هذا الطالب وحذف تسجيله؟\nسيتعين على الطالب التسجيل مجدداً من الصفر بهاتفه.")) return;

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

  // 3. إنهاء جلسات الأجهزة الأخرى
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

  const startScanner = () => setIsScanning(true);
  const stopScanner = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
    setIsScanning(false);
  };

  return (
    <div style={{ minHeight: "100vh", padding: "12px", maxWidth: "460px", margin: "0 auto", direction: "rtl", boxSizing: "border-box" }}>
      
      {/* هيدر الصفحة المتناسق للهاتف */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "6px" }}>
        <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
          <ChevronLeft size={16} />
          <span>الرئيسية</span>
        </Link>
        <span style={{ color: "#10b981", fontSize: "11px", fontWeight: "bold", background: "rgba(16, 185, 129, 0.12)", padding: "3px 8px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
          مكتب منسقي نظام فنية 🪪
        </span>
      </div>

      {/* بوكس البحث والفحص */}
      <div className="glass-card" style={{ padding: "14px", marginBottom: "14px", borderRadius: "14px" }}>
        
        {/* المنسق الحالي */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldCheck size={18} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "#94a3b8", fontSize: "10px" }}>المنسق المعتمد:</div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {coordinatorName || "منسق معتمد"}
            </div>
          </div>
        </div>

        <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginBottom: "4px" }}>
          اعتماد هوية وتفعيل حساب الطالب
        </div>
        <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "12px", lineHeight: "1.4" }}>
          أدخل كود الطالب أو امسح كود الـ QR بالكاميرا للفحص الفوري:
        </div>

        {/* شريط البحث الموحد: مدعوم 100% لكافة شاشات الموبايل بدون أي تداخل */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", boxSizing: "border-box" }}>
          
          {/* حقل الإدخال */}
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <input 
              id="coordSearchInput"
              type="text"
              placeholder="كود الطالب (0001)..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
              style={{ 
                width: "100%", 
                height: "44px",
                padding: "0 10px", 
                paddingLeft: "26px", 
                background: "#0d131f", 
                border: "1.5px solid #2a374f", 
                borderRadius: "10px", 
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
                style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "12px", padding: 0 }}
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
              height: "44px",
              padding: "0 12px", 
              fontSize: "12px", 
              fontWeight: "bold",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexShrink: 0,
              boxSizing: "border-box"
            }}
          >
            <Search size={15} />
            <span>{loading ? "..." : "فحص"}</span>
          </button>

          {/* زر الكاميرا */}
          <button 
            onClick={isScanning ? stopScanner : startScanner}
            style={{ 
              height: "44px",
              width: "44px",
              background: isScanning ? "#ef4444" : "#1e293b", 
              border: "1.5px solid",
              borderColor: isScanning ? "#ef4444" : "#334155", 
              color: "#fff", 
              borderRadius: "10px", 
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxSizing: "border-box"
            }}
            title={isScanning ? "إغلاق الكاميرا" : "مسح QR بالكاميرا"}
          >
            <Camera size={18} />
          </button>
        </div>

        {/* حاوية الكاميرا لمسح QR */}
        {isScanning && (
          <div style={{ marginTop: "12px", borderRadius: "12px", overflow: "hidden", border: "2px solid #3b82f6" }}>
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
              height="240px"
              compact={true}
              title="ماسح كود الطالب"
            />
          </div>
        )}

      </div>

      {/* =============================================================== */}
      {/* نتيجة فحص هوية الطالب: منسقة خصيصاً للموبايل بدون أي تداخل */}
      {/* =============================================================== */}
      {searchResult && (
        <div className="glass-card animate-fade-in" style={{ padding: "14px", borderRadius: "14px", marginBottom: "16px" }}>
          
          {/* ========================================================= */}
          {/* الحالة 1: غير مسجل في البوابة إطلاقاً */}
          {/* ========================================================= */}
          {!searchResult.registered ? (
            <div style={{ textAlign: "center", padding: "6px 0" }}>
              
              <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "8px", border: "1.5px solid rgba(239, 68, 68, 0.3)" }}>
                <UserX size={26} />
              </div>

              <div style={{ marginBottom: "10px" }}>
                <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" }}>
                  ❌ غير مسجل بالبوابة بعد
                </span>
              </div>

              {/* بيانات الطالب الرسمية */}
              <div style={{ color: "#fff", fontSize: "16px", fontWeight: "bold", marginBottom: "3px", wordBreak: "break-word" }}>
                {searchResult.student?.full_name}
              </div>
              <div style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>
                كود: {formatStudentCode(searchResult.student?.student_code)} • {searchResult.student?.academic_year} (سكشن {searchResult.student?.section || 'عام'})
              </div>

              {/* توجيه المنسق */}
              <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px dashed rgba(239, 68, 68, 0.35)", borderRadius: "10px", padding: "12px", color: "#fca5a5", fontSize: "12px", lineHeight: "1.6", textAlign: "right", marginBottom: "14px" }}>
                ⚠️ <b>تنبيه للمنسق:</b> هذا الطالب مقيد بالكلية، ولكنه <b>لم يسجل حسابه بالبوابة حتى الآن</b>. يجب عليه التسجيل بهاتفه ورفع صورة بطاقة الهوية أولاً ليتمكن المنسق من اعتماده.
              </div>

              {/* أزرار المساعدة */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  onClick={handleCopyLink}
                  style={{
                    width: "100%",
                    background: copiedLink ? "#10b981" : "#1e293b",
                    color: "#fff",
                    border: "1px solid #334155",
                    padding: "11px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <Copy size={15} />
                  <span>{copiedLink ? "✓ تم نسخ الرابط" : "📋 نسخ رابط البوابة للطالب"}</span>
                </button>

                <button
                  onClick={() => setShowRegQr(!showRegQr)}
                  style={{
                    width: "100%",
                    background: "#0f172a",
                    color: "#38bdf8",
                    border: "1px solid #38bdf8",
                    padding: "11px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <QrIcon size={15} />
                  <span>{showRegQr ? "إخفاء كود الـ QR" : "📱 إظهار QR التسجيل ليمسحه الطالب"}</span>
                </button>

                {showRegQr && (
                  <div className="animate-fade-in" style={{ background: "#fff", padding: "14px", borderRadius: "12px", marginTop: "4px", textAlign: "center" }}>
                    <div style={{ display: "inline-block" }}>
                      <QRCode value={getPortalUrl()} size={160} />
                    </div>
                    <div style={{ color: "#000", fontWeight: "bold", fontSize: "11px", marginTop: "8px" }}>
                      وجّه كاميرا موبايل الطالب نحو الكود ليفتح التسجيل فوراً 📲
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : !searchResult.isActivated ? (

            /* ========================================================= */
            /* الحالة 2: مسجل لأول مرة - بانتظار الاعتماد (Pending) */
            /* ========================================================= */
            <div>
              
              {/* هيدر الكارت المباشر */}
              <div style={{ marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
                <span style={{ display: "inline-block", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "3px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: "bold", marginBottom: "6px" }}>
                  ⏳ بانتظار الاعتماد لأول مرة
                </span>
                <div style={{ color: "#fff", fontSize: "17px", fontWeight: "bold", wordBreak: "break-word" }}>
                  {searchResult.student?.full_name}
                </div>
                <div style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "bold", marginTop: "2px" }}>
                  كود: {formatStudentCode(searchResult.student?.student_code)} • {searchResult.student?.academic_year} (سكشن {searchResult.student?.section || 'عام'})
                </div>
              </div>

              {/* بيانات الطالب في صفوف متناسقة تمنع أي تداخل */}
              <div style={{ background: "#0d131f", border: "1px solid #1e293b", borderRadius: "10px", padding: "10px 12px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                
                {/* صف الموبايل */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", borderBottom: "1px solid #1a2336" }}>
                  <span style={{ color: "#94a3b8", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Phone size={13} color="#38bdf8" />
                    <span>رقم الموبايل:</span>
                  </span>
                  <span style={{ color: "#fff", fontWeight: "bold", fontSize: "13px", direction: "ltr" }}>
                    {searchResult.account?.mobile || "غير مدخل"}
                  </span>
                </div>

                {/* صف الرقم السري بزر الإظهار */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#94a3b8", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <KeyRound size={13} color="#f59e0b" />
                    <span>الرقم السري (PIN):</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: "bold", fontSize: "15px" }}>
                      {showPin ? (searchResult.account?.pin_code || "----") : "••••"}
                    </span>
                    <button 
                      onClick={() => setShowPin(!showPin)}
                      style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "3px 7px", borderRadius: "6px", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}
                    >
                      {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{showPin ? "إخفاء" : "إظهار"}</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* معاينة صورة بطاقة الهوية */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ color: "#cbd5e1", fontSize: "11px", fontWeight: "bold" }}>
                    صورة بطاقة الرقم القومي (للمطابقة):
                  </span>
                  {searchResult.account?.id_card_url && (
                    <button 
                      onClick={() => setZoomedImage(searchResult.account.id_card_url)}
                      style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}
                    >
                      <Maximize2 size={12} />
                      <span>تكبير</span>
                    </button>
                  )}
                </div>

                {searchResult.account?.id_card_url ? (
                  <div 
                    onClick={() => setZoomedImage(searchResult.account.id_card_url)}
                    style={{ 
                      borderRadius: "10px", 
                      overflow: "hidden", 
                      border: "1.5px solid #3b82f6", 
                      height: "170px", 
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
                    <div style={{ position: "absolute", bottom: "6px", left: "6px", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 6px", borderRadius: "4px", fontSize: "9px" }}>
                      انقر للتكبير 🔍
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "14px", borderRadius: "10px", background: "#0d131f", border: "1px dashed #334155", color: "#64748b", textAlign: "center", fontSize: "12px" }}>
                    لم يرفع الطالب صورة بطاقة الهوية بعد!
                  </div>
                )}
              </div>

              {/* أزرار الإجراء السريع (تفعيل أو رفض) بنمط عمودي واضح على الهاتف */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button 
                  onClick={handleActivateStudent}
                  disabled={activatingAnim || loading}
                  style={{
                    width: "100%",
                    background: activatingAnim ? "linear-gradient(135deg, #059669, #047857)" : "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    border: activatingAnim ? "2px solid #34d399" : "none",
                    borderRadius: "10px",
                    padding: "13px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: activatingAnim ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                    boxSizing: "border-box"
                  }}
                >
                  <CheckCircle2 size={18} className={activatingAnim ? "spin" : ""} />
                  <span>{activatingAnim ? "✓ تم اعتماد وتفعيل الحساب!" : "✅ اعتماد هوية الطالب وتفعيل حسابه"}</span>
                </button>

                <button 
                  onClick={handleRejectData}
                  disabled={activatingAnim || loading}
                  style={{
                    width: "100%",
                    background: "rgba(239, 68, 68, 0.08)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    borderRadius: "10px",
                    padding: "10px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    boxSizing: "border-box"
                  }}
                >
                  <XCircle size={15} />
                  <span>❌ رفض التسجيل (بيانات غير مطابقة)</span>
                </button>
              </div>

            </div>
          ) : (

            /* ========================================================= */
            /* الحالة 3: طالب مسجل ومفعل سابقاً (Already Activated) */
            /* ========================================================= */
            <div>
              
              {/* هيدر الكارت المعتمد */}
              <div style={{ marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
                <span style={{ display: "inline-block", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "3px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: "bold", marginBottom: "6px" }}>
                  🛡️ هوية معتمدة ومفعلة مسبقاً
                </span>
                <div style={{ color: "#fff", fontSize: "17px", fontWeight: "bold", wordBreak: "break-word" }}>
                  {searchResult.student?.full_name}
                </div>
                <div style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "bold", marginTop: "2px" }}>
                  كود: {formatStudentCode(searchResult.student?.student_code)} • {searchResult.student?.academic_year} (سكشن {searchResult.student?.section || 'عام'})
                </div>
              </div>

              {/* سجل التوثيق الرسمي في صفوف واضحة */}
              <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "10px", padding: "10px 12px", marginBottom: "10px", color: "#34d399", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: "bold", borderBottom: "1px solid rgba(16, 185, 129, 0.15)", paddingBottom: "4px" }}>
                  <CheckCircle2 size={14} />
                  <span>بيانات التوثيق والاعتماد:</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#94a3b8" }}>👤 المنسق المعتمد:</span>
                  <span style={{ color: "#fff", fontWeight: "bold" }}>{searchResult.account?.activated_by || "منسق معتمد"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#94a3b8" }}>🕒 تاريخ الاعتماد:</span>
                  <span style={{ color: "#fff" }}>{searchResult.account?.activated_at ? new Date(searchResult.account.activated_at).toLocaleDateString("ar-EG") : "مسجل ومعتمد"}</span>
                </div>
                {searchResult.account?.mobile && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#94a3b8" }}>📱 الموبايل:</span>
                    <span style={{ color: "#fff", direction: "ltr" }}>{searchResult.account.mobile}</span>
                  </div>
                )}
              </div>

              {/* صف الرقم السري في صف مستقل لمنع أي تصادم */}
              <div style={{ background: "#0d131f", border: "1px solid #1e293b", borderRadius: "10px", padding: "10px 12px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#94a3b8", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <KeyRound size={13} color="#f59e0b" />
                  <span>الرقم السري (PIN):</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: "bold", fontSize: "15px" }}>
                    {showPin ? (searchResult.account?.pin_code || "----") : "••••"}
                  </span>
                  <button
                    onClick={() => setShowPin(!showPin)}
                    style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "3px 7px", borderRadius: "6px", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}
                  >
                    {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{showPin ? "إخفاء" : "إظهار"}</span>
                  </button>
                </div>
              </div>

              {/* صورة البطاقة المحفوظة إن وجدت */}
              {searchResult.account?.id_card_url && (
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>صورة البطاقة المعتمدة:</span>
                    <button 
                      onClick={() => setZoomedImage(searchResult.account.id_card_url)}
                      style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "11px" }}
                    >
                      تكبير 🔍
                    </button>
                  </div>
                  <div 
                    onClick={() => setZoomedImage(searchResult.account.id_card_url)}
                    style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #334155", height: "110px", background: "#000", cursor: "zoom-in" }}
                  >
                    <img src={searchResult.account.id_card_url} alt="بطاقة الطالب" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                </div>
              )}

              {/* زر إنهاء جلسات الأجهزة الأخرى */}
              <button
                onClick={handleResetSessions}
                disabled={loading}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #3b82f6",
                  color: "#38bdf8",
                  padding: "11px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxSizing: "border-box"
                }}
              >
                <Lock size={15} />
                <span>🔒 إنهاء جلسات الأجهزة الأخرى وتجديد الأمان</span>
              </button>

            </div>
          )}

          {/* زر فحص طالب آخر */}
          <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid #1e293b", textAlign: "center" }}>
            <button 
              onClick={() => { setSearchResult(null); setSearchCode(""); setShowPin(false); }}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}
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
          <div style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh" }}>
            <img 
              src={zoomedImage} 
              alt="بطاقة مكبرة" 
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: "10px", border: "2px solid #38bdf8" }} 
            />
            <div style={{ textAlign: "center", color: "#fff", marginTop: "8px", fontSize: "12px" }}>
              انقر في أي مكان للإغلاق ✕
            </div>
          </div>
        </div>
      )}

      {/* ذيل وتوقيع الصفحة */}
      <footer style={{ textAlign: "center", marginTop: "20px", color: "#64748b", fontSize: "10px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </footer>

    </div>
  );
}
