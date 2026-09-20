"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Scan, 
  Search, 
  UserCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Copy, 
  Camera, 
  ChevronLeft, 
  Clock, 
  AlertTriangle,
  FileText,
  Smartphone
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { extractStudentCode, formatStudentCode } from "@/lib/codeHelper";

export default function CoordinatorPage() {
  const [coordinatorName, setCoordinatorName] = useState("");
  const [coordinatorsList, setCoordinatorsList] = useState<any[]>([]);
  
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);

  // ماسح الكاميرا
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let nameSet = false;
    try {
      const cached = localStorage.getItem("cached_profile");
      if (cached) {
        const p = JSON.parse(cached);
        if (p.full_name) {
          setCoordinatorName(p.full_name);
          nameSet = true;
        }
      }
    } catch (e) {}

    if (!nameSet) {
      import("@/lib/supabase").then(({ supabase }) => {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase.from("profiles").select("full_name").eq("id", user.id).single().then(({ data }) => {
              if (data?.full_name) setCoordinatorName(data.full_name);
            });
          }
        });
      });
    }
  }, []);

  const handleLookup = async (codeToSearch?: string) => {
    const target = codeToSearch || searchCode;
    if (!target.trim()) return;

    setLoading(true);
    setErrorMsg("");
    setSearchResult(null);

    try {
      const res = await fetch("/api/coordinator/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lookup",
          student_code: target.trim(),
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "لم يتم العثور على الطالب");
      } else {
        setSearchResult(data);
      }
    } catch (e: any) {
      setErrorMsg("خطأ في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  // تأكيد صرف الرقم السري للطالب
  const handleConfirmIssue = async () => {
    if (!searchResult?.student?.student_code) return;

    setLoading(true);
    try {
      const res = await fetch("/api/coordinator/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_pin",
          student_code: searchResult.student.student_code,
          coordinator_name: coordinatorName || "منسق النظام",
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert("تم اعتماد بطاقة الطالب وتأكيد تسليم الرقم السري بنجاح!");
        handleLookup(searchResult.student.student_code);
      } else {
        alert(data.error || "تعذر التسجيل");
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
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
            المنسق الحالي المسؤول عن الصرف:
          </label>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            padding: "10px 14px",
            borderRadius: "10px",
            color: "#38bdf8",
            fontWeight: "bold",
            fontSize: "14px"
          }}>
            <span style={{ fontSize: "16px" }}>👤</span>
            <span>{coordinatorName || "جاري التعرف على الحساب..."}</span>
            <span style={{ marginRight: "auto", fontSize: "11px", background: "rgba(56, 189, 248, 0.2)", padding: "3px 8px", borderRadius: "6px", color: "#7dd3fc" }}>
              منسق معتمد
            </span>
          </div>
        </div>

        {/* خانة إدخال الكود + زر الكاميرا */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
            البحث بكود الطالب أو مسح بطاقة الـ QR:
          </label>
          <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
            <input 
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="اكتب كود الطالب (0001)..."
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              style={{ flex: 1, fontWeight: "bold", height: "46px", boxSizing: "border-box" }}
            />
            <button 
              onClick={() => handleLookup()}
              disabled={loading}
              className="btn-primary"
              style={{ width: "46px", height: "46px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              title="بحث"
            >
              <Search size={20} />
            </button>
            <button 
              onClick={startScanner}
              className="btn-primary"
              style={{ width: "46px", height: "46px", padding: "0", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              title="مسح بالكاميرا"
            >
              <Camera size={20} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{ color: "#f87171", fontSize: "13px", padding: "10px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", textAlign: "center" }}>
            {errorMsg}
          </div>
        )}

      </div>

      {/* نافذة ماسح الـ QR */}
      {isScanning && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ color: "#fff", fontWeight: "bold" }}>امسح كود QR الطالب بالكاميرا</span>
            <button onClick={stopScanner} style={{ background: "#333", border: "none", color: "#fff", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer" }}>✕</button>
          </div>
          <div id="qr-reader-container" style={{ width: "100%", borderRadius: "14px", overflow: "hidden", border: "2px solid #10b981" }} />
        </div>
      )}

      {/* نتائج فحص الطالب */}
      {searchResult && (
        <div className="glass-card animate-fade-in" style={{ padding: "20px" }}>
          
          {/* 1. حالة غير مسجل */}
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
            /* 2. حالة مسجل ولديه بطاقة ورقم سري */
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
                  background: searchResult.account?.is_pin_used ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                  color: searchResult.account?.is_pin_used ? "#34d399" : "#fbbf24"
                }}>
                  {searchResult.account?.is_pin_used ? "مفعل ومستخدم" : "قيد التفعيل"}
                </span>
              </div>

              {/* التحذير الذكي في حال الاستخراج المسبق */}
              {searchResult.warning && (
                <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "10px", padding: "12px", color: "#fca5a5", fontSize: "13px", lineHeight: "1.6", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", marginBottom: "4px" }}>
                    <ShieldAlert size={16} />
                    <span>تنبيه أمني هام للمنسق:</span>
                  </div>
                  {searchResult.warning}
                </div>
              )}

              {/* توثيق بيانات الصرف ومن قام بتسليم الـ PIN وتاريخه بدقة */}
              {searchResult.account?.pin_issued_by && (
                <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid #10b981", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px", color: "#34d399", fontSize: "13px", lineHeight: "1.7" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", marginBottom: "4px" }}>
                    <CheckCircle2 size={16} />
                    <span>بيانات اعتماد وتسليم الـ PIN الموثقة:</span>
                  </div>
                  <div>👤 <b>صُرف بواسطة المنسق:</b> {searchResult.account.pin_issued_by}</div>
                  <div>🕒 <b>تاريخ ووقت الصرف بالتحديد:</b> {searchResult.account.pin_issued_at ? new Date(searchResult.account.pin_issued_at).toLocaleString("ar-EG") : "غير مسجل"}</div>
                </div>
              )}

              {/* استعراض صورة بطاقة الهوية التي رفعها الطالب */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                  صورة بطاقة الهوية المرفوعة بواسطة الطالب (للمطابقة الشخصية):
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
                    لم يتم تسجيل صورة بطاقة لهذا الحساب بعد
                  </div>
                )}
              </div>

              {/* عرض الرقم السري المكون من 8 خانات */}
              <div style={{ background: "#0a0e17", border: "2px dashed #f59e0b", borderRadius: "14px", padding: "16px", textAlign: "center", marginBottom: "16px" }}>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}>الرقم السري المخصص للطالب (8 خانات):</div>
                <div style={{ color: "#f59e0b", fontSize: "28px", fontWeight: "900", fontFamily: "monospace", letterSpacing: "4px", margin: "8px 0" }}>
                  {searchResult.account?.pin_code}
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(searchResult.account?.pin_code || "");
                    alert("تم نسخ الرقم السري إلى الحافظة!");
                  }}
                  className="btn-secondary"
                  style={{ padding: "6px 14px", fontSize: "12px" }}
                >
                  <Copy size={14} />
                  <span>نسخ الرقم السري</span>
                </button>
              </div>

              {/* زر اعتماد وصرف الرقم السري */}
              <button 
                onClick={handleConfirmIssue}
                disabled={loading}
                className="btn-primary"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)", fontSize: "15px" }}
              >
                <CheckCircle2 size={18} />
                <span>تسجيل صرف وتأكيد تسليم الرقم السري للطالب 🔐</span>
              </button>

            </div>
          )}

        </div>
      )}

      <footer style={{ textAlign: "center", paddingTop: "20px", paddingBottom: "16px", color: "#64748b", fontSize: "11px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </footer>
    </div>
  );
}
