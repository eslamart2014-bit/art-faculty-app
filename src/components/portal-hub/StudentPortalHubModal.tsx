"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/core/supabase";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Camera,
  CheckCircle2,
  Copy,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  Palette,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlock,
  User,
  UserCog,
  X,
  Zap,
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
      setPortalSettingsMsg("تم حفظ الإعدادات بنجاح");
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
        setPortalSettingsMsg("تم حفظ الإعدادات بنجاح");
      } catch (fallbackErr: any) {
        setPortalSettingsMsg("خطأ في الحفظ: " + (fallbackErr?.message || e?.message || "حاول مجدداً"));
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
          setActionMessage(data.message || "تم حذف الحساب وفك ربط تليجرام بنجاح.");
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
        background: "var(--bg-deep)",
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
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          minHeight: "56px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "var(--accent-ink)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
            <Bot size={18} strokeWidth={1.5} style={{ color: "var(--accent-ink)" }} />
            <span>إدارة بوت تليجرام للطلاب والتحكم الأكاديمي</span>
          </h3>
          <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
            جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
          </div>
        </div>
        <button onClick={onClose} className="modal-close-btn" title="إغلاق">
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          padding: "10px 16px",
          background: "var(--background)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {[
          { id: "overview", label: "نظرة عامة وإعدادات البوت", Icon: Bot, color: "var(--accent-ink)", activeBg: "rgba(56, 189, 248, 0.12)" },
          { id: "advanced_students", label: "الطلاب المسجلون بالبوت وآخر نشاط", Icon: Zap, color: "var(--success-ink)", activeBg: "rgba(16, 185, 129, 0.12)" },
          { id: "accounts", label: "بحث وإدارة حساب طالب", Icon: User, color: "var(--primary)", activeBg: "rgba(37, 99, 235, 0.14)" },
          { id: "plagiarism", label: "كشف تطابق اللوحات الفنية (AI)", Icon: Palette, color: "var(--warning-ink)", activeBg: "rgba(245, 158, 11, 0.12)" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: isActive ? `1px solid ${tab.color}` : "1px solid var(--border)",
                background: isActive ? tab.activeBg : "var(--surface)",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease",
              }}
            >
              <TabIcon size={15} strokeWidth={1.5} style={{ color: isActive ? tab.color : "var(--text-muted)" }} />
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
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--accent-ink)" }}>إجمالي الطلاب المقيدين</div>
                <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", marginTop: "4px" }}>
                  {stats.totalStudents || "--"}
                </div>
              </div>

              <div
                onClick={() => setActiveTab("advanced_students")}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--success)",
                  padding: "14px",
                  borderRadius: "12px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
                title="انقر لاستعراض الطلاب المسجلين على بوت تليجرام"
              >
                <div style={{ fontSize: "11px", color: "var(--success-ink)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span>المسجلون في بوت تليجرام</span>
                  <span style={{ fontSize: "10px", background: "var(--success)", color: "#fff", padding: "1px 6px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                    <ArrowUpRight size={11} strokeWidth={1.5} />
                    <span>عرض</span>
                  </span>
                </div>
                <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-primary)", marginTop: "4px" }}>
                  {stats.registeredAccounts || "0"}
                </div>
              </div>

              <div style={{ background: "var(--surface)", border: "1px solid rgba(245, 158, 11, 0.35)", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--warning-ink)" }}>أعمال ومشاريع مرفوعة</div>
                <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", marginTop: "4px" }}>
                  {stats.submissionsCount || "0"}
                </div>
              </div>

              <div
                onClick={() => setActiveTab("advanced_students")}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--success)",
                  padding: "14px",
                  borderRadius: "12px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "11px", color: "var(--success-ink)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span>سجل نشاط البوت والتحكم</span>
                  <span style={{ fontSize: "10px", background: "var(--success)", color: "#fff", padding: "1px 6px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                    <ArrowUpRight size={11} strokeWidth={1.5} />
                    <span>فتح</span>
                  </span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--success-ink)", marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <span>متابعة وتعليق وحذف</span>
                  <Zap size={14} strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <button
                onClick={fetchPortalStats}
                disabled={loadingStats}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RefreshCw size={14} strokeWidth={1.5} className={loadingStats ? "spin" : ""} />
                <span>{loadingStats ? "جاري التحديث..." : "تحديث الإحصائيات"}</span>
              </button>
            </div>

            {/* القسم 1: رابط بوت تليجرام الرسمي للطلاب */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div
                  style={{
                    background: "rgba(56, 189, 248, 0.14)",
                    color: "var(--accent-ink)",
                    width: "38px",
                    height: "38px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Bot size={20} strokeWidth={1.5} />
                </div>
                <div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "15px" }}>
                    بوت تليجرام الرسمي لبوابة الطلاب (@NEZAMFANYAbot)
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    تم إغلاق كافة الروابط والتطبيقات السابقة وتوجيه جميع الطلاب تلقائياً إلى البوت الرسمي للدخول بالكود ومعرف تليجرام.
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "var(--bg-deep)",
                  border: "1px dashed var(--border-light)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  marginTop: "12px",
                  flexWrap: "wrap",
                }}
              >
                <span className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "13px", fontFamily: "monospace", direction: "ltr", fontWeight: 600 }}>
                  {TELEGRAM_BOT_URL}
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={handleCopyBotLink}
                    style={{
                      background: copiedLink ? "var(--success)" : "var(--surface-hover)",
                      color: "#fff",
                      border: "1px solid var(--border)",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {copiedLink ? <CheckCircle2 size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
                    <span>{copiedLink ? "تم نسخ رابط البوت" : "نسخ رابط البوت"}</span>
                  </button>
                  <button
                    onClick={() => window.open(TELEGRAM_BOT_URL, "_blank")}
                    style={{
                      background: "var(--primary)",
                      color: "#fff",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Send size={14} strokeWidth={1.5} />
                    <span>فتح البوت في تليجرام</span>
                  </button>
                </div>
              </div>
            </div>

            {/* القسم 2: إعدادات عرض البوابة داخل البوت */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={16} strokeWidth={1.5} style={{ color: "var(--warning-ink)" }} />
                    <span>إخفاء تبويب الإنذارات عن الطلاب داخل البوت</span>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>
                    عند التفعيل يختفي تبويب الإنذارات من شاشة الطالب داخل البوت ويظهر له المشاريع والحضور والدواليب فقط.
                  </div>
                </div>
                <button
                  disabled={savingPortalSettings}
                  onClick={() => savePortalSettings({ hide_warnings_tab: !portalSettings.hide_warnings_tab })}
                  style={{
                    background: portalSettings.hide_warnings_tab ? "var(--success)" : "var(--surface-hover)",
                    color: "#fff",
                    border: "1px solid var(--border)",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: savingPortalSettings ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {portalSettings.hide_warnings_tab && <CheckCircle2 size={14} strokeWidth={1.5} />}
                  <span>{portalSettings.hide_warnings_tab ? "مفعل (الإنذارات مخفية)" : "غير مفعل (الإنذارات ظاهرة)"}</span>
                </button>
              </div>
              {portalSettingsMsg && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--success-ink)" }}>
                  {portalSettingsMsg}
                </div>
              )}
            </div>

            {/* القسم 3: معرض أعمال ومشاريع الطلاب للأساتذة */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.14)", color: "var(--success-ink)", width: "38px", height: "38px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ImageIcon size={20} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "15px" }}>معرض وفحص أعمال ومشاريع الطلاب</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>خاص بالسادة المعيدين والمدرسين لفحص الأعمال والتقييم وتحميل تقرير الـ PDF.</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    window.open("/instructor", "_blank");
                  }}
                  style={{
                    background: "var(--success)",
                    color: "#fff",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Palette size={15} strokeWidth={1.5} />
                  <span>الانتقال للمعرض</span>
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
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px", marginBottom: "18px" }}>
              <label style={{ display: "block", color: "var(--accent-ink)", fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>
                البحث بكود الطالب لإدارة حسابه على البوت (معاينة، تعليق، أو حذف وفك ربط تليجرام):
              </label>

              <div style={{ display: "flex", gap: "8px", width: "100%", alignItems: "stretch", boxSizing: "border-box" }}>
                <input
                  type="text"
                  className="tabular-nums"
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
                    height: "42px",
                    padding: "0 12px",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    fontWeight: 500,
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
                    height: "42px",
                    background: "var(--primary)",
                    color: "#fff",
                    border: "none",
                    padding: "0 14px",
                    borderRadius: "8px",
                    fontWeight: 600,
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
                  <Search size={15} strokeWidth={1.5} />
                  <span>{searchingAccount ? "فحص..." : "فحص"}</span>
                </button>
                <button
                  type="button"
                  className="btn-compact"
                  onClick={() => setIsScanningQr(!isScanningQr)}
                  style={{
                    width: "42px",
                    minWidth: "42px",
                    maxWidth: "42px",
                    height: "42px",
                    background: isScanningQr ? "var(--error)" : "var(--surface-hover)",
                    border: "1px solid",
                    borderColor: isScanningQr ? "var(--error)" : "var(--primary)",
                    color: "#fff",
                    borderRadius: "8px",
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
                  <Camera size={17} strokeWidth={1.5} />
                </button>
              </div>

              {isScanningQr && (
                <div style={{ marginTop: "12px", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--primary)" }}>
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
                <div style={{ marginTop: "10px", color: "var(--error-ink)", fontSize: "12px" }}>
                  {accountInspectError}
                </div>
              )}
            </div>

            {actionMessage && (
              <div style={{ background: "rgba(16, 185, 129, 0.14)", border: "1px solid var(--success)", color: "var(--success-ink)", padding: "12px", borderRadius: "8px", marginBottom: "16px", textAlign: "center", fontSize: "13px" }}>
                {actionMessage}
              </div>
            )}

            {inspectedAccount && (
              <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: "14px", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h2 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 600, margin: "0 0 4px 0" }}>
                      {inspectedAccount.student?.full_name}
                    </h2>
                    <div className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "13px" }}>
                      كود: {formatStudentCode(inspectedAccount.student?.student_code)} • {inspectedAccount.student?.academic_year} (سكشن {inspectedAccount.student?.section || "عام"})
                    </div>
                  </div>

                  <div>
                    {isInspectedSuspended ? (
                      <span style={{ background: "rgba(239, 68, 68, 0.14)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.4)", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <ShieldAlert size={12} strokeWidth={1.5} />
                        <span>حساب معلق</span>
                      </span>
                    ) : inspectedTgId ? (
                      <span style={{ background: "rgba(16, 185, 129, 0.14)", color: "var(--success-ink)", border: "1px solid rgba(16, 185, 129, 0.4)", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={12} strokeWidth={1.5} />
                        <span>مربوط ببوت تليجرام ونشط</span>
                      </span>
                    ) : (
                      <span style={{ background: "rgba(148, 163, 184, 0.14)", color: "var(--text-muted)", border: "1px solid var(--border-light)", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                        لم يسجل بالبوت بعد
                      </span>
                    )}
                  </div>
                </div>

                {/* تفاصيل ربط تليجرام وآخر نشاط */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-deep)", padding: "14px", borderRadius: "8px", marginBottom: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>معرف تليجرام (Telegram ID):</span>
                    <span className="tabular-nums" style={{ color: "var(--accent-ink)", fontFamily: "monospace", fontWeight: 600, fontSize: "14px", direction: "ltr" }}>
                      {inspectedTgId || "غير مربوط حالياً"}
                    </span>
                  </div>

                  {inspectedAccount.account?.telegram_username && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>حساب تليجرام:</span>
                      <span style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: "13px", direction: "ltr" }}>
                        @{inspectedAccount.account.telegram_username}
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>آخر نشاط مسجل:</span>
                    <span className="tabular-nums" style={{ color: "var(--text-primary)", fontSize: "12px", fontWeight: 600 }}>
                      {inspectedAccount.auditLogs?.[0]?.created_at
                        ? new Date(inspectedAccount.auditLogs[0].created_at).toLocaleString("ar-EG")
                        : (inspectedAccount.account?.last_login_at
                          ? new Date(inspectedAccount.account.last_login_at).toLocaleString("ar-EG")
                          : "لا يوجد نشاط مسجل بعد")}
                    </span>
                  </div>
                </div>

                {/* أزرار العمليات الإدارية المباشرة */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
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
                      background: "var(--primary)",
                      border: "1px solid var(--accent-ink)",
                      color: "#fff",
                      padding: "11px 12px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      gridColumn: "1 / -1",
                    }}
                  >
                    <UserCog size={16} strokeWidth={1.5} />
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
                        background: "rgba(16, 185, 129, 0.14)",
                        border: "1px solid var(--success)",
                        color: "var(--success-ink)",
                        padding: "10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <Unlock size={14} strokeWidth={1.5} />
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
                        background: "rgba(245, 158, 11, 0.14)",
                        border: "1px solid var(--warning)",
                        color: "var(--warning-ink)",
                        padding: "10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <Lock size={14} strokeWidth={1.5} />
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
                      background: "var(--surface-hover)",
                      border: "1px solid var(--warning)",
                      color: "var(--warning-ink)",
                      padding: "10px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <RefreshCw size={14} strokeWidth={1.5} />
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
                      background: "rgba(239, 68, 68, 0.16)",
                      border: "1px solid var(--error)",
                      color: "var(--error-ink)",
                      padding: "10px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                    <span>حذف الحساب وفك ربط تليجرام</span>
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
                <h3 style={{ margin: 0, color: "var(--warning-ink)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={19} strokeWidth={1.5} />
                  <span>كاشف تشابه وتطابق اللوحات الفنية بالذكاء الاصطناعي</span>
                </h3>
                <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>
                  فحص دقيق لبصمات الصور (dHash) لكشف أي محاولات رفع لنفس اللوحة أو نسخها بين الطلاب.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "4px 8px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>عتبة الفحص:</span>
                  <select
                    className="tabular-nums"
                    value={plagiarismThreshold}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPlagiarismThreshold(val);
                      fetchPlagiarismData(val);
                    }}
                    style={{ background: "var(--bg-deep)", color: "var(--text-primary)", border: "1px solid var(--border-light)", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
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
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <RefreshCw size={14} strokeWidth={1.5} className={loadingPlagiarism ? "spin" : ""} />
                  <span>{loadingPlagiarism ? "جاري الفحص..." : "إعادة الفحص الآن"}</span>
                </button>
              </div>
            </div>

            {loadingPlagiarism ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                <RefreshCw size={28} strokeWidth={1.5} className="spin" style={{ margin: "0 auto 10px" }} />
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
                    <div key={idx} style={{ background: "var(--surface)", border: "1px solid var(--error)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="tabular-nums" style={{ color: "var(--error-ink)", fontWeight: 600, fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                            <AlertTriangle size={15} strokeWidth={1.5} />
                            <span>{m.tierLabel || `تطابق مشبوه بنسبة ${m.similarityPercent}%`}</span>
                          </span>
                          <span style={{ background: "rgba(239, 68, 68, 0.16)", color: "var(--error-ink)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                            {projectName}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="tabular-nums" style={{ background: "var(--error)", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                            مسافة هامد: {hamming}
                          </span>
                          <span className="tabular-nums" style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--accent-ink)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                            تشابه {m.similarityPercent}%
                          </span>
                        </div>
                      </div>

                      {m.reason && (
                        <div style={{ background: "var(--bg-deep)", borderRadius: "8px", padding: "8px 10px", marginBottom: "12px", fontSize: "11px", color: "var(--text-primary)", border: "1px dashed var(--border-light)", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Lightbulb size={13} strokeWidth={1.5} style={{ color: "var(--warning-ink)", flexShrink: 0 }} />
                          <span><b style={{ fontWeight: 600 }}>تشخيص الـ AI:</b> {m.reason}</span>
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", textAlign: "center" }}>
                        <div style={{ background: "var(--bg-deep)", borderRadius: "8px", padding: "10px", border: "1px solid var(--border)" }}>
                          <div className="tabular-nums" style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600, marginBottom: "2px" }}>
                            {name1} {code1 ? `(كود: ${code1})` : ""}
                          </div>
                          {course1 && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>{course1}</div>}
                          <div
                            onClick={() => img1 && setZoomedImage(img1)}
                            style={{
                              position: "relative",
                              height: "160px",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: "1px solid var(--error)",
                              background: "#000",
                              cursor: img1 ? "zoom-in" : "default",
                            }}
                          >
                            {img1 && (
                              <img src={img1} alt="عمل الطالب الأول" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0a0a0c" }} />
                            )}
                          </div>
                        </div>

                        <div style={{ background: "var(--bg-deep)", borderRadius: "8px", padding: "10px", border: "1px solid var(--border)" }}>
                          <div className="tabular-nums" style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600, marginBottom: "2px" }}>
                            {name2} {code2 ? `(كود: ${code2})` : ""}
                          </div>
                          {course2 && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>{course2}</div>}
                          <div
                            onClick={() => img2 && setZoomedImage(img2)}
                            style={{
                              position: "relative",
                              height: "160px",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: "1px solid var(--error)",
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

                      <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Bot size={13} strokeWidth={1.5} style={{ color: "var(--accent-ink)" }} />
                          <span>مراقبة التطابق: يعمل النظام في الخلفية ويرسل تنبيهات تلقائية.</span>
                        </div>
                        <button
                          onClick={() => handleSendTelegramPlagiarismAlert(m, m.id || `match_${idx}`)}
                          disabled={sendingTelegramMatchId === (m.id || `match_${idx}`)}
                          style={{
                            background: telegramSentMatches[m.id || `match_${idx}`] ? "var(--success)" : "var(--primary)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {sendingTelegramMatchId === (m.id || `match_${idx}`) ? (
                            <span>جاري إرسال الصورتين للتليجرام...</span>
                          ) : telegramSentMatches[m.id || `match_${idx}`] ? (
                            <>
                              <CheckCircle2 size={14} strokeWidth={1.5} />
                              <span>تم إرسال الصورتين لبوت التليجرام بنجاح</span>
                            </>
                          ) : (
                            <>
                              <Send size={14} strokeWidth={1.5} />
                              <span>إرسال إشعار التليجرام الآن (مع الصورتين)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ background: "var(--surface)", border: "1px solid var(--success)", padding: "30px", borderRadius: "12px", textAlign: "center" }}>
                <CheckCircle2 size={36} strokeWidth={1.5} style={{ color: "var(--success-ink)", margin: "0 auto 10px" }} />
                <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "16px" }}>جميع الأعمال واللوحات أصلية 100%</div>
                <div className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "8px", maxWidth: "550px", margin: "8px auto 0", lineHeight: "1.6" }}>
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
            background: "rgba(2, 6, 23, 0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            cursor: "zoom-out",
          }}
        >
          <div style={{ position: "absolute", top: "16px", right: "20px", color: "#fff", background: "var(--error)", padding: "6px 14px", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <X size={15} strokeWidth={1.5} />
            <span>إغلاق المعاينة</span>
          </div>
          <img
            src={zoomedImage}
            alt="معاينة مكبرة"
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: "12px", border: "1px solid var(--accent-ink)", objectFit: "contain" }}
          />
        </div>
      )}

      <StaffReauthModal onSuccess={() => { fetchPortalStats(); fetchPortalSettings(); }} />
    </div>
  );
}
