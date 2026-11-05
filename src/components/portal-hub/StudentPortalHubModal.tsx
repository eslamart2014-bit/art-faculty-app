"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/core/supabase";
import {
  Search,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Lock,
  Unlock,
  Camera,
} from "lucide-react";
import { formatStudentCode, extractStudentCode } from "@/lib/students/codeHelper";
import QRScanner from "@/components/scanner/QRScanner";
import { staffFetch } from "@/lib/auth/staffAuthFetch";
import StaffReauthModal from "@/components/auth/StaffReauthModal";
import AdvancedStudentsTab from "@/components/portal-hub/AdvancedStudentsTab";

interface StudentPortalHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onOpenIdentityModal?: () => void;
}

const TELEGRAM_BOT_URL = "https://t.me/NEZAMFANYAbot";

export default function StudentPortalHubModal({
  isOpen,
  onClose,
}: StudentPortalHubModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "advanced_students" | "accounts" | "plagiarism">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (
        window.location.pathname.includes("admin-preview") ||
        p.get("open") === "telegram_students" ||
        p.get("tab") === "advanced_students"
      ) {
        return "advanced_students";
      }
    }
    return "overview";
  });

  const [portalSettings, setPortalSettings] = useState<{
    hide_warnings_tab: boolean;
  }>({ hide_warnings_tab: false });
  const [savingPortalSettings, setSavingPortalSettings] = useState(false);
  const [portalSettingsMsg, setPortalSettingsMsg] = useState("");

  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    registeredAccounts: 0,
    suspendedCount: 0,
    submissionsCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Tab: Account Management (إدارة وبحث الحسابات)
  const [searchAccountCode, setSearchAccountCode] = useState("");
  const [searchingAccount, setSearchingAccount] = useState(false);
  const [inspectedAccount, setInspectedAccount] = useState<any>(null);
  const [accountInspectError, setAccountInspectError] = useState("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [isScanningQr, setIsScanningQr] = useState(false);

  // Plagiarism Audit State
  const [plagiarismData, setPlagiarismData] = useState<any>(null);
  const [loadingPlagiarism, setLoadingPlagiarism] = useState(false);
  const [plagiarismThreshold, setPlagiarismThreshold] = useState<number>(80);
  const [sendingTelegramMatchId, setSendingTelegramMatchId] = useState<string | null>(null);
  const [telegramSentMatches, setTelegramSentMatches] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: true }, "");
      fetchPortalStats();
      fetchPortalSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === "plagiarism" && !plagiarismData && !loadingPlagiarism) {
      fetchPlagiarismData();
    }
  }, [isOpen, activeTab]);

  const fetchPortalSettings = async () => {
    try {
      const res = await staffFetch("/api/admin/portal/settings?_t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json?.settings) {
          setPortalSettings({ hide_warnings_tab: !!json.settings.hide_warnings_tab });
        }
        return;
      }
      const { data } = await supabase
        .from("system_settings")
        .select("telegram_config")
        .eq("id", 1)
        .maybeSingle();
      if (data?.telegram_config) {
        setPortalSettings({
          hide_warnings_tab: !!data.telegram_config.hide_warnings_tab,
        });
      }
    } catch (e) {
      console.error("Error fetching portal settings:", e);
    }
  };

  const savePortalSettings = async (newSettings: typeof portalSettings) => {
    setSavingPortalSettings(true);
    setPortalSettingsMsg("");
    try {
      const res = await staffFetch("/api/admin/portal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || "فشل حفظ الإعدادات");
      }

      setPortalSettings(newSettings);
      setPortalSettingsMsg("✅ تم حفظ الإعدادات بنجاح");
    } catch (e: any) {
      try {
        const { data: current } = await supabase
          .from("system_settings")
          .select("telegram_config")
          .eq("id", 1)
          .maybeSingle();
        const merged = { ...(current?.telegram_config || {}), ...newSettings };
        const { error } = await supabase
          .from("system_settings")
          .update({ telegram_config: merged })
          .eq("id", 1);
        if (error) throw error;
        setPortalSettings(newSettings);
        setPortalSettingsMsg("✅ تم حفظ الإعدادات بنجاح");
      } catch (fallbackErr: any) {
        setPortalSettingsMsg("❌ خطأ في الحفظ: " + (fallbackErr?.message || e?.message || "حاول مجدداً"));
      }
    } finally {
      setSavingPortalSettings(false);
      setTimeout(() => setPortalSettingsMsg(""), 4000);
    }
  };

  const fetchPortalStats = async () => {
    setLoadingStats(true);
    try {
      const res = await staffFetch("/api/admin/portal/stats?_t=" + Date.now(), { cache: "no-store" });
      const data = await res.json();

      if (data && data.success) {
        setStats({
          totalStudents: data.totalStudents || 0,
          registeredAccounts: data.botRegisteredCount ?? data.registeredAccounts ?? 0,
          suspendedCount: data.suspendedCount || 0,
          submissionsCount: data.submissionsCount || 0,
        });
      }
    } catch (e) {
      console.error("Error fetching portal stats:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleInspectAccount = async (codeToInspect?: string) => {
    const code = (codeToInspect || searchAccountCode).trim();
    if (!code) return;

    setSearchingAccount(true);
    setAccountInspectError("");
    setInspectedAccount(null);
    setActionMessage("");

    try {
      const res = await staffFetch(`/api/admin/portal?action=inspect&code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setAccountInspectError(data.error || "تعذر العثور على الطالب");
      } else {
        setInspectedAccount(data);
      }
    } catch {
      setAccountInspectError("خطأ في الاتصال بالخادم");
    } finally {
      setSearchingAccount(false);
    }
  };

  const handleExecuteAccountAction = async (actionType: string, extra?: any) => {
    if (!inspectedAccount?.student?.student_code) return;
    const cleanCode = inspectedAccount.student.student_code;

    if (actionType === "wipe_account" || actionType === "delete_account") {
      const studentName = inspectedAccount.student?.full_name || cleanCode;
      const ok = confirm(
        `⚠️ تأكيد حذف الحساب وفك ربط تليجرام:\nهل أنت متأكد من حذف حساب الطالب (${studentName}) من البوت؟\nسيتم مسح معرف تليجرام المربوط به وإلغاء تسجيله فوراً.`
      );
      if (!ok) return;

      setActionLoading(true);
      try {
        const res = await staffFetch("/api/admin/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_account",
            student_code: cleanCode,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setActionMessage("✓ " + (data.message || "تم حذف الحساب وفك ربط تليجرام بنجاح."));
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
      const res = await staffFetch("/api/admin/portal", {
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
        setTimeout(() => setActionMessage(""), 5000);
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
  };

  const fetchPlagiarismData = async (threshOverride?: number) => {
    const thresh = threshOverride !== undefined ? threshOverride : plagiarismThreshold;
    setLoadingPlagiarism(true);
    try {
      const res = await staffFetch(`/api/admin/portal/plagiarism-audit?threshold=${thresh}`);
      const data = await res.json();
      if (res.ok) {
        setPlagiarismData(data);
      } else {
        alert(data.error || "تعذر إجراء فحص تطابق الأعمال");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setLoadingPlagiarism(false);
    }
  };

  const handleSendTelegramPlagiarismAlert = async (m: any, matchId: string) => {
    try {
      setSendingTelegramMatchId(matchId);
      const res = await staffFetch("/api/admin/portal/notify-plagiarism", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student1: {
            name: m.student1Name || m.student_a?.name || m.studentA?.student_name || "طالب",
            code: m.student1Code || m.student_a?.code || m.studentA?.student_code || "",
            course: m.course1Name || m.student_a?.courseName || m.studentA?.course_name || "",
            project: m.project_name || m.project1Name || "مشروع فني",
            imageUrl: m.image1Url || m.student_a?.imageUrl || m.studentA?.image_url || "",
            submittedAt: m.submitted1At || m.studentA?.submitted_at,
          },
          student2: {
            name: m.student2Name || m.student_b?.name || m.studentB?.student_name || "طالب",
            code: m.student2Code || m.student_b?.code || m.studentB?.student_code || "",
            course: m.course2Name || m.student_b?.courseName || m.studentB?.course_name || "",
            project: m.project_name || m.project2Name || "مشروع فني",
            imageUrl: m.image2Url || m.student_b?.imageUrl || m.studentB?.image_url || "",
            submittedAt: m.submitted2At || m.studentB?.submitted_at,
          },
          similarity: m.similarityPercent || m.similarity || 80,
          hammingDistance: m.hammingDistance,
          reason: m.reason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTelegramSentMatches((prev) => ({ ...prev, [matchId]: true }));
        alert("✅ تم إرسال الإشعار بالصورتين وكامل التفاصيل لبوت التليجرام بنجاح!");
      } else {
        alert("⚠️ خطأ في الإرسال: " + (data.error || "تعذر إرسال التنبيه"));
      }
    } catch (err: any) {
      alert("❌ خطأ: " + err.message);
    } finally {
      setSendingTelegramMatchId(null);
    }
  };

  const handleCopyBotLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(TELEGRAM_BOT_URL);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (!isOpen) return null;

  const isInspectedSuspended =
    inspectedAccount?.student?.is_active === false ||
    inspectedAccount?.account?.status === "suspended";

  const inspectedTgId =
    inspectedAccount?.student?.telegram_id ||
    inspectedAccount?.account?.telegram_id ||
    null;

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
        direction: "rtl",
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
          minHeight: "56px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "#38bdf8", fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🤖</span> إدارة بوت تليجرام للطلاب والتحكم الأكاديمي
          </h3>
          <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
            جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
          </div>
        </div>
        <button onClick={onClose} className="modal-close-btn" title="إغلاق">
          ✕
        </button>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          padding: "10px 16px",
          background: "#0d131f",
          borderBottom: "1px solid #1e293b",
        }}
      >
        {[
          { id: "overview", label: "نظرة عامة وإعدادات البوت 🤖", color: "#38bdf8" },
          { id: "advanced_students", label: "الطلاب المسجلون بالبوت وآخر نشاط ⚡", color: "#10b981" },
          { id: "accounts", label: "بحث وإدارة حساب طالب 👤", color: "#6366f1" },
          { id: "plagiarism", label: "كشف تطابق اللوحات الفنية (AI) 🎨", color: "#f59e0b" },
        ].map((tab) => {
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
                transition: "all 0.2s ease",
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
        {/* التبويب 1: نظرة عامة وإعدادات البوت */}
        {/* ========================================================= */}
        {activeTab === "overview" && (
          <div className="animate-fade-in">
            {/* بطاقات الإحصائيات السريعة */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div style={{ background: "#1a2430", border: "1px solid #1e3a5f", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#90CAF9" }}>إجمالي الطلاب المقيدين</div>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.totalStudents || "--"}
                </div>
              </div>

              <div
                onClick={() => setActiveTab("advanced_students")}
                style={{
                  background: "linear-gradient(135deg, #132b1e, #1a3826)",
                  border: "1.5px solid #22c55e",
                  padding: "14px",
                  borderRadius: "12px",
                  textAlign: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(34, 197, 94, 0.15)",
                }}
                title="انقر لاستعراض الطلاب المسجلين على بوت تليجرام"
              >
                <div style={{ fontSize: "11px", color: "#86efac", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span>المسجلون في بوت تليجرام</span>
                  <span style={{ fontSize: "10px", background: "#15803d", color: "#fff", padding: "1px 5px", borderRadius: "6px" }}>↗ عرض</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.registeredAccounts || "0"}
                </div>
              </div>

              <div style={{ background: "#2a1f14", border: "1px solid #5a3d1e", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#FFB74D" }}>أعمال ومشاريع مرفوعة</div>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {stats.submissionsCount || "0"}
                </div>
              </div>

              <div
                onClick={() => setActiveTab("advanced_students")}
                style={{
                  background: "linear-gradient(135deg, #0d2818, #164024)",
                  border: "1.5px solid #10b981",
                  padding: "14px",
                  borderRadius: "12px",
                  textAlign: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(16, 185, 129, 0.15)",
                }}
              >
                <div style={{ fontSize: "11px", color: "#a7f3d0", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span>سجل نشاط البوت والتحكم</span>
                  <span style={{ fontSize: "10px", background: "#059669", color: "#fff", padding: "1px 5px", borderRadius: "6px" }}>↗ فتح</span>
                </div>
                <div style={{ fontSize: "15px", fontWeight: "bold", color: "#6ee7b7", marginTop: "7px" }}>
                  متابعة وتعليق وحذف ⚡
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <button
                onClick={fetchPortalStats}
                disabled={loadingStats}
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
                  gap: "6px",
                }}
              >
                <RefreshCw size={14} className={loadingStats ? "spin" : ""} />
                <span>{loadingStats ? "جاري التحديث..." : "تحديث الإحصائيات"}</span>
              </button>
            </div>

            {/* القسم 1: رابط بوت تليجرام الرسمي للطلاب */}
            <div
              style={{
                background: "#181d29",
                border: "1px solid #2a374f",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div
                  style={{
                    background: "rgba(34, 158, 217, 0.2)",
                    color: "#38bdf8",
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  🤖
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>
                    بوت تليجرام الرسمي لبوابة الطلاب (@NEZAMFANYAbot)
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                    تم إغلاق كافة الروابط والتطبيقات السابقة وتوجيه جميع الطلاب تلقائياً إلى البوت الرسمي للدخول بالكود ومعرف تليجرام.
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "#101622",
                  border: "1px dashed #334155",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  marginTop: "12px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: "#38bdf8", fontSize: "13.5px", fontFamily: "monospace", direction: "ltr", fontWeight: "bold" }}>
                  {TELEGRAM_BOT_URL}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleCopyBotLink}
                    style={{
                      background: copiedLink ? "#10b981" : "#1e293b",
                      color: "#fff",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {copiedLink ? "✓ تم نسخ رابط البوت" : "📋 نسخ رابط البوت"}
                  </button>
                  <button
                    onClick={() => window.open(TELEGRAM_BOT_URL, "_blank")}
                    style={{
                      background: "linear-gradient(135deg, #2AABEE, #229ED9)",
                      color: "#fff",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    ✈️ فتح البوت في تليجرام
                  </button>
                </div>
              </div>
            </div>

            {/* القسم 2: إعدادات عرض البوابة داخل البوت */}
            <div
              style={{
                background: "#181d29",
                border: "1px solid #2a374f",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>
                    ⚠️ إخفاء تبويب الإنذارات عن الطلاب داخل البوت
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
                    عند التفعيل يختفي تبويب الإنذارات من شاشة الطالب داخل البوت ويظهر له المشاريع والحضور والدواليب فقط.
                  </div>
                </div>
                <button
                  disabled={savingPortalSettings}
                  onClick={() => savePortalSettings({ hide_warnings_tab: !portalSettings.hide_warnings_tab })}
                  style={{
                    background: portalSettings.hide_warnings_tab ? "#10b981" : "#334155",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: savingPortalSettings ? "wait" : "pointer",
                  }}
                >
                  {portalSettings.hide_warnings_tab ? "مفعل (الإنذارات مخفية) ✓" : "غير مفعل (الإنذارات ظاهرة)"}
                </button>
              </div>
              {portalSettingsMsg && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#34d399" }}>
                  {portalSettingsMsg}
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
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ background: "rgba(76, 175, 80, 0.2)", color: "#4CAF50", width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                    🖼️
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>معرض وفحص أعمال ومشاريع الطلاب</div>
                    <div style={{ color: "#888", fontSize: "12px" }}>خاص بالسادة المعيدين والمدرسين لفحص الأعمال والتقييم وتحميل تقرير الـ PDF.</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    window.open("/instructor", "_blank");
                  }}
                  style={{
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  🎨 الانتقال للمعرض
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب 2: الطلاب المسجلون بالبوت وآخر نشاط */}
        {/* ========================================================= */}
        {activeTab === "advanced_students" && (
          <div className="animate-fade-in">
            <AdvancedStudentsTab />
          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب 3: بحث وإدارة حساب طالب */}
        {/* ========================================================= */}
        {activeTab === "accounts" && (
          <div className="animate-fade-in">
            <div style={{ background: "#181d29", border: "1px solid #2a374f", borderRadius: "14px", padding: "18px", marginBottom: "18px" }}>
              <label style={{ display: "block", color: "#38bdf8", fontWeight: "bold", fontSize: "13px", marginBottom: "8px" }}>
                البحث بكود الطالب لإدارة حسابه على البوت (معاينة، تعليق، أو حذف وفك ربط تليجرام):
              </label>

              <div style={{ display: "flex", gap: "8px", width: "100%", alignItems: "stretch", boxSizing: "border-box" }}>
                <input
                  type="text"
                  placeholder="كود الطالب (مثل: 0001)..."
                  value={searchAccountCode}
                  onChange={(e) => setSearchAccountCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInspectAccount();
                  }}
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    width: "100%",
                    height: "44px",
                    padding: "0 12px",
                    background: "#0d131f",
                    border: "1px solid #2a374f",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: "bold",
                    boxSizing: "border-box",
                    margin: 0,
                  }}
                />
                <button
                  type="button"
                  className="btn-compact"
                  onClick={() => handleInspectAccount()}
                  disabled={searchingAccount}
                  style={{
                    width: "auto",
                    minWidth: "80px",
                    maxWidth: "95px",
                    height: "44px",
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    padding: "0 14px",
                    borderRadius: "10px",
                    fontWeight: "bold",
                    fontSize: "13px",
                    cursor: searchingAccount ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    boxSizing: "border-box",
                    margin: 0,
                  }}
                >
                  <Search size={16} />
                  <span>{searchingAccount ? "فحص..." : "فحص"}</span>
                </button>
                <button
                  type="button"
                  className="btn-compact"
                  onClick={() => setIsScanningQr(!isScanningQr)}
                  style={{
                    width: "44px",
                    minWidth: "44px",
                    maxWidth: "44px",
                    height: "44px",
                    background: isScanningQr ? "#ef4444" : "#1e293b",
                    border: "1px solid",
                    borderColor: isScanningQr ? "#ef4444" : "#3b82f6",
                    color: "#fff",
                    borderRadius: "10px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxSizing: "border-box",
                    margin: 0,
                    padding: 0,
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

            {actionMessage && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "12px", borderRadius: "10px", marginBottom: "16px", textAlign: "center", fontSize: "13px" }}>
                {actionMessage}
              </div>
            )}

            {inspectedAccount && (
              <div className="glass-card animate-fade-in" style={{ padding: "20px", borderRadius: "14px", border: "1px solid #2a374f" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #1e293b", paddingBottom: "14px", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h2 style={{ color: "#fff", fontSize: "18px", fontWeight: "bold", margin: "0 0 4px 0" }}>
                      {inspectedAccount.student?.full_name}
                    </h2>
                    <div style={{ color: "#38bdf8", fontSize: "13px" }}>
                      كود: {formatStudentCode(inspectedAccount.student?.student_code)} • {inspectedAccount.student?.academic_year} (سكشن {inspectedAccount.student?.section || "عام"})
                    </div>
                  </div>

                  <div>
                    {isInspectedSuspended ? (
                      <span style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold" }}>
                        حساب معلق ⛔
                      </span>
                    ) : inspectedTgId ? (
                      <span style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.4)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold" }}>
                        مربوط ببوت تليجرام ونشط ✅
                      </span>
                    ) : (
                      <span style={{ background: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1", border: "1px solid rgba(148, 163, 184, 0.3)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold" }}>
                        لم يسجل بالبوت بعد
                      </span>
                    )}
                  </div>
                </div>

                {/* تفاصيل ربط تليجرام وآخر نشاط */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#0d131f", padding: "14px", borderRadius: "12px", marginBottom: "16px", border: "1px solid #1e293b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" }}>
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>معرف تليجرام (Telegram ID):</span>
                    <span style={{ color: "#38bdf8", fontFamily: "monospace", fontWeight: "bold", fontSize: "14px", direction: "ltr" }}>
                      {inspectedTgId || "غير مربوط حالياً"}
                    </span>
                  </div>

                  {inspectedAccount.account?.telegram_username && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" }}>
                      <span style={{ color: "#94a3b8", fontSize: "12px" }}>حساب تليجرام:</span>
                      <span style={{ color: "#fff", fontFamily: "monospace", fontSize: "13px", direction: "ltr" }}>
                        @{inspectedAccount.account.telegram_username}
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>آخر نشاط مسجل:</span>
                    <span style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: "bold" }}>
                      {inspectedAccount.auditLogs?.[0]?.created_at
                        ? new Date(inspectedAccount.auditLogs[0].created_at).toLocaleString("ar-EG")
                        : (inspectedAccount.account?.last_login_at
                          ? new Date(inspectedAccount.account.last_login_at).toLocaleString("ar-EG")
                          : "لا يوجد نشاط مسجل بعد")}
                    </span>
                  </div>
                </div>

                {/* أزرار العمليات الإدارية المباشرة */}
                <div style={{ borderTop: "1px solid #1e293b", paddingTop: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn-compact"
                    onClick={() => {
                      const code = inspectedAccount.student?.student_code;
                      if (code) {
                        window.open(`/system?impersonate=${encodeURIComponent(code)}`, "_blank");
                      }
                    }}
                    style={{
                      width: "100%",
                      margin: 0,
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      border: "1.5px solid #38bdf8",
                      color: "#fff",
                      padding: "12px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      gridColumn: "1 / -1",
                      boxShadow: "0 3px 12px rgba(2, 132, 199, 0.3)",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>👑</span>
                    <span>الدخول لحساب الطالب مباشرة (وضع الإدارة)</span>
                  </button>

                  {isInspectedSuspended ? (
                    <button
                      type="button"
                      className="btn-compact"
                      onClick={() => handleExecuteAccountAction("toggle_status", { status: "active" })}
                      disabled={actionLoading}
                      style={{
                        width: "100%",
                        margin: 0,
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid #10b981",
                        color: "#34d399",
                        padding: "10px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <Unlock size={14} />
                      <span>إلغاء تعليق الحساب وتفعيله</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-compact"
                      onClick={() => handleExecuteAccountAction("toggle_status", { status: "suspended" })}
                      disabled={actionLoading}
                      style={{
                        width: "100%",
                        margin: 0,
                        background: "rgba(245, 158, 11, 0.16)",
                        border: "1px solid #f59e0b",
                        color: "#fde68a",
                        padding: "10px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <Lock size={14} />
                      <span>تعليق الحساب وإيقاف دخوله للبوت</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-compact"
                    onClick={() => handleExecuteAccountAction("reset_submissions")}
                    disabled={actionLoading}
                    style={{
                      width: "100%",
                      margin: 0,
                      background: "#1e293b",
                      border: "1px solid #eab308",
                      color: "#facc15",
                      padding: "10px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>تصفير الأعمال لإعادة الرفع</span>
                  </button>

                  <button
                    type="button"
                    className="btn-compact"
                    onClick={() => handleExecuteAccountAction("delete_account")}
                    disabled={actionLoading}
                    style={{
                      width: "100%",
                      margin: 0,
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1.5px solid #ef4444",
                      color: "#fca5a5",
                      padding: "10px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <Trash2 size={15} />
                    <span>حذف الحساب وفك ربط تليجرام 🗑️</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب 4: كشف تطابق اللوحات الفنية (AI) */}
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
                  فحص دقيق لبصمات الصور (dHash) لكشف أي محاولات رفع لنفس اللوحة أو نسخها بين الطلاب.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "4px 8px" }}>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>عتبة الفحص:</span>
                  <select
                    value={plagiarismThreshold}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPlagiarismThreshold(val);
                      fetchPlagiarismData(val);
                    }}
                    style={{ background: "#0f172a", color: "#fff", border: "1px solid #475569", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                  >
                    <option value={85}>دقة فائقة: تطابق مؤكد (85% فأكثر)</option>
                    <option value={80}>دقة قياسية: اشتباه قوي (80% فأكثر) - موصى به</option>
                    <option value={75}>فحص موسع: اشتباه متوسط (75% فأكثر)</option>
                  </select>
                </div>

                <button
                  onClick={() => fetchPlagiarismData()}
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
                    gap: "6px",
                  }}
                >
                  <RefreshCw size={14} className={loadingPlagiarism ? "spin" : ""} />
                  <span>{loadingPlagiarism ? "جاري الفحص..." : "إعادة الفحص الآن"}</span>
                </button>
              </div>
            </div>

            {loadingPlagiarism ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                <RefreshCw size={28} className="spin" style={{ margin: "0 auto 10px" }} />
                <div>جاري تحليل بصمات اللوحات الفنية عبر الذكاء الاصطناعي...</div>
              </div>
            ) : plagiarismData?.matches?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {plagiarismData.matches.map((m: any, idx: number) => {
                  const img1 = m.image1Url || m.student_a?.imageUrl || m.studentA?.image_url || "";
                  const img2 = m.image2Url || m.student_b?.imageUrl || m.studentB?.image_url || "";
                  const name1 = m.student1Name || m.student_a?.name || m.studentA?.student_name || "طالب";
                  const code1 = m.student1Code || m.student_a?.code || m.studentA?.student_code || "";
                  const name2 = m.student2Name || m.student_b?.name || m.studentB?.student_name || "طالب";
                  const code2 = m.student2Code || m.student_b?.code || m.studentB?.student_code || "";
                  const projectName = m.project_name || m.project1Name || m.studentA?.project_name || "مشروع فني";
                  const course1 = m.course1Name || m.student_a?.courseName || m.studentA?.course_name || "";
                  const course2 = m.course2Name || m.student_b?.courseName || m.studentB?.course_name || "";
                  const hamming = m.hammingDistance ?? Math.round(64 * (1 - (m.similarityPercent || 0) / 100));

                  return (
                    <div key={idx} style={{ background: "#141b29", border: "1px solid #ef4444", borderRadius: "14px", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "14px" }}>
                            {m.tierLabel || `⚠️ تطابق مشبوه بنسبة ${m.similarityPercent}%!`}
                          </span>
                          <span style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" }}>
                            {projectName}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ background: "#ef4444", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" }}>
                            مسافة هامد: {hamming}
                          </span>
                          <span style={{ background: "#1e293b", color: "#38bdf8", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" }}>
                            تشابه {m.similarityPercent}%
                          </span>
                        </div>
                      </div>

                      {m.reason && (
                        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "8px 10px", marginBottom: "12px", fontSize: "11px", color: "#cbd5e1", border: "1px dashed #334155" }}>
                          💡 <b>تشخيص الـ AI:</b> {m.reason}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", textAlign: "center" }}>
                        <div style={{ background: "#0f172a", borderRadius: "10px", padding: "10px", border: "1px solid #1e293b" }}>
                          <div style={{ fontSize: "13px", color: "#fff", fontWeight: "bold", marginBottom: "2px" }}>
                            {name1} {code1 ? `(كود: ${code1})` : ""}
                          </div>
                          {course1 && <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px" }}>{course1}</div>}
                          <div
                            onClick={() => img1 && setZoomedImage(img1)}
                            style={{
                              position: "relative",
                              height: "160px",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: "2px solid #ef4444",
                              background: "#000",
                              cursor: img1 ? "zoom-in" : "default",
                            }}
                          >
                            {img1 && (
                              <img src={img1} alt="عمل الطالب الأول" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0a0a0c" }} />
                            )}
                          </div>
                        </div>

                        <div style={{ background: "#0f172a", borderRadius: "10px", padding: "10px", border: "1px solid #1e293b" }}>
                          <div style={{ fontSize: "13px", color: "#fff", fontWeight: "bold", marginBottom: "2px" }}>
                            {name2} {code2 ? `(كود: ${code2})` : ""}
                          </div>
                          {course2 && <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px" }}>{course2}</div>}
                          <div
                            onClick={() => img2 && setZoomedImage(img2)}
                            style={{
                              position: "relative",
                              height: "160px",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: "2px solid #ef4444",
                              background: "#000",
                              cursor: img2 ? "zoom-in" : "default",
                            }}
                          >
                            {img2 && (
                              <img src={img2} alt="عمل الطالب الثاني" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0a0a0c" }} />
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px dashed #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                          🤖 مراقبة التطابق: يعمل النظام في الخلفية ويرسل تنبيهات تلقائية.
                        </div>
                        <button
                          onClick={() => handleSendTelegramPlagiarismAlert(m, m.id || `match_${idx}`)}
                          disabled={sendingTelegramMatchId === (m.id || `match_${idx}`)}
                          style={{
                            background: telegramSentMatches[m.id || `match_${idx}`] ? "#065f46" : "#2563eb",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 14px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {sendingTelegramMatchId === (m.id || `match_${idx}`)
                            ? "جاري إرسال الصورتين للتليجرام..."
                            : telegramSentMatches[m.id || `match_${idx}`]
                              ? "تم إرسال الصورتين لبوت التليجرام بنجاح ✓"
                              : "📲 إرسال إشعار التليجرام الآن (مع الصورتين)"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ background: "#141b29", border: "1px solid #10b981", padding: "30px", borderRadius: "12px", textAlign: "center" }}>
                <CheckCircle2 size={38} color="#10b981" style={{ margin: "0 auto 10px" }} />
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "16px" }}>جميع الأعمال واللوحات أصلية 100% ✅</div>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "8px", maxWidth: "550px", margin: "8px auto 0", lineHeight: "1.6" }}>
                  لم يعثر محرك الذكاء الاصطناعي على أي شبهة نسخ أو تطابق بين الطلاب (عتبة الفحص الحالية: {plagiarismThreshold}% فأكثر).
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0, 0, 0, 0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            cursor: "zoom-out",
          }}
        >
          <div style={{ position: "absolute", top: "16px", right: "20px", color: "#fff", background: "#ef4444", padding: "6px 14px", borderRadius: "8px", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>
            ✕ إغلاق المعاينة
          </div>
          <img
            src={zoomedImage}
            alt="معاينة مكبرة"
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: "12px", border: "2px solid #38bdf8", objectFit: "contain" }}
          />
        </div>
      )}

      <StaffReauthModal onSuccess={() => { fetchPortalStats(); fetchPortalSettings(); }} />
    </div>
  );
}
