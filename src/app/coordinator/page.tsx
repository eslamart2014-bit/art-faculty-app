"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
  UserCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatStudentCode } from "@/lib/codeHelper";
import { Html5Qrcode } from "html5-qrcode";
import { extractStudentCode } from "@/lib/scannerHelper";

export default function CoordinatorPortalPage() {
  const [user, setUser] = useState<any>(null);
  const [coordinatorName, setCoordinatorName] = useState<string>("");
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activatingAnim, setActivatingAnim] = useState(false);
  const [showActiveDetails, setShowActiveDetails] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // التحقق من صلاحية المستخدم كمنسق
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
        setCoordinatorName(profile.full_name || "منسق النظام");
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
    setShowActiveDetails(false);

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

  // 1. تفعيل حساب الطالب (مع أنيميشن تزايد وسرعة العودة لطالب آخر)
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
        // بعد ثانية واحدة من الأنيميشن، العودة لطالب آخر لسرعة الطابور
        setTimeout(() => {
          setActivatingAnim(false);
          setSearchResult(null);
          setSearchCode("");
          // إذا كانت الكاميرا متاحة يعود لتشغيلها أو التركيز على البحث
          const inputEl = document.getElementById("coordSearchInput");
          if (inputEl) inputEl.focus();
        }, 1000);
      } else {
        setActivatingAnim(false);
        alert(data.error || "تعذر تفعيل الحساب");
      }
    } catch (e: any) {
      setActivatingAnim(false);
      alert("خطأ: " + e.message);
    }
  };

  // 2. رفض البيانات (بيانات خاطئة)
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

  // 3. إظهار بيانات التسجيل وإنهاء جلسات الأجهزة الأخرى لمنع التحايل
  const handleShowRegistrationData = async () => {
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
        setShowActiveDetails(true);
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

  // تشغيل ماسح الـ QR بكاميرا الهاتف
  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      try {
        const scanner = new Html5Qrcode("qr-reader-container", {
          useBarCodeDetectorIfSupported: true,
          verbose: false
        });
        scannerRef.current = scanner;
        scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            const extracted = extractStudentCode(decodedText);
            if (extracted) {
              setSearchCode(extracted);
              stopScanner();
              handleLookup(extracted);
            }
          },
          () => {}
        ).catch(err => {
          console.warn(err);
          alert("تعذر فتح الكاميرا للمسح، يرجى التأكد من منح الإذن.");
          setIsScanning(false);
        });
      } catch (e) {
        console.error(e);
        setIsScanning(false);
      }
    }, 150);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
      } catch (e) {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  return (
    <div style={{ minHeight: "100vh", padding: "16px", maxWidth: "480px", margin: "0 auto" }}>
      
      {/* هيدر الصفحة */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
          <ChevronLeft size={16} />
          <span>الرئيسية</span>
        </Link>
        <span style={{ color: "#10b981", fontSize: "12px", fontWeight: "bold" }}>مكتب منسقي نظام فنية</span>
      </div>

      <div className="glass-card" style={{ padding: "20px", marginBottom: "18px" }}>
        
        {/* المنسق الحالي المسؤول عن الصرف */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "11px" }}>المنسق الحالي المسؤول عن التفعيل:</div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>{coordinatorName || "منسق معتمد"}</div>
          </div>
        </div>

        <h1 style={{ fontSize: "18px", fontWeight: "bold", color: "#fff", marginBottom: "6px" }}>
          اعتماد هوية الطالب وتفعيل حسابه
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px", lineHeight: "1.5" }}>
          قم بمسح كود الطالب بالـ QR أو كتابة الكود للتحقق من هويته وبطاقته وتفعيل حسابه فورياً.
        </p>

        {/* حقل البحث والكاميرا */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input 
              id="coordSearchInput"
              type="text"
              placeholder="أدخل كود الطالب (مثل: 0001)..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
              style={{ width: "100%", padding: "12px", paddingRight: "36px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px" }}
            />
            <Search size={16} style={{ position: "absolute", right: "12px", top: "15px", color: "#64748b" }} />
          </div>

          <button 
            onClick={() => handleLookup()}
            disabled={loading}
            className="btn-primary"
            style={{ padding: "0 18px", fontSize: "13px" }}
          >
            {loading ? "بحث..." : "فحص"}
          </button>

          <button 
            onClick={isScanning ? stopScanner : startScanner}
            style={{ 
              background: isScanning ? "#ef4444" : "#1e293b", 
              border: "1px solid #334155", 
              color: "#fff", 
              borderRadius: "10px", 
              padding: "0 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            title="مسح QR بالكاميرا"
          >
            <Camera size={18} />
          </button>
        </div>

        {/* حاوية الكاميرا لمسح QR */}
        {isScanning && (
          <div style={{ position: "relative", marginBottom: "16px", borderRadius: "14px", overflow: "hidden", border: "2px solid #10b981", background: "#000" }}>
            <div id="qr-reader-container" style={{ width: "100%" }}></div>
            <div style={{ padding: "8px", background: "rgba(0,0,0,0.8)", textAlign: "center", color: "#10b981", fontSize: "12px", fontWeight: "bold" }}>
              وجه الكاميرا نحو كود بطاقة الطالب لمسحه فوراً...
            </div>
            <button 
              onClick={stopScanner}
              style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(239,68,68,0.8)", border: "none", color: "#fff", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
            >
              إغلاق الكاميرا ✕
            </button>
          </div>
        )}

      </div>

      {/* نتيجة الفحص */}
      {searchResult && (
        <div className="glass-card animate-fade-in" style={{ padding: "20px" }}>
          
          {/* 1. حالة غير مسجل في البوابة */}
          {!searchResult.registered ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                <AlertTriangle size={30} />
              </div>
              <h3 style={{ color: "#fff", fontSize: "18px", marginBottom: "6px" }}>{searchResult.student?.full_name}</h3>
              <div style={{ color: "#38bdf8", fontSize: "13px", marginBottom: "14px" }}>
                كود: {searchResult.student?.student_code} • {searchResult.student?.academic_year}
              </div>
              <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.1)", border: "1px dashed #ef4444", color: "#fca5a5", fontSize: "13px", lineHeight: "1.6" }}>
                {searchResult.message}
              </div>
            </div>
          ) : (
            /* 2. حالة مسجل وبانتظار التفعيل أو مفعل مسبقاً */
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", borderBottom: "1px solid #1e293b", paddingBottom: "12px" }}>
                <div>
                  <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: "bold", marginBottom: "2px" }}>
                    {searchResult.student?.full_name}
                  </h3>
                  <div style={{ color: "#38bdf8", fontSize: "12px" }}>
                    كود: {formatStudentCode(searchResult.student?.student_code)} • {searchResult.student?.academic_year} (سكشن {searchResult.student?.section || 'عام'})
                  </div>
                  {searchResult.account?.mobile && (
                    <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
                      موبايل: <span style={{ color: "#fff", direction: "ltr", display: "inline-block" }}>{searchResult.account.mobile}</span>
                    </div>
                  )}
                </div>

                <span style={{ 
                  fontSize: "11px", 
                  padding: "4px 10px", 
                  borderRadius: "12px", 
                  fontWeight: "bold",
                  background: searchResult.isActivated ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                  color: searchResult.isActivated ? "#34d399" : "#fbbf24"
                }}>
                  {searchResult.isActivated ? "✅ مفعل مسبقاً" : "⏳ بانتظار الاعتماد"}
                </span>
              </div>

              {/* إذا كان الحساب مفعلاً مسبقاً */}
              {searchResult.isActivated ? (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid #10b981", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px", color: "#34d399", fontSize: "13px", lineHeight: "1.7" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", marginBottom: "4px" }}>
                      <CheckCircle2 size={16} />
                      <span>بيانات الاعتماد السابقة:</span>
                    </div>
                    <div>👤 <b>تم التفعيل بواسطة:</b> {searchResult.account?.activated_by || "منسق معتمد"}</div>
                    <div>🕒 <b>التاريخ والوقت بالتحديد:</b> {searchResult.account?.activated_at ? new Date(searchResult.account.activated_at).toLocaleString("ar-EG") : "غير مسجل"}</div>
                  </div>

                  <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px dashed #f59e0b", borderRadius: "10px", padding: "12px", marginBottom: "14px", color: "#fbbf24", fontSize: "12px", lineHeight: "1.6" }}>
                    ⚠️ إذا حضر الطالب مدعياً رغبته في مراجعة البيانات أو استرجاع حسابه، يمكنك الضغط بالأسفل لإظهار بياناته مع <b>حذف أي جلسات نشطة له من أي هواتف أخرى لمنع التحايل</b>.
                  </div>

                  {!showActiveDetails ? (
                    <button
                      onClick={handleShowRegistrationData}
                      disabled={loading}
                      className="btn-compact"
                      style={{ width: "100%", padding: "12px", background: "#1e293b", border: "1px solid #38bdf8", color: "#38bdf8", borderRadius: "10px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}
                    >
                      إظهار بيانات التسجيل للطالب 🔄 (وإلغاء جلسات الأجهزة الأخرى)
                    </button>
                  ) : (
                    /* استعراض صورة بطاقة الهوية التي رفعها الطالب */
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                        صورة بطاقة الهوية المرفوعة:
                      </label>
                      {searchResult.account?.id_card_url ? (
                        <div style={{ borderRadius: "12px", overflow: "hidden", border: "2px solid #38bdf8", maxHeight: "200px" }}>
                          <img 
                            src={searchResult.account.id_card_url} 
                            alt="بطاقة الطالب" 
                            style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} 
                          />
                        </div>
                      ) : (
                        <div style={{ padding: "14px", borderRadius: "10px", background: "#0d131f", color: "#64748b", textAlign: "center", fontSize: "12px" }}>
                          لم تسجل صورة بطاقة لهذا الحساب
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* حالة الحساب بانتظار الاعتماد (Pending) */
                <div>
                  {/* استعراض صورة بطاقة الهوية التي رفعها الطالب */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                      صورة بطاقة الهوية المرفوعة بواسطة الطالب (للمطابقة الشخصية العينية):
                    </label>
                    {searchResult.account?.id_card_url ? (
                      <div style={{ borderRadius: "12px", overflow: "hidden", border: "2px solid #38bdf8", maxHeight: "220px" }}>
                        <img 
                          src={searchResult.account.id_card_url} 
                          alt="بطاقة الطالب" 
                          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} 
                        />
                      </div>
                    ) : (
                      <div style={{ padding: "14px", borderRadius: "10px", background: "#0d131f", color: "#64748b", textAlign: "center", fontSize: "12px" }}>
                        لم يتم تسجيل صورة بطاقة لهذا الحساب بعد
                      </div>
                    )}
                  </div>

                  {/* أزرار الإجراء السريع: تفعيل / بيانات خاطئة */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button 
                      onClick={handleActivateStudent}
                      disabled={activatingAnim || loading}
                      style={{
                        background: activatingAnim ? "linear-gradient(135deg, #059669, #047857)" : "linear-gradient(135deg, #10b981, #059669)",
                        color: "#fff",
                        border: activatingAnim ? "2px solid #34d399" : "none",
                        borderRadius: "12px",
                        padding: "16px",
                        fontSize: activatingAnim ? "17px" : "15px",
                        fontWeight: "bold",
                        cursor: activatingAnim ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        boxShadow: activatingAnim ? "0 0 25px rgba(16, 185, 129, 0.8)" : "0 4px 15px rgba(16, 185, 129, 0.3)",
                        transform: activatingAnim ? "scale(1.04)" : "scale(1)",
                        transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)"
                      }}
                    >
                      <CheckCircle2 size={activatingAnim ? 22 : 18} className={activatingAnim ? "animate-bounce" : ""} />
                      <span>{activatingAnim ? "✓ تم تفعيل الحساب بنجاح! جاري الانتقال..." : "تفعيل حساب الطالب ✅"}</span>
                    </button>

                    <button 
                      onClick={handleRejectData}
                      disabled={activatingAnim || loading}
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#f87171",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "10px",
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
                      <span>بيانات خاطئة / رفض التسجيل ❌</span>
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: "12px", textAlign: "center" }}>
                <button 
                  onClick={() => { setSearchResult(null); setSearchCode(""); }}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}
                >
                  فحص طالب آخر
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ذيل وتوقيع الصفحة */}
      <footer style={{ textAlign: "center", marginTop: "30px", color: "#64748b", fontSize: "11px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </footer>

    </div>
  );
}
