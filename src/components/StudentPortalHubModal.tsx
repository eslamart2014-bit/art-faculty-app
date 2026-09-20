"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ShieldAlert, 
  Search, 
  Trash2, 
  Smartphone, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  ExternalLink,
  Users,
  Image as ImageIcon,
  Sparkles
} from "lucide-react";

interface StudentPortalHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onOpenIdentityModal?: () => void;
}

export default function StudentPortalHubModal({
  isOpen,
  onClose,
  user,
  onOpenIdentityModal
}: StudentPortalHubModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "fraud" | "plagiarism" | "wipe">("overview");

  // General Portal Stats
  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    registeredAccounts: 0,
    verifiedCards: 0,
    submissionsCount: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Fraud Detection State
  const [fraudData, setFraudData] = useState<any>(null);
  const [loadingFraud, setLoadingFraud] = useState(false);
  const [fraudFilter, setFraudFilter] = useState("");

  // Plagiarism Audit State
  const [plagiarismData, setPlagiarismData] = useState<any>(null);
  const [loadingPlagiarism, setLoadingPlagiarism] = useState(false);

  // Wipe Account State
  const [searchStudentTerm, setSearchStudentTerm] = useState("");
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [searchedStudent, setSearchedStudent] = useState<any>(null);
  const [wipeReason, setWipeReason] = useState("");
  const [wipingAccount, setWipingAccount] = useState(false);
  const [wipeSuccessMsg, setWipeSuccessMsg] = useState("");
  const [wipeErrorMsg, setWipeErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: true }, "");
      fetchPortalStats();
    }
  }, [isOpen]);

  // Load fraud or plagiarism data on tab switch
  useEffect(() => {
    if (isOpen && activeTab === "fraud" && !fraudData && !loadingFraud) {
      fetchFraudData();
    }
    if (isOpen && activeTab === "plagiarism" && !plagiarismData && !loadingPlagiarism) {
      fetchPlagiarismData();
    }
  }, [isOpen, activeTab]);

  const fetchPortalStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/portal/stats");
      const data = await res.json();

      if (data && data.success) {
        setStats({
          totalStudents: data.totalStudents,
          registeredAccounts: data.registeredAccounts,
          verifiedCards: data.verifiedCards,
          submissionsCount: data.submissionsCount
        });
      } else {
        // Fallback
        const [stRes, accRes, subRes] = await Promise.all([
          supabase.from("students").select("id", { count: "exact", head: true }),
          supabase.from("student_accounts").select("id, id_card_verified", { count: "exact" }),
          supabase.from("student_submissions").select("id", { count: "exact", head: true })
        ]);
        setStats({
          totalStudents: stRes.count || 0,
          registeredAccounts: (accRes as any)?.count || 0,
          verifiedCards: ((accRes as any)?.data || []).filter((a: any) => a.id_card_verified).length || 0,
          submissionsCount: (subRes as any)?.count || 0
        });
      }
    } catch (e) {
      console.error("Error fetching portal stats:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchFraudData = async () => {
    setLoadingFraud(true);
    try {
      const res = await fetch("/api/admin/portal/fraud-detection");
      const data = await res.json();
      if (res.ok) {
        setFraudData(data);
      } else {
        alert(data.error || "تعذر جلب بيانات كشف الاحتيال");
      }
    } catch (err: any) {
      console.error(err);
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setLoadingFraud(false);
    }
  };

  const fetchPlagiarismData = async () => {
    setLoadingPlagiarism(true);
    try {
      const res = await fetch("/api/admin/portal/plagiarism-audit");
      const data = await res.json();
      if (res.ok) {
        setPlagiarismData(data);
      } else {
        alert(data.error || "تعذر إجراء فحص تطابق الأعمال");
      }
    } catch (err: any) {
      console.error(err);
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setLoadingPlagiarism(false);
    }
  };

  const handleSearchStudentToWipe = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const term = (codeOverride || searchStudentTerm).trim();
    if (!term) return;

    setSearchingStudent(true);
    setSearchedStudent(null);
    setWipeSuccessMsg("");
    setWipeErrorMsg("");

    try {
      // جلب بيانات الطالب والفحص الأمني وسجل النشاط
      const res = await fetch(`/api/admin/portal?code=${encodeURIComponent(term)}`);
      const portalData = await res.json();

      if (res.ok && portalData.student) {
        setSearchedStudent({
          ...portalData.student,
          isRegistered: portalData.isRegistered,
          parsedAccount: portalData.account,
          auditLogs: portalData.auditLogs || [],
          deviceSecurity: portalData.deviceSecurity || null,
          submissions: portalData.submissions || []
        });
      } else {
        // Fallback البحث المباشر
        const { data, error } = await supabase
          .from("students")
          .select("id, full_name, student_code, academic_year, section, telegram_browser_id")
          .or(`student_code.eq.${term},full_name.ilike.%${term}%`)
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          setWipeErrorMsg("لم يتم العثور على طالب بهذا الكود أو الاسم.");
        } else {
          let parsedAcc: any = null;
          try {
            if (data.telegram_browser_id) parsedAcc = JSON.parse(data.telegram_browser_id);
          } catch (err) {}
          setSearchedStudent({
            ...data,
            parsedAccount: parsedAcc,
            auditLogs: []
          });
        }
      }
    } catch (err: any) {
      setWipeErrorMsg(err.message || "حدث خطأ أثناء البحث");
    } finally {
      setSearchingStudent(false);
    }
  };

  const handleResetArtworks = async (studentCode: string) => {
    if (!confirm(`هل أنت متأكد تماماً من رغبتك في تصفير وحذف كافة أعمال ومشاريع الطالب (${studentCode})؟\n\nسيتم حذف الصور والتقييمات المسجلة وإتاحة رفع الأعمال من جديد للطالب.`)) return;
    try {
      const res = await fetch("/api/admin/portal/reset-artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_code: studentCode })
      });
      const data = await res.json();
      if (res.ok) {
        setWipeSuccessMsg(data.message || "تم تصفير أعمال الطالب بنجاح");
        handleSearchStudentToWipe(undefined, studentCode);
      } else {
        setWipeErrorMsg(data.error || "تعذر تصفير الأعمال");
      }
    } catch (e: any) {
      setWipeErrorMsg("خطأ: " + e.message);
    }
  };

  const handleToggleSuspend = async (studentCode: string, currentStatus: string) => {
    const newStatus = currentStatus === "suspended" ? "active" : "suspended";
    const confirmMsg = newStatus === "suspended"
      ? `هل أنت متأكد من تعليق حساب الطالب (${studentCode}) مؤقتاً؟\nسيتعذر على الطالب تسجيل الدخول للبوابة حتى يتم فك التعليق من الإدارة.`
      : `هل ترغب في فك تعليق الحساب وتفعيله مجدداً للطالب (${studentCode})؟`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/admin/portal/toggle-suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_code: studentCode, status: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        setWipeSuccessMsg(data.message || "تم تحديث حالة الحساب بنجاح");
        handleSearchStudentToWipe(undefined, studentCode);
      } else {
        setWipeErrorMsg(data.error || "تعذر تحديث الحالة");
      }
    } catch (e: any) {
      setWipeErrorMsg("خطأ: " + e.message);
    }
  };

  const formatAuditAction = (action: string, details: any = {}) => {
    switch (action) {
      case "pin_issued_by_coordinator":
        return `تم اعتماد الهوية وصرف الرقم السري (PIN) بواسطة المنسق (${details?.coordinator || "منسق النظام"})`;
      case "student_registered":
        return "قام الطالب بإنشاء الحساب لأول مرة وتصوير بطاقة الهوية";
      case "student_login":
        return "تسجيل دخول الطالب إلى بوابة النظام";
      case "upload_artwork":
      case "student_submit_project":
        return `رفع عمل فني لمشروع (${details?.project_name || "مشروع"}) بمقرر (${details?.course_name || "مقرر"})`;
      case "allow_retake":
        return `فك قفل المشروع والسماح بإعادة التصوير بواسطة عضو الهيئة المعاونة (${details?.instructor || "المعيد"})`;
      case "account_wiped_by_admin":
      case "account_wiped":
        return `فرمتة الحساب وإلغاء ارتباط الأجهزة بواسطة الإدارة (السبب: ${details?.reason || "طلب إعادة تعيين"})`;
      case "account_suspended":
        return "تم تعليق الحساب مؤقتاً وحظر الدخول بواسطة الإدارة";
      case "account_unsuspended":
        return "تم فك تعليق الحساب واستئناف صلاحية الدخول بواسطة الإدارة";
      case "reset_artworks_by_admin":
      case "admin_reset_submissions":
        return "تم تصفير وحذف كافة الأعمال والمشاريع المرفوعة للطالب بواسطة الإدارة";
      default:
        return action;
    }
  };

  const handleWipeAccountSubmit = async (codeToWipe?: string) => {
    const targetCode = codeToWipe || searchedStudent?.student_code;
    if (!targetCode) return;

    const confirmWipe = confirm(
      `هل أنت متأكد تماماً من رغبتك في فرمتة حساب الطالب (كود: ${targetCode})؟\n\nسيتم إلغاء ارتباط الجهاز ومسح الجلسة والسماح للطالب الأصلي بالتسجيل مجدداً برقم سري جديد.`
    );
    if (!confirmWipe) return;

    setWipingAccount(true);
    setWipeErrorMsg("");
    setWipeSuccessMsg("");

    try {
      const res = await fetch("/api/admin/portal/wipe-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: targetCode,
          reason: wipeReason || "فرمتة الحساب بسبب شبهة احتيال أو انتحال صفة"
        })
      });

      const result = await res.json();
      if (!res.ok) {
        setWipeErrorMsg(result.error || "فشلت عملية الفرمتة");
      } else {
        setWipeSuccessMsg(result.message || "تمت فرمتة الحساب وإعادة تعيينه بنجاح تام.");
        // Re-fetch search if same student
        if (searchedStudent && searchedStudent.student_code === targetCode) {
          setSearchedStudent({
            ...searchedStudent,
            telegram_browser_id: null,
            parsedAccount: null
          });
        }
        // If fraud was loaded, refresh fraud
        if (fraudData) {
          fetchFraudData();
        }
      }
    } catch (err: any) {
      setWipeErrorMsg(err.message || "حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setWipingAccount(false);
    }
  };

  if (!isOpen) return null;

  const getPortalUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/student-portal`;
    }
    return "/student-portal";
  };

  const handleCopyPortalLink = () => {
    const url = getPortalUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const filteredFraudDevices = (fraudData?.fraudDevices || []).filter((dev: any) => {
    if (!fraudFilter.trim()) return true;
    const term = fraudFilter.toLowerCase();
    return (
      dev.phoneModel.toLowerCase().includes(term) ||
      dev.deviceId.toLowerCase().includes(term) ||
      dev.accounts.some((a: any) => 
        a.full_name.toLowerCase().includes(term) || 
        String(a.student_code).includes(term) ||
        (a.mobile && a.mobile.includes(term))
      )
    );
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.85)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        direction: "rtl"
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          background: "#141b29",
          borderBottom: "1px solid #2a374f"
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#38bdf8", fontSize: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>🎓</span> بوابة الطلاب وجناح الأمان الأكاديمي
          </h2>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "3px" }}>
            جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#aaa", fontSize: "26px", cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      {/* Tabs Navigation */}
      <div style={{ 
        display: "flex", 
        flexWrap: "wrap", 
        gap: "8px", 
        padding: "10px 16px", 
        background: "#0d131f", 
        borderBottom: "1px solid #1e293b" 
      }}>
        {[
          { id: "overview", label: "نظرة عامة وروابط 🌐", color: "#38bdf8" },
          { id: "fraud", label: "كشف الاحتيال 🚨", color: "#ef4444" },
          { id: "plagiarism", label: "كشف تطابق الأعمال 🔍", color: "#f59e0b" },
          { id: "wipe", label: "بحث وفرمتة الحسابات 🧹", color: "#a855f7" }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: isActive ? `1px solid ${tab.color}` : "1px solid rgba(255,255,255,0.08)",
                background: isActive ? `${tab.color}22` : "rgba(255,255,255,0.03)",
                color: isActive ? "#fff" : "#94a3b8",
                fontWeight: isActive ? "bold" : "normal",
                cursor: "pointer",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s ease"
              }}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", maxWidth: "900px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        
        {/* ========================================== */}
        {/* TAB 1: OVERVIEW & LINKS */}
        {/* ========================================== */}
        {activeTab === "overview" && (
          <div className="animate-fade-in">
            {/* Quick Stats Banner */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                marginBottom: "20px"
              }}
            >
              <div style={{ background: "#1a2430", border: "1px solid #1e3a5f", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#90CAF9" }}>إجمالي الطلاب</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.totalStudents || "--"}
                </div>
              </div>
              <div style={{ background: "#1a2a1a", border: "1px solid #2e4a2e", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#81C784" }}>حسابات مسجلة بالبوابة</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.registeredAccounts || "0"}
                </div>
              </div>
              <div style={{ background: "#2a1f14", border: "1px solid #5a3d1e", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#FFB74D" }}>أعمال ومشاريع مرفوعة</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.submissionsCount || "0"}
                </div>
              </div>
            </div>

            {/* Section 1: Main Public Student Portal */}
            <div
              style={{
                background: "#181d29",
                border: "1px solid #2a374f",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{ background: "rgba(33, 150, 243, 0.2)", color: "#2196F3", width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                  🎓
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>بوابة الطلاب العامة (الرابط المباشر)</div>
                  <div style={{ color: "#888", fontSize: "12px" }}>البوابة المخصصة للطلبة لاستخراج كارت الـ QR، ومتابعة الحضور، ورفع الأعمال الفنية.</div>
                </div>
              </div>

              <div style={{ background: "#101622", border: "1px dashed #334155", padding: "10px 14px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                <span style={{ color: "#64B5F6", fontSize: "13px", direction: "ltr", wordBreak: "break-all" }}>
                  {getPortalUrl()}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleCopyPortalLink}
                    style={{
                      background: copiedLink ? "#10b981" : "#1e293b",
                      color: "#fff",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    {copiedLink ? "✓ تم النسخ" : "📋 نسخ الرابط"}
                  </button>
                  <button
                    onClick={() => window.open("/student-portal", "_blank")}
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    🌐 فتح البوابة
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Instructor Gallery & Submissions */}
            <div
              style={{
                background: "#181d29",
                border: "1px solid #2a374f",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ background: "rgba(76, 175, 80, 0.2)", color: "#4CAF50", width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                    🖼️
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>معرض وفحص أعمال ومشاريع الطلاب</div>
                    <div style={{ color: "#888", fontSize: "12px" }}>خاص بالسادة المعيدين والمدرسين لفحص الأعمال، فك قفل الصور، والتقييم وتحميل تقرير الـ PDF.</div>
                  </div>
                </div>

                <button
                  onClick={() => { onClose(); window.open("/instructor", "_blank"); }}
                  style={{
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  🎨 الانتقال للمعرض
                </button>
              </div>
            </div>

            {/* Section 3: Identity Verification shortcut */}
            {onOpenIdentityModal && (
              <div
                style={{
                  background: "#181d29",
                  border: "1px solid #2a374f",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "16px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                      🪪
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>إدارة تأكيد هوية الطلاب والرقم السري (PIN)</div>
                      <div style={{ color: "#888", fontSize: "12px" }}>مطابقة بطاقات الرقم القومي ومنح الأرقام السرية لتفعيل حسابات الطلاب.</div>
                    </div>
                  </div>

                  <button
                    onClick={() => { onClose(); onOpenIdentityModal(); }}
                    style={{
                      background: "#f59e0b",
                      color: "#000",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    🔐 فتح نافذة الاعتماد
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: FRAUD DETECTION (كشف الاحتيال) */}
        {/* ========================================== */}
        {activeTab === "fraud" && (
          <div className="animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#f87171", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldAlert size={20} />
                  <span>كشف أجهزة الموبايل المشتركة (شبهة الاحتيال)</span>
                </h3>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  يقوم النظام برصد أي هاتف تم استخدامه لفتح أكثر من حساب طالب، مع توضيح طراز الموبايل ومواعيد الدخول.
                </div>
              </div>

              <button
                onClick={fetchFraudData}
                disabled={loadingFraud}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#fff",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <RefreshCw size={14} className={loadingFraud ? "spin" : ""} />
                <span>{loadingFraud ? "جاري الفحص..." : "إعادة الفحص الآن"}</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "#181d29", padding: "12px", borderRadius: "10px", border: "1px solid #2a374f", textAlign: "center" }}>
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>إجمالي الأجهزة المسجلة</div>
                <div style={{ color: "#38bdf8", fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
                  {fraudData?.totalRegisteredDevices ?? (loadingFraud ? "..." : 0)}
                </div>
              </div>
              <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.3)", textAlign: "center" }}>
                <div style={{ color: "#fca5a5", fontSize: "12px" }}>أجهزة مشبوهة (2+ حساب)</div>
                <div style={{ color: "#ef4444", fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
                  {fraudData?.fraudIncidentsCount ?? (loadingFraud ? "..." : 0)}
                </div>
              </div>
            </div>

            {/* Filter Search */}
            <div style={{ marginBottom: "16px" }}>
              <input
                type="text"
                placeholder="ابحث باسم الطالب، الكود، رقم الهاتف، أو طراز الموبايل..."
                value={fraudFilter}
                onChange={(e) => setFraudFilter(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "8px", color: "#fff", fontSize: "13px" }}
              />
            </div>

            {/* Devices List */}
            {loadingFraud ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                <RefreshCw size={28} className="spin" style={{ margin: "0 auto 10px" }} />
                <div>جاري فحص وتدقيق بصمات الأجهزة المسجلة...</div>
              </div>
            ) : filteredFraudDevices.length === 0 ? (
              <div style={{ background: "#141b29", border: "1px solid #2a374f", padding: "30px", borderRadius: "12px", textAlign: "center" }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 10px" }} />
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>المنظومة آمنة تماماً!</div>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  لم يتم رصد أي هواتف تشترك في فتح أكثر من حساب طالب واحد حالياً.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {filteredFraudDevices.map((dev: any, idx: number) => (
                  <div key={idx} style={{ background: "#141b29", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "14px", padding: "16px" }}>
                    {/* Device Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a374f", paddingBottom: "10px", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>
                            {dev.phoneModel}
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: "11px" }}>
                            أبعاد الشاشة: {dev.screen} • معرف الجهاز: {dev.deviceId.slice(0, 16)}...
                          </div>
                        </div>
                      </div>

                      <span style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", fontSize: "12px", fontWeight: "bold", padding: "4px 10px", borderRadius: "20px" }}>
                        🚨 {dev.accounts.length} طلاب مسجلين على نفس الهاتف!
                      </span>
                    </div>

                    {/* Shared Students List */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {dev.accounts.map((acc: any, aIdx: number) => (
                        <div key={aIdx} style={{ background: "#0d131f", padding: "10px 14px", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", border: "1px solid #1e293b" }}>
                          <div>
                            <div style={{ color: "#e2e8f0", fontWeight: "bold", fontSize: "13px" }}>
                              {acc.full_name}
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: "11px", display: "flex", gap: "8px", marginTop: "2px" }}>
                              <span>كود: {acc.student_code}</span>
                              <span>•</span>
                              <span>الفرقة: {acc.academic_year || "غير محدد"}</span>
                              {acc.mobile && (
                                <>
                                  <span>•</span>
                                  <span>موبايل: {acc.mobile}</span>
                                </>
                              )}
                            </div>
                            <div style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>
                              آخر نشاط: {acc.lastSeen ? new Date(acc.lastSeen).toLocaleString("ar-EG") : "غير متوفر"}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setActiveTab("wipe");
                              setSearchStudentTerm(acc.student_code);
                              handleSearchStudentToWipe();
                            }}
                            style={{
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#f87171",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "bold",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <Trash2 size={13} />
                            <span>فرمتة هذا الحساب</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: PLAGIARISM AUDIT (كشف التلاعب) */}
        {/* ========================================== */}
        {activeTab === "plagiarism" && (
          <div className="animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#fbbf24", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={20} />
                  <span>محرك الفحص الذكي لتطابق الأعمال والمجسمات الفنية</span>
                </h3>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  خوارزمية ذكية تقارن الأعمال الفنية ثنائية وثلاثية الأبعاد حتى لو تم تصويرها بهواتف مختلفة أو إضاءات وزوايا متباينة.
                </div>
              </div>

              <button
                onClick={fetchPlagiarismData}
                disabled={loadingPlagiarism}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#fff",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <RefreshCw size={14} className={loadingPlagiarism ? "spin" : ""} />
                <span>{loadingPlagiarism ? "جاري الفحص..." : "فحص التطابق الآن"}</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "#181d29", padding: "12px", borderRadius: "10px", border: "1px solid #2a374f", textAlign: "center" }}>
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>إجمالي الأعمال المفحوصة</div>
                <div style={{ color: "#38bdf8", fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
                  {plagiarismData?.totalSubmissionsScanned ?? (loadingPlagiarism ? "..." : 0)}
                </div>
              </div>
              <div style={{ background: "rgba(245, 158, 11, 0.1)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(245, 158, 11, 0.3)", textAlign: "center" }}>
                <div style={{ color: "#fde68a", fontSize: "12px" }}>حالات التطابق والاشتباه</div>
                <div style={{ color: "#f59e0b", fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
                  {plagiarismData?.suspiciousMatchesCount ?? (loadingPlagiarism ? "..." : 0)}
                </div>
              </div>
            </div>

            {loadingPlagiarism ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                <RefreshCw size={28} className="spin" style={{ margin: "0 auto 10px" }} />
                <div>جاري تحليل بصمات الصور وتدقيق التطابقات البصرية...</div>
              </div>
            ) : !plagiarismData?.matches || plagiarismData.matches.length === 0 ? (
              <div style={{ background: "#141b29", border: "1px solid #2a374f", padding: "30px", borderRadius: "12px", textAlign: "center" }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 10px" }} />
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>لا توجد أي حالات تطابق مشبوهة!</div>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  كافة الأعمال المرفوعة فريدة ومتباينة ولم ترصد الخوارزمية أي تكرار لنفس العمل الفني بين الطلاب.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {plagiarismData.matches.map((m: any, idx: number) => {
                  const isVeryHigh = m.similarity >= 85;
                  const isHigh = m.similarity >= 70;
                  const badgeColor = isVeryHigh ? "#ef4444" : isHigh ? "#f59e0b" : "#38bdf8";

                  return (
                    <div key={idx} style={{ background: "#141b29", border: `1px solid ${badgeColor}66`, borderRadius: "14px", padding: "16px" }}>
                      {/* Match Score Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ 
                            background: `${badgeColor}22`, 
                            color: badgeColor, 
                            fontWeight: "bold", 
                            fontSize: "13px", 
                            padding: "4px 12px", 
                            borderRadius: "20px",
                            border: `1px solid ${badgeColor}55`
                          }}>
                            {isVeryHigh ? "🚨 تطابق مؤكد بنسبة " : isHigh ? "⚠️ اشتباه قوي بنسبة " : "🔍 تشابه ملحوظ بنسبة "} 
                            {m.similarity}%
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>المشروع: {m.project_name}</span>
                        </div>
                        <div style={{ color: "#64748b", fontSize: "11px" }}>{m.reason}</div>
                      </div>

                      {/* Side by side comparison */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        {/* Student A */}
                        <div style={{ background: "#0d131f", padding: "10px", borderRadius: "10px", border: "1px solid #1e293b" }}>
                          <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "13px" }}>{m.student_a.name}</div>
                          <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "8px" }}>كود: {m.student_a.code}</div>
                          <div style={{ width: "100%", height: "140px", borderRadius: "8px", overflow: "hidden", background: "#000", border: "1px solid #334155" }}>
                            {m.student_a.imageUrl ? (
                              <img src={m.student_a.imageUrl} alt="عمل أ" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            ) : (
                              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>لا توجد صورة</div>
                            )}
                          </div>
                        </div>

                        {/* Student B */}
                        <div style={{ background: "#0d131f", padding: "10px", borderRadius: "10px", border: "1px solid #1e293b" }}>
                          <div style={{ color: "#f472b6", fontWeight: "bold", fontSize: "13px" }}>{m.student_b.name}</div>
                          <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "8px" }}>كود: {m.student_b.code}</div>
                          <div style={{ width: "100%", height: "140px", borderRadius: "8px", overflow: "hidden", background: "#000", border: "1px solid #334155" }}>
                            {m.student_b.imageUrl ? (
                              <img src={m.student_b.imageUrl} alt="عمل ب" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            ) : (
                              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>لا توجد صورة</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: WIPE ACCOUNT (بحث وفرمتة الحسابات) */}
        {/* ========================================== */}
        {activeTab === "wipe" && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#c084fc", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Trash2 size={20} />
                <span>بحث وفرمتة الحسابات المشبوهة (Account Wipe & Reset)</span>
              </h3>
              <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                في حال قام طالب بالتسجيل بحساب زميله أو تم اختراق الكود، يمكنك البحث عن الحساب وفرمتته بالكامل لتمكين الطالب الحقيقي من التسجيل برقم سري جديد.
              </div>
            </div>

            {/* Search Input Box */}
            <form onSubmit={handleSearchStudentToWipe} style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
              <input
                type="text"
                placeholder="أدخل كود الطالب الجامعي أو اسمه..."
                value={searchStudentTerm}
                onChange={(e) => setSearchStudentTerm(e.target.value)}
                style={{ flex: 1, padding: "12px 14px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px" }}
              />
              <button
                type="submit"
                disabled={searchingStudent}
                className="btn-compact"
                style={{
                  background: "#7c3aed",
                  color: "#fff",
                  border: "none",
                  padding: "0 20px",
                  borderRadius: "10px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap"
                }}
              >
                <Search size={16} />
                <span>{searchingStudent ? "جاري البحث..." : "بحث"}</span>
              </button>
            </form>

            {wipeErrorMsg && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px 14px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px" }}>
                ⚠️ {wipeErrorMsg}
              </div>
            )}

            {wipeSuccessMsg && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "10px 14px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px" }}>
                ✓ {wipeSuccessMsg}
              </div>
            )}

            {/* Student Search Result Card */}
            {searchedStudent && (
              <div style={{ background: "#141b29", border: "1px solid #2a374f", borderRadius: "14px", padding: "18px", marginBottom: "16px" }}>
                
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "12px", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "16px" }}>{searchedStudent.full_name}</div>
                    <div style={{ color: "#38bdf8", fontSize: "12px", display: "flex", gap: "8px", marginTop: "2px" }}>
                      <span>كود: {searchedStudent.student_code}</span>
                      <span>•</span>
                      <span>الفرقة: {searchedStudent.academic_year || "غير محدد"}</span>
                      {searchedStudent.section && (
                        <>
                          <span>•</span>
                          <span>السكشن: {searchedStudent.section}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {searchedStudent.parsedAccount?.status === "suspended" ? (
                      <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
                        حساب معلق 🚫
                      </span>
                    ) : (
                      <span style={{ 
                        padding: "4px 10px", 
                        borderRadius: "12px", 
                        fontSize: "12px", 
                        fontWeight: "bold",
                        background: (searchedStudent.telegram_browser_id || searchedStudent.isRegistered) ? "rgba(16, 185, 129, 0.2)" : "rgba(148, 163, 184, 0.2)",
                        color: (searchedStudent.telegram_browser_id || searchedStudent.isRegistered) ? "#34d399" : "#94a3b8"
                      }}>
                        {(searchedStudent.telegram_browser_id || searchedStudent.isRegistered) ? "حساب مسجل ونشط ✅" : "حساب غير مسجل / مفكوك"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Action Buttons (Browse as Student, Reset Artworks, Suspend/Unsuspend) */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px", background: "#0d131f", padding: "10px", borderRadius: "10px", border: "1px solid #1e293b" }}>
                  {/* زر تصفح بحساب الطالب */}
                  <button
                    onClick={() => window.open(`/system?impersonate=${encodeURIComponent(searchedStudent.student_code)}`, "_blank")}
                    className="btn-compact"
                    style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  >
                    <span>👁️</span>
                    <span>تصفح بحساب الطالب</span>
                  </button>

                  {/* زر تصفير الأعمال */}
                  <button
                    onClick={() => handleResetArtworks(searchedStudent.student_code)}
                    className="btn-compact"
                    style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", color: "#fbbf24", padding: "8px 14px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                  >
                    <span>🗑️</span>
                    <span>تصفير كافة الأعمال</span>
                  </button>

                  {/* زر تعليق أو فك تعليق الحساب */}
                  <button
                    onClick={() => handleToggleSuspend(searchedStudent.student_code, searchedStudent.parsedAccount?.status || "active")}
                    className="btn-compact"
                    style={{
                      background: searchedStudent.parsedAccount?.status === "suspended" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      border: `1px solid ${searchedStudent.parsedAccount?.status === "suspended" ? "#10b981" : "#ef4444"}`,
                      color: searchedStudent.parsedAccount?.status === "suspended" ? "#34d399" : "#f87171",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px"
                    }}
                  >
                    <span>{searchedStudent.parsedAccount?.status === "suspended" ? "✅" : "🚫"}</span>
                    <span>{searchedStudent.parsedAccount?.status === "suspended" ? "فك تعليق الحساب" : "تعليق الحساب مؤقتاً"}</span>
                  </button>
                </div>

                {/* Account details */}
                {searchedStudent.parsedAccount ? (
                  <div style={{ background: "#0d131f", padding: "12px 14px", borderRadius: "10px", marginBottom: "14px", fontSize: "12px", color: "#cbd5e1", lineHeight: "1.9" }}>
                    <div>📱 <b>رقم الموبايل المسجل:</b> {searchedStudent.parsedAccount.mobile || "غير مسجل"}</div>
                    <div>🔐 <b>حالة الرقم السري (PIN):</b> {searchedStudent.parsedAccount.is_pin_used ? "تم تفعيله واستخدامه" : "بانتظار التفعيل"} {searchedStudent.parsedAccount.pin_code ? `(الكود: ${searchedStudent.parsedAccount.pin_code})` : ""}</div>
                    <div>🕒 <b>آخر نشاط للدخول:</b> {searchedStudent.parsedAccount.last_login_at ? new Date(searchedStudent.parsedAccount.last_login_at).toLocaleString("ar-EG") : "غير مسجل"}</div>
                    <div>📱 <b>الأجهزة المرتبطة:</b> {searchedStudent.parsedAccount.devices?.length || 1} جهاز</div>
                    {searchedStudent.parsedAccount.devices && searchedStudent.parsedAccount.devices.length > 0 && (
                      <div style={{ marginTop: "6px", color: "#94a3b8", fontSize: "11px", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "6px" }}>
                        {searchedStudent.parsedAccount.devices.map((d: any, dIdx: number) => (
                          <div key={dIdx}>
                            • {d.browser || "متصفح الويب"} على {d.os || "الهاتف"} ({d.screen || "دقة الشاشة"}) - آخر ظهور: {d.lastSeen ? new Date(d.lastSeen).toLocaleDateString("ar-EG") : ""}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ color: "#64748b", fontSize: "11px", marginTop: "6px" }}>
                      💡 كشف نوع نظام التشغيل والمتصفح يتم تلقائياً، بينما يتطلب الـ GPS إذناً من الطالب عبر المتصفح.
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "14px" }}>
                    لا توجد أي أجهزة أو جلسات مسجلة على هذا الحساب حالياً.
                  </div>
                )}

                {/* Activity Log (سجل النشاط المعرب) */}
                {searchedStudent.auditLogs && searchedStudent.auditLogs.length > 0 && (
                  <div style={{ background: "#0d131f", padding: "12px", borderRadius: "10px", marginBottom: "14px", border: "1px solid #1e293b" }}>
                    <div style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>
                      📋 سجل النشاط والتدقيق الأمني:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {searchedStudent.auditLogs.slice(0, 5).map((log: any, lIdx: number) => (
                        <div key={lIdx} style={{ fontSize: "11px", color: "#cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #1e293b", paddingBottom: "4px" }}>
                          <span>• {formatAuditAction(log.action, log.details)}</span>
                          <span style={{ color: "#64748b", fontSize: "10px", whiteSpace: "nowrap" }}>
                            {log.created_at ? new Date(log.created_at).toLocaleString("ar-EG") : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wipe Section */}
                <div style={{ borderTop: "1px solid #1e293b", paddingTop: "14px" }}>
                  <div style={{ color: "#f87171", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
                    ⚠️ فرمتة الحساب بالكامل (Account Wipe):
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "8px" }}>
                    الفرمتة تقوم بإلغاء ارتباط الأجهزة بالكامل ومسح الحساب من البوابة لتمكين الطالب الأصلي من التسجيل برقم سري جديد من الصفر.
                  </div>
                  <input
                    type="text"
                    placeholder="سبب الفرمتة (مثال: تسجيل هاتف غريب / شكوى انتحال صفة من الطالب)"
                    value={wipeReason}
                    onChange={(e) => setWipeReason(e.target.value)}
                    style={{ width: "100%", padding: "10px", background: "#0d131f", border: "1px solid #334155", borderRadius: "8px", color: "#fff", fontSize: "13px", marginBottom: "12px" }}
                  />

                  <button
                    onClick={() => handleWipeAccountSubmit()}
                    disabled={wipingAccount}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "linear-gradient(135deg, #ef4444, #b91c1c)",
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
                    <Trash2 size={16} />
                    <span>{wipingAccount ? "جاري فرمتة الحساب..." : "فرمتة هذا الحساب وإعادة تعيينه بالكامل 🧹"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
