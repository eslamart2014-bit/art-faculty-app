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
  Sparkles,
  Lock,
  Unlock,
  RotateCcw,
  Eye,
  EyeOff,
  UserCheck,
  Maximize2,
  Calendar,
  Clock,
  ChevronRight,
  Filter,
  Camera
} from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";
import QRScanner from "@/components/QRScanner";
import { extractStudentCode } from "@/lib/scannerHelper";

interface StudentPortalHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onOpenIdentityModal?: () => void;
}

function parseDeviceBrand(userAgent?: string, screen?: string): { brand: string; icon: string; osText: string } {
  if (!userAgent || userAgent === 'unknown' || userAgent === 'browser') {
    return { brand: 'هاتف ذكي', icon: '📱', osText: 'متصفح إنترنت محمول' };
  }
  const ua = userAgent.toLowerCase();
  let brand = 'هاتف ذكي / جهاز';
  let icon = '📱';
  let osText = 'متصفح الإنترنت';

  if (ua.includes('iphone')) {
    brand = 'آبل آيفون (Apple iPhone)'; icon = '🍎'; osText = 'نظام iOS';
  } else if (ua.includes('ipad')) {
    brand = 'آبل آيباد (Apple iPad)'; icon = '🍎'; osText = 'نظام iPadOS';
  } else if (ua.includes('samsung') || ua.includes('sm-')) {
    brand = 'سامسونج (Samsung Galaxy)'; icon = '📱'; osText = 'أندرويد Android';
  } else if (ua.includes('redmi') || ua.includes('xiaomi') || ua.includes('poco')) {
    brand = 'شاومي (Xiaomi / Redmi)'; icon = '📱'; osText = 'أندرويد MIUI/HyperOS';
  } else if (ua.includes('oppo') || ua.includes('cph')) {
    brand = 'أوبو (Oppo Mobile)'; icon = '📱'; osText = 'أندرويد ColorOS';
  } else if (ua.includes('vivo') || ua.includes('v2')) {
    brand = 'فيفو (Vivo Mobile)'; icon = '📱'; osText = 'أندرويد Funtouch';
  } else if (ua.includes('realme') || ua.includes('rmx')) {
    brand = 'ريلمي (Realme Mobile)'; icon = '📱'; osText = 'أندرويد RealmeUI';
  } else if (ua.includes('huawei') || ua.includes('honor')) {
    brand = 'هواوي / هونر (Huawei / Honor)'; icon = '📱'; osText = 'أندرويد / EMUI';
  } else if (ua.includes('android')) {
    brand = 'هاتف أندرويد ذكي'; icon = '📱'; osText = 'نظام Android';
  } else if (ua.includes('windows')) {
    brand = 'كمبيوتر شخصي (PC)'; icon = '💻'; osText = 'نظام ويندوز Windows';
  } else if (ua.includes('macintosh') || ua.includes('mac os')) {
    brand = 'جهاز أبل ماك (MacBook / iMac)'; icon = '💻'; osText = 'نظام macOS';
  }
  return { brand, icon, osText };
}

export default function StudentPortalHubModal({
  isOpen,
  onClose,
  user,
  onOpenIdentityModal
}: StudentPortalHubModalProps) {
  // Tabs: overview, accounts, fraud, plagiarism
  const [activeTab, setActiveTab] = useState<"overview" | "accounts" | "fraud" | "plagiarism">("overview");

  // General Portal Stats
  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    registeredAccounts: 0,
    verifiedCards: 0,
    submissionsCount: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Coordinator Stats
  const [coordStats, setCoordStats] = useState<{ totalActivated: number; coordinators: any[] }>({ totalActivated: 0, coordinators: [] });
  const [loadingCoordStats, setLoadingCoordStats] = useState(false);

  // Modal: Registered Accounts List (عند النقر على مربع الإحصائيات)
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [registeredStudentsList, setRegisteredStudentsList] = useState<any[]>([]);
  const [loadingRegisteredList, setLoadingRegisteredList] = useState(false);
  const [accountListFilter, setAccountListFilter] = useState("");

  // Tab: Account Management (إدارة وبحث الحسابات)
  const [searchAccountCode, setSearchAccountCode] = useState("");
  const [searchingAccount, setSearchingAccount] = useState(false);
  const [inspectedAccount, setInspectedAccount] = useState<any>(null);
  const [accountInspectError, setAccountInspectError] = useState("");
  const [showInspectedPin, setShowInspectedPin] = useState(false);
  const [zoomedIdCard, setZoomedIdCard] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [isScanningQr, setIsScanningQr] = useState(false);

  // Fraud Detection State
  const [fraudData, setFraudData] = useState<any>(null);
  const [loadingFraud, setLoadingFraud] = useState(false);
  const [fraudFilter, setFraudFilter] = useState("");

  // Plagiarism Audit State
  const [plagiarismData, setPlagiarismData] = useState<any>(null);
  const [loadingPlagiarism, setLoadingPlagiarism] = useState(false);

  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: true }, "");
      fetchPortalStats();
      fetchCoordinatorStats();
    }
  }, [isOpen]);

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
      const res = await fetch("/api/admin/portal/stats?_t=" + Date.now(), { cache: "no-store" });
      const data = await res.json();

      if (data && data.success) {
        setStats({
          totalStudents: data.totalStudents,
          registeredAccounts: data.registeredAccounts,
          verifiedCards: data.verifiedCards,
          submissionsCount: data.submissionsCount
        });
      }
    } catch (e) {
      console.error("Error fetching portal stats:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchCoordinatorStats = async () => {
    setLoadingCoordStats(true);
    try {
      const res = await fetch("/api/admin/portal/coordinator-stats");
      const data = await res.json();
      if (data && data.success) {
        setCoordStats({
          totalActivated: data.totalActivated || 0,
          coordinators: data.coordinators || []
        });
      }
    } catch (e) {
      console.error("Error fetching coordinator stats:", e);
    } finally {
      setLoadingCoordStats(false);
    }
  };

  // جلب قائمة الحسابات المسجلة للنافذة التفاعلية
  const openRegisteredAccountsModal = async () => {
    setIsAccountsModalOpen(true);
    setAccountListFilter("");
    if (registeredStudentsList.length === 0) {
      setLoadingRegisteredList(true);
      try {
        const res = await fetch("/api/admin/portal/registered-students");
        const data = await res.json();
        if (data && data.success) {
          setRegisteredStudentsList(data.students || []);
        }
      } catch (e) {
        console.error("Error fetching registered students list:", e);
      } finally {
        setLoadingRegisteredList(false);
      }
    }
  };

  // فحص حساب طالب محدد
  const handleInspectAccount = async (codeToInspect?: string) => {
    const code = (codeToInspect || searchAccountCode).trim();
    if (!code) return;

    setSearchingAccount(true);
    setAccountInspectError("");
    setInspectedAccount(null);
    setShowInspectedPin(false);
    setActionMessage("");

    try {
      const res = await fetch(`/api/admin/portal?action=inspect&code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setAccountInspectError(data.error || "تعذر العثور على الطالب");
      } else {
        setInspectedAccount(data);
      }
    } catch (e: any) {
      setAccountInspectError("خطأ في الاتصال بالخادم");
    } finally {
      setSearchingAccount(false);
    }
  };

  // تنفيذ العمليات الإدارية على الحساب (توليد PIN، تعليق، فورمات)
  const handleExecuteAccountAction = async (actionType: string, extra?: any) => {
    if (!inspectedAccount?.student?.student_code) return;
    const cleanCode = inspectedAccount.student.student_code;

    if (actionType === "wipe_account") {
      const ok = confirm(`تحذير أمني هام:\nهل أنت متأكد تماماً من رغبتك في فرمتة وتصفير حساب الطالب (كود: ${cleanCode})؟\n\nسيتم فك ارتباط الجهاز ومسح الجلسة والسماح للطالب بالتسجيل مجدداً.`);
      if (!ok) return;

      setActionLoading(true);
      try {
        const res = await fetch("/api/admin/portal/wipe-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_code: cleanCode,
            reason: "فرمتة الحساب عبر لوحة الإدارة المركزية"
          })
        });
        const data = await res.json();
        if (res.ok) {
          alert("✓ تمت فرمتة الحساب وتصفيره بنجاح.");
          handleInspectAccount(cleanCode);
          fetchPortalStats();
        } else {
          alert(data.error || "فشلت العملية");
        }
      } catch (e: any) {
        alert("خطأ: " + e.message);
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (actionType === "reset_submissions") {
      const ok = confirm("تحذير: هل أنت متأكد من رغبتك في تصفير وحذف جميع أعمال ومشاريع هذا الطالب لإتاحة إعادة الرفع له؟");
      if (!ok) return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          student_code: cleanCode,
          extra,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage(data.message || "تم تنفيذ الإجراء بنجاح");
        setTimeout(() => setActionMessage(""), 4000);
        handleInspectAccount(cleanCode);
      } else {
        alert(data.error || "فشلت العملية");
      }
    } catch (e: any) {
      alert("خطأ: " + e.message);
    } finally {
      setActionLoading(false);
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
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setLoadingPlagiarism(false);
    }
  };

  const getPortalUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/student-portal`;
    }
    return "/student-portal";
  };

  const handleCopyPortalLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(getPortalUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (!isOpen) return null;

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

  const filteredAccountsList = registeredStudentsList.filter((st: any) => {
    if (!accountListFilter.trim()) return true;
    const q = accountListFilter.trim().toLowerCase();
    return (
      (st.student_code && String(st.student_code).includes(q)) ||
      (st.full_name && st.full_name.toLowerCase().includes(q))
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
          padding: "12px 18px",
          background: "#141b29",
          borderBottom: "1px solid #2a374f",
          minHeight: "56px"
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "#38bdf8", fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🎓</span> بوابة الطلاب وجناح الإدارة المركزية
          </h3>
          <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
            جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
          </div>
        </div>
        <button
          onClick={onClose}
          className="modal-close-btn"
          title="إغلاق"
        >
          ✕
        </button>
      </div>

      {/* Tabs Navigation - 100% Arabic & Clean */}
      <div style={{ 
        display: "flex", 
        flexWrap: "wrap", 
        gap: "8px", 
        padding: "10px 16px", 
        background: "#0d131f", 
        borderBottom: "1px solid #1e293b" 
      }}>
        {[
          { id: "overview", label: "نظرة عامة وإحصائيات 🌐", color: "#38bdf8" },
          { id: "accounts", label: "إدارة وبحث الحسابات 👤", color: "#10b981" },
          { id: "fraud", label: "رادار الأجهزة المشتركة 🚨", color: "#ef4444" },
          { id: "plagiarism", label: "كشف تطابق اللوحات الفنية (AI) 🎨", color: "#f59e0b" }
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
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", maxWidth: "920px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        
        {/* ========================================================= */}
        {/* التبويب 1: نظرة عامة وإحصائيات المنظومة */}
        {/* ========================================================= */}
        {activeTab === "overview" && (
          <div className="animate-fade-in">
            
            {/* بطاقات الإحصائيات السريعة */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
                marginBottom: "20px"
              }}
            >
              {/* إجمالي الطلاب في الكشوف */}
              <div style={{ background: "#1a2430", border: "1px solid #1e3a5f", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#90CAF9" }}>إجمالي الطلاب المقيدين</div>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.totalStudents || "--"}
                </div>
              </div>

              {/* حسابات مسجلة بالبوابة (تفاعلي: عند النقر يفتح قائمة الحسابات) */}
              <div 
                onClick={openRegisteredAccountsModal}
                style={{ 
                  background: "linear-gradient(135deg, #132b1e, #1a3826)", 
                  border: "1.5px solid #22c55e", 
                  padding: "14px", 
                  borderRadius: "12px", 
                  textAlign: "center",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: "0 4px 15px rgba(34, 197, 94, 0.15)",
                  transition: "all 0.2s"
                }}
                title="انقر لاستعراض قائمة الحسابات المسجلة بالتفصيل"
              >
                <div style={{ fontSize: "11px", color: "#86efac", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span>حسابات مسجلة بالبوابة</span>
                  <span style={{ fontSize: "10px", background: "#15803d", color: "#fff", padding: "1px 5px", borderRadius: "6px" }}>↗ انقر للعرض</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.registeredAccounts || "0"}
                </div>
              </div>

              {/* أعمال ومشاريع مرفوعة */}
              <div style={{ background: "#2a1f14", border: "1px solid #5a3d1e", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#FFB74D" }}>أعمال ومشاريع مرفوعة</div>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.submissionsCount || "0"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <button
                onClick={() => { fetchPortalStats(); fetchCoordinatorStats(); }}
                disabled={loadingStats || loadingCoordStats}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <RefreshCw size={14} className={(loadingStats || loadingCoordStats) ? "spin" : ""} />
                <span>{(loadingStats || loadingCoordStats) ? "جاري التحديث..." : "تحديث الإحصائيات"}</span>
              </button>
            </div>

            {/* القسم 1: رابط بوابة الطلاب العامة */}
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

            {/* القسم 2: إحصائية اعتماد الحسابات للمنسقين (بديل لوحة الاعتماد السابقة وفق توجيهك) */}
            <div
              style={{
                background: "#181d29",
                border: "1px solid #2a374f",
                borderRadius: "14px",
                padding: "18px",
                marginBottom: "16px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                    🪪
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>إحصائية نشاط واعتماد المنسقين للحسابات</div>
                    <div style={{ color: "#888", fontSize: "12px" }}>بيان بعدد الحسابات التي قام كل منسق باعتمادها وتفعيلها رسمياً للطلاب.</div>
                  </div>
                </div>

                <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "4px 10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold" }}>
                  إجمالي المعتمد: {coordStats.totalActivated} حساب
                </span>
              </div>

              {loadingCoordStats ? (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px" }}>جاري تحميل إحصائيات المنسقين...</div>
              ) : coordStats.coordinators.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>لم يسجل اعتماد حسابات حتى الآن</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {coordStats.coordinators.map((c, idx) => (
                    <div 
                      key={idx}
                      style={{ 
                        background: "#0d131f", 
                        border: "1px solid #1e293b", 
                        borderRadius: "10px", 
                        padding: "12px 14px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "13px" }}>#{idx + 1}</span>
                          <span style={{ color: "#fff", fontWeight: "bold", fontSize: "13px" }}>{c.coordinator_name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#34d399", fontWeight: "bold", fontSize: "13px" }}>{c.count} حساب معتمد</span>
                          <span style={{ color: "#64748b", fontSize: "11px" }}>({c.percentage}%)</span>
                        </div>
                      </div>
                      
                      {/* شريط نسبة بياني هادئ */}
                      <div style={{ width: "100%", height: "6px", background: "#1e293b", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${c.percentage}%`, height: "100%", background: "linear-gradient(90deg, #10b981, #3b82f6)", borderRadius: "4px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* القسم 3: معرض أعمال ومشاريع الطلاب للأساتذة */}
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

          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب 2: إدارة وبحث الحسابات المركزية (مركز شامل للطالب) */}
        {/* ========================================================= */}
        {activeTab === "accounts" && (
          <div className="animate-fade-in">
            
            {/* صندوق البحث الشامل الموحد */}
            <div style={{ background: "#181d29", border: "1px solid #2a374f", borderRadius: "14px", padding: "18px", marginBottom: "18px" }}>
              <label style={{ display: "block", color: "#38bdf8", fontWeight: "bold", fontSize: "13px", marginBottom: "8px" }}>
                البحث بكود الطالب لإدارة حسابه والتحكم في إعداداته:
              </label>
              
              <div style={{ display: "flex", gap: "8px", width: "100%", alignItems: "stretch", boxSizing: "border-box" }}>
                <input
                  type="text"
                  placeholder="كود الطالب (مثل: 0001)..."
                  value={searchAccountCode}
                  onChange={(e) => setSearchAccountCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInspectAccount(); }}
                  style={{ flex: 1, minWidth: 0, height: "44px", padding: "0 12px", background: "#0d131f", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px", fontWeight: "bold", boxSizing: "border-box" }}
                />
                <button
                  onClick={() => handleInspectAccount()}
                  disabled={searchingAccount}
                  style={{ height: "44px", background: "#2563eb", color: "#fff", border: "none", padding: "0 16px", borderRadius: "10px", fontWeight: "bold", fontSize: "13px", cursor: searchingAccount ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", whiteSpace: "nowrap", flexShrink: 0, boxSizing: "border-box" }}
                >
                  <Search size={16} />
                  <span>{searchingAccount ? "فحص..." : "فحص"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsScanningQr(!isScanningQr)}
                  style={{
                    height: "44px",
                    width: "44px",
                    background: isScanningQr ? "#ef4444" : "#1e293b",
                    border: "1px solid",
                    borderColor: isScanningQr ? "#ef4444" : "#3b82f6",
                    color: "#fff",
                    borderRadius: "10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxSizing: "border-box"
                  }}
                  title={isScanningQr ? "إغلاق الكاميرا" : "مسح QR بالكاميرا"}
                >
                  <Camera size={18} />
                </button>
              </div>

              {isScanningQr && (
                <div style={{ marginTop: "12px", borderRadius: "12px", overflow: "hidden", border: "2px solid #3b82f6" }}>
                  <QRScanner
                    onScan={(decoded) => {
                      const clean = extractStudentCode(decoded) || decoded.trim();
                      if (clean) {
                        setSearchAccountCode(clean);
                        setIsScanningQr(false);
                        handleInspectAccount(clean);
                      }
                    }}
                    onClose={() => setIsScanningQr(false)}
                    title="مسح كود الطالب بالكاميرا"
                    height="240px"
                    compact={true}
                  />
                </div>
              )}

              {accountInspectError && (
                <div style={{ marginTop: "10px", color: "#f87171", fontSize: "12px" }}>
                  {accountInspectError}
                </div>
              )}
            </div>

            {/* رسائل نجاح العمليات */}
            {actionMessage && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "12px", borderRadius: "10px", marginBottom: "16px", textAlign: "center", fontSize: "13px" }}>
                {actionMessage}
              </div>
            )}

            {/* كارت عرض وإدارة بيانات الطالب */}
            {inspectedAccount && (
              <div className="glass-card animate-fade-in" style={{ padding: "20px", borderRadius: "14px", border: "1px solid #2a374f" }}>
                
                {/* رأس الكارت والحالة */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #1e293b", paddingBottom: "14px", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h2 style={{ color: "#fff", fontSize: "18px", fontWeight: "bold", margin: "0 0 4px 0" }}>
                      {inspectedAccount.student?.full_name}
                    </h2>
                    <div style={{ color: "#38bdf8", fontSize: "13px" }}>
                      كود: {formatStudentCode(inspectedAccount.student?.student_code)} • {inspectedAccount.student?.academic_year} (سكشن {inspectedAccount.student?.section || 'عام'})
                    </div>
                  </div>

                  <div>
                    {!inspectedAccount.isRegistered ? (
                      <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold" }}>
                        غير مسجل بالبوابة
                      </span>
                    ) : (
                      <span style={{ 
                        fontSize: "11px", 
                        padding: "4px 10px", 
                        borderRadius: "8px", 
                        fontWeight: "bold",
                        background: inspectedAccount.account?.status === 'suspended' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: inspectedAccount.account?.status === 'suspended' ? '#f87171' : '#34d399',
                        border: inspectedAccount.account?.status === 'suspended' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)'
                      }}>
                        {inspectedAccount.account?.status === 'suspended' ? 'حساب معلق 🔒' : 'حساب نشط ومفعل ✅'}
                      </span>
                    )}
                  </div>
                </div>

                {/* التفاصيل الأساسية في شبكة نظيفة */}
                {inspectedAccount.isRegistered && (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#0d131f", padding: "14px", borderRadius: "12px", marginBottom: "16px", border: "1px solid #1e293b" }}>
                      
                      {/* السطر الأول: رقم الموبايل */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>رقم الموبايل:</span>
                        <span style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", direction: "ltr" }}>
                          {inspectedAccount.account?.mobile || "غير مدخل"}
                        </span>
                      </div>

                      {/* السطر الثاني: الرقم السري */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>الرقم السري (PIN):</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: "bold", fontSize: "16px" }}>
                            {showInspectedPin ? (inspectedAccount.account?.pin_code || "----") : "••••"}
                          </span>
                          <button
                            onClick={() => setShowInspectedPin(!showInspectedPin)}
                            style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                            title={showInspectedPin ? "إخفاء" : "إظهار"}
                          >
                            {showInspectedPin ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>{showInspectedPin ? "إخفاء" : "إظهار"}</span>
                          </button>
                        </div>
                      </div>

                      {/* السطر الثالث: المنسق المعتمد */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>المنسق المعتمد:</span>
                        <span style={{ color: "#34d399", fontWeight: "bold", fontSize: "12px" }}>
                          {inspectedAccount.account?.activated_by || inspectedAccount.account?.pin_issued_by || "غير محدد"}
                        </span>
                      </div>

                      {/* السطر الرابع: تاريخ الاعتماد */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>تاريخ الاعتماد:</span>
                        <span style={{ color: "#cbd5e1", fontSize: "12px" }}>
                          {inspectedAccount.account?.activated_at ? new Date(inspectedAccount.account.activated_at).toLocaleString("ar-EG") : "غير مسجل"}
                        </span>
                      </div>
                    </div>

                    {/* الأجهزة المسجلة للطالب */}
                    {inspectedAccount.deviceSecurity?.devices?.length > 0 && (
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                          الأجهزة المسجلة للطالب ({inspectedAccount.deviceSecurity.devices.length}):
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {inspectedAccount.deviceSecurity.devices.map((d: any, idx: number) => {
                            const parsed = parseDeviceBrand(d.userAgent, d.screen);
                            return (
                              <div key={idx} style={{ background: "#0d131f", padding: "10px", borderRadius: "8px", border: "1px solid #1e293b", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span>{parsed.icon}</span>
                                  <span style={{ color: "#fff", fontWeight: "bold" }}>{parsed.brand}</span>
                                </div>
                                <span style={{ color: "#64748b", fontSize: "11px" }}>
                                  {d.lastSeen ? new Date(d.lastSeen).toLocaleString("ar-EG") : "نشط"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* صورة بطاقة الهوية إن وجدت */}
                    {inspectedAccount.account?.id_card_url && (
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <label style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold" }}>صورة بطاقة الهوية:</label>
                          <button
                            onClick={() => setZoomedIdCard(inspectedAccount.account.id_card_url)}
                            style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <Maximize2 size={12} />
                            <span>تكبير</span>
                          </button>
                        </div>
                        <div 
                          onClick={() => setZoomedIdCard(inspectedAccount.account.id_card_url)}
                          style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #334155", height: "130px", background: "#000", cursor: "zoom-in" }}
                        >
                          <img src={inspectedAccount.account.id_card_url} alt="بطاقة الطالب" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        </div>
                      </div>
                    )}

                    {/* أزرار العمليات الإدارية المباشرة (كل التحكم في مكان واحد) */}
                    <div style={{ borderTop: "1px solid #1e293b", paddingTop: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                      
                      {/* زر تعليق أو فك تعليق الحساب */}
                      {inspectedAccount.account?.status === 'suspended' ? (
                        <button
                          onClick={() => handleExecuteAccountAction('toggle_status', { status: 'active' })}
                          disabled={actionLoading}
                          style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          <Unlock size={14} />
                          <span>إلغاء تعليق الحساب</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleExecuteAccountAction('toggle_status', { status: 'suspended' })}
                          disabled={actionLoading}
                          style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          <Lock size={14} />
                          <span>تعليق وقفل الحساب</span>
                        </button>
                      )}

                      {/* زر إعادة توليد رقم سري جديد */}
                      <button
                        onClick={() => handleExecuteAccountAction('reset_pin')}
                        disabled={actionLoading}
                        style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <RotateCcw size={14} />
                        <span>إعادة توليد رقم PIN</span>
                      </button>

                      {/* زر تصفير أعمال الطالب لإعادة الرفع */}
                      <button
                        onClick={() => {
                          if (confirm("هل أنت متأكد من رغبتك في حذف وتصفير جميع أعمال ومشاريع هذا الطالب لإتاحة إعادة التصوير والرفع له؟")) {
                            handleExecuteAccountAction('reset_submissions');
                          }
                        }}
                        disabled={actionLoading}
                        style={{ background: "#1e293b", border: "1px solid #eab308", color: "#facc15", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <RefreshCw size={14} />
                        <span>تصفير الأعمال لإعادة الرفع</span>
                      </button>

                      {/* زر فرمتة وتصفير الحساب */}
                      <button
                        onClick={() => handleExecuteAccountAction('wipe_account')}
                        disabled={actionLoading}
                        style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <Trash2 size={14} />
                        <span>فرمتة وتصفير الحساب</span>
                      </button>

                    </div>
                  </>
                )}

              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب 3: رادار الأجهزة المشتركة (كشف الاحتيال) */}
        {/* ========================================================= */}
        {activeTab === "fraud" && (
          <div className="animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#f87171", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldAlert size={20} />
                  <span>رادار الأجهزة المشتركة (كشف شبهات الدخول)</span>
                </h3>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  رصد أي جهاز هاتف أو كمبيوتر تم استخدامه لفتح أكثر من حساب طالب في نفس الوقت.
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
                <span>{loadingFraud ? "جاري الفحص..." : "إعادة الفحص"}</span>
              </button>
            </div>

            {/* شريط الإحصائيات السريع */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "#181d29", padding: "12px", borderRadius: "10px", border: "1px solid #2a374f", textAlign: "center" }}>
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>إجمالي الأجهزة المسجلة</div>
                <div style={{ color: "#38bdf8", fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
                  {fraudData?.totalRegisteredDevices ?? (loadingFraud ? "..." : 0)}
                </div>
              </div>
              <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.3)", textAlign: "center" }}>
                <div style={{ color: "#fca5a5", fontSize: "12px" }}>أجهزة مشتركة (2+ حساب)</div>
                <div style={{ color: "#ef4444", fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
                  {fraudData?.fraudIncidentsCount ?? (loadingFraud ? "..." : 0)}
                </div>
              </div>
            </div>

            {/* فلتر البحث */}
            <div style={{ marginBottom: "16px" }}>
              <input
                type="text"
                placeholder="ابحث باسم الطالب، الكود، رقم الهاتف، أو طراز الموبايل..."
                value={fraudFilter}
                onChange={(e) => setFraudFilter(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "8px", color: "#fff", fontSize: "13px" }}
              />
            </div>

            {/* قائمة الأجهزة */}
            {loadingFraud ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                <RefreshCw size={28} className="spin" style={{ margin: "0 auto 10px" }} />
                <div>جاري تدقيق بصمات الأجهزة...</div>
              </div>
            ) : filteredFraudDevices.length === 0 ? (
              <div style={{ background: "#141b29", border: "1px solid #2a374f", padding: "30px", borderRadius: "12px", textAlign: "center" }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 10px" }} />
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>المنظومة آمنة تماماً!</div>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  لم يتم رصد أي أجهزة تشترك في فتح أكثر من حساب طالب واحد حالياً.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {filteredFraudDevices.map((dev: any, idx: number) => (
                  <div key={idx} style={{ background: "#141b29", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "14px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a374f", paddingBottom: "10px", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>{dev.phoneModel || "هاتف ذكي"}</div>
                          <div style={{ color: "#64748b", fontSize: "11px" }}>معرف الجهاز: {dev.deviceId}</div>
                        </div>
                      </div>
                      <span style={{ background: "#7f1d1d", color: "#fecaca", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" }}>
                        مشترك بين {dev.accounts.length} طلاب
                      </span>
                    </div>

                    {/* قائمة الطلاب في هذا الجهاز المشترك */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {dev.accounts.map((acc: any, aIdx: number) => (
                        <div key={aIdx} style={{ background: "#0d131f", padding: "10px", borderRadius: "8px", border: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                          <div>
                            <span style={{ color: "#fff", fontWeight: "bold", fontSize: "13px" }}>{acc.full_name}</span>
                            <span style={{ color: "#38bdf8", fontSize: "11px", marginRight: "8px" }}>كود: {acc.student_code}</span>
                            {acc.mobile && <span style={{ color: "#94a3b8", fontSize: "11px", marginRight: "8px", direction: "ltr", display: "inline-block" }}>📱 {acc.mobile}</span>}
                          </div>
                          
                          <button
                            onClick={() => {
                              setActiveTab("accounts");
                              setSearchAccountCode(acc.student_code);
                              handleInspectAccount(acc.student_code);
                            }}
                            style={{ background: "#1e293b", border: "1px solid #3b82f6", color: "#38bdf8", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
                          >
                            فحص الحساب 🔍
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

        {/* ========================================================= */}
        {/* التبويب 4: فحص تشابه اللوحات الفنية (الذكاء الاصطناعي) */}
        {/* ========================================================= */}
        {activeTab === "plagiarism" && (
          <div className="animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#f59e0b", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={20} />
                  <span>كاشف تشابه وتطابق اللوحات الفنية بالذكاء الاصطناعي</span>
                </h3>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  فحص تلقائي لبصمات الصور (dHash) لكشف أي محاولات رفع لنفس اللوحة الفنية بين الطلاب.
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
                <span>{loadingPlagiarism ? "جاري الفحص..." : "إعادة الفحص الآن"}</span>
              </button>
            </div>

            {loadingPlagiarism ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                <RefreshCw size={28} className="spin" style={{ margin: "0 auto 10px" }} />
                <div>جاري تحليل بصمات اللوحات الفنية عبر الذكاء الاصطناعي...</div>
              </div>
            ) : plagiarismData?.matches?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {plagiarismData.matches.map((m: any, idx: number) => (
                  <div key={idx} style={{ background: "#141b29", border: "1px solid #ef4444", borderRadius: "14px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "14px" }}>
                        ⚠️ تطابق مشبوه بنسبة {m.similarityPercent}%!
                      </span>
                      <span style={{ background: "#ef4444", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" }}>
                        مسافة هامد: {m.hammingDistance}
                      </span>
                    </div>

                    {/* مقارنة اللوحتين جنباً إلى جنب */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", textAlign: "center" }}>
                      <div>
                        <div style={{ fontSize: "12px", color: "#fff", fontWeight: "bold", marginBottom: "4px" }}>{m.student1Name} (كود: {m.student1Code})</div>
                        <div style={{ height: "130px", borderRadius: "8px", overflow: "hidden", border: "2px solid #ef4444", background: "#000" }}>
                          <img src={m.image1Url} alt="عمل الطالب الأول" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "12px", color: "#fff", fontWeight: "bold", marginBottom: "4px" }}>{m.student2Name} (كود: {m.student2Code})</div>
                        <div style={{ height: "130px", borderRadius: "8px", overflow: "hidden", border: "2px solid #ef4444", background: "#000" }}>
                          <img src={m.image2Url} alt="عمل الطالب الثاني" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: "#141b29", border: "1px solid #2a374f", padding: "30px", borderRadius: "12px", textAlign: "center" }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 10px" }} />
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>جميع الأعمال أصلية 100%</div>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                  لم يعثر الذكاء الاصطناعي على أي تطابق أو تشابه في بصمات اللوحات بين أي من الطلاب.
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* =============================================================== */}
      {/* النافذة التفاعلية: استعراض الحسابات المسجلة بالبوابة (الميزة 3) */}
      {/* =============================================================== */}
      {isAccountsModalOpen && (
        <div
          onClick={() => setIsAccountsModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#141b29",
              border: "1.5px solid #2a374f",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)"
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 18px", background: "#0d131f", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>📋</span>
                <div>
                  <h3 style={{ margin: 0, color: "#fff", fontSize: "15px", fontWeight: "bold" }}>
                    قائمة حسابات الطلاب المسجلة بالبوابة
                  </h3>
                  <div style={{ color: "#34d399", fontSize: "11px", marginTop: "2px" }}>
                    إجمالي الحسابات: {registeredStudentsList.length} طالب مسجل
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsAccountsModalOpen(false)}
                className="modal-close-btn"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* شريط البحث الفوري */}
            <div style={{ padding: "12px 18px", background: "#0d131f", borderBottom: "1px solid #1e293b" }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو كود الطالب للفلترة الفورية..."
                  value={accountListFilter}
                  onChange={(e) => setAccountListFilter(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", paddingRight: "36px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "8px", color: "#fff", fontSize: "13px" }}
                  autoFocus
                />
                <Search size={16} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
              </div>
            </div>

            {/* محتوى القائمة */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {loadingRegisteredList ? (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px" }}>جاري تحميل قائمة الطلاب...</div>
              ) : filteredAccountsList.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "40px" }}>لا توجد حسابات مطابقة للبحث</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filteredAccountsList.map((st, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "#0d131f",
                        border: "1px solid #1e293b",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px"
                      }}
                    >
                      {/* الاسم والكود فقط */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ background: "rgba(59, 130, 246, 0.15)", color: "#38bdf8", padding: "4px 8px", borderRadius: "6px", fontFamily: "monospace", fontWeight: "bold", fontSize: "13px" }}>
                          {formatStudentCode(st.student_code)}
                        </span>
                        <span style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>
                          {st.full_name}
                        </span>
                      </div>

                      {/* تاريخ التسجيل وآخر زيارة */}
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "11px", color: "#94a3b8" }}>
                        <div title="تاريخ التسجيل على البوابة">
                          <span style={{ color: "#64748b" }}>سجّل في: </span>
                          <span style={{ color: "#cbd5e1" }}>
                            {st.created_at ? new Date(st.created_at).toLocaleDateString("ar-EG") : "غير مسجل"}
                          </span>
                        </div>

                        <div title="آخر مرة زار الحساب">
                          <span style={{ color: "#64748b" }}>آخر زيارة: </span>
                          <span style={{ color: st.last_login_at ? "#34d399" : "#64748b", fontWeight: st.last_login_at ? "bold" : "normal" }}>
                            {st.last_login_at ? new Date(st.last_login_at).toLocaleDateString("ar-EG") : "لم يسجل دخول"}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setIsAccountsModalOpen(false);
                            setActiveTab("accounts");
                            setSearchAccountCode(st.student_code);
                            handleInspectAccount(st.student_code);
                          }}
                          style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "11px" }}
                        >
                          إدارة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "10px 18px", background: "#0d131f", borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#64748b" }}>
              <span>عرض {filteredAccountsList.length} من {registeredStudentsList.length} طالب</span>
              <button
                onClick={() => setIsAccountsModalOpen(false)}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تكبير صورة البطاقة في إدارة الحسابات */}
      {zoomedIdCard && (
        <div 
          onClick={() => setZoomedIdCard(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            cursor: "zoom-out"
          }}
        >
          <img src={zoomedIdCard} alt="بطاقة مكبرة" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: "12px", border: "2px solid #38bdf8" }} />
        </div>
      )}

    </div>
  );
}
