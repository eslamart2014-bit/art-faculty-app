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
  ChevronDown,
  ChevronUp,
  Filter,
  Camera,
  LogOut,
  Settings,
  EyeOff as EyeOffIcon,
  Eye as EyeOnIcon,
  ToggleLeft,
  ToggleRight,
  Download,
  ShieldCheck
} from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";
import QRScanner from "@/components/QRScanner";
import { extractStudentCode } from "@/lib/scannerHelper";
import { staffFetch } from "@/lib/staffAuthFetch";
import StaffReauthModal from "@/components/StaffReauthModal";
import AdvancedStudentsTab from "./AdvancedStudentsTab";

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

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'لم يسجل دخول بعد';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'منذ لحظات';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${days} يوم`;
}

export default function StudentPortalHubModal({
  isOpen,
  onClose,
  user,
  onOpenIdentityModal
}: StudentPortalHubModalProps) {
  // Tabs: overview, advanced_students, accounts, plagiarism
  const [activeTab, setActiveTab] = useState<"overview" | "advanced_students" | "accounts" | "plagiarism">("overview");

  // Advanced Portal Settings
  const [portalSettings, setPortalSettings] = useState<{
    hide_warnings_tab: boolean;
    student_migration_screen?: boolean;
  }>({ hide_warnings_tab: false, student_migration_screen: false });
  const [appStats, setAppStats] = useState<any>(null);
  const [showAppStatsList, setShowAppStatsList] = useState(false);
  const [appStatsViewMode, setAppStatsViewMode] = useState<'installs' | 'downloads'>('installs');
  const [appStatsSearch, setAppStatsSearch] = useState('');
  const [loadingPortalSettings, setLoadingPortalSettings] = useState(false);
  const [savingPortalSettings, setSavingPortalSettings] = useState(false);
  const [portalSettingsMsg, setPortalSettingsMsg] = useState("");


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

  // Search Logs State (سجلات البحث والاستعلام الأمني)
  const [searchLogsData, setSearchLogsData] = useState<any>(null);
  const [loadingSearchLogs, setLoadingSearchLogs] = useState(false);
  const [searchLogsFilter, setSearchLogsFilter] = useState<"all" | "qr_only" | "suspicious_only" | "primary_only">("all");
  const [searchLogsTextFilter, setSearchLogsTextFilter] = useState("");

  // Modal: Registered Accounts List (عند النقر على مربع الإحصائيات)
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [registeredStudentsList, setRegisteredStudentsList] = useState<any[]>([]);
  const [loadingRegisteredList, setLoadingRegisteredList] = useState(false);
  const [accountListFilter, setAccountListFilter] = useState("");
  const [expandedStudentCode, setExpandedStudentCode] = useState<string | null>(null);

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
  const [plagiarismThreshold, setPlagiarismThreshold] = useState<number>(80);
  const [sendingTelegramMatchId, setSendingTelegramMatchId] = useState<string | null>(null);
  const [telegramSentMatches, setTelegramSentMatches] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: true }, "");
      fetchPortalStats();
      fetchCoordinatorStats();
      fetchSearchLogs();
      fetchPortalSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === "plagiarism" && !plagiarismData && !loadingPlagiarism) {
      fetchPlagiarismData();
    }
  }, [isOpen, activeTab]);

  // ─── Portal Settings Helpers ──────────────────────────────────────────────
  const fetchPortalSettings = async () => {
    setLoadingPortalSettings(true);
    try {
      const res = await staffFetch("/api/admin/portal/settings?_t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json?.settings) {
          setPortalSettings(json.settings);
        }
        if (json?.app_stats) {
          setAppStats(json.app_stats);
        }
        return;
      }
      // Fallback
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
    } finally {
      setLoadingPortalSettings(false);
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
      // Fallback direct supabase
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



  const fetchSearchLogs = async () => {
    setLoadingSearchLogs(true);
    try {
      const res = await staffFetch("/api/admin/portal/search-logs");
      const data = await res.json();
      if (data && data.success) {
        setSearchLogsData(data);
      }
    } catch (e) {
      console.error("Error fetching search logs:", e);
    } finally {
      setLoadingSearchLogs(false);
    }
  };

  const fetchPortalStats = async () => {
    setLoadingStats(true);
    try {
      const res = await staffFetch("/api/admin/portal/stats?_t=" + Date.now(), { cache: "no-store" });
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
      const res = await staffFetch("/api/admin/portal/coordinator-stats");
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
    setExpandedStudentCode(null);
    setAccountListFilter("");
    setLoadingRegisteredList(true);
    try {
      const res = await staffFetch("/api/admin/portal/registered-students", { cache: "no-store" });
      const data = await res.json();
      if (data && data.success) {
        setRegisteredStudentsList(data.students || []);
      }
    } catch (e) {
      console.error("Error fetching registered students list:", e);
    } finally {
      setLoadingRegisteredList(false);
    }
  };

  // تفعيل واعتماد مباشر لحساب الطالب من داخل قائمة الحسابات
  const handleDirectActivateFromList = async (studentCode: string) => {
    try {
      const res = await staffFetch("/api/admin/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_account",
          student_code: studentCode,
          extra: { coordinator_name: user?.full_name || "إدارة المنظومة" }
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert("✓ تم اعتماد وتفعيل حساب الطالب بنجاح!");
        setRegisteredStudentsList(prev => prev.map(s => s.student_code === studentCode ? { ...s, status: 'active', activated_by: user?.full_name || "إدارة المنظومة" } : s));
      } else {
        alert(data.error || "فشل تفعيل الحساب");
      }
    } catch (e: any) {
      alert("خطأ: " + e.message);
    }
  };

  // اعتماد وتفعيل الحساب مباشرة من داخل نافذة الإدارة والبحث
  const handleDirectActivateInInspector = async () => {
    if (!inspectedAccount?.student?.student_code) return;
    const studentCode = inspectedAccount.student.student_code;

    setActionLoading(true);
    setActionMessage("");
    try {
      const res = await staffFetch("/api/admin/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate_account",
          student_code: studentCode,
          extra: { coordinator_name: "إدارة المنظومة" }
        })
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage("✓ " + (data.message || "تم اعتماد وتفعيل الحساب بنجاح"));
        // Re-inspect the account to refresh details immediately
        await handleInspectAccount(studentCode);
        // Refresh registered accounts list
        const listRes = await staffFetch("/api/admin/portal/registered-students", { cache: "no-store" });
        const listData = await listRes.json();
        if (listData?.success) {
          setRegisteredStudentsList(listData.students || []);
        }
      } else {
        alert(data.error || "فشل تفعيل الحساب");
      }
    } catch (e: any) {
      alert("خطأ: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // حذف مباشر لحساب الطالب من قائمة الحسابات المسجلة
  const handleDeleteAccountDirect = async (studentCode: string, studentName: string) => {
    if (!confirm(`تحذير أمني:\nهل أنت متأكد تماماً من حذف حساب الطالب (${studentName}) نهائياً من البوابة؟\n\nسيتم إلغاء تسجيل الطالب والسماح له بالتسجيل من جديد.`)) {
      return;
    }

    try {
      const res = await staffFetch("/api/admin/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_account",
          student_code: studentCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("✓ " + (data.message || "تم حذف الحساب بنجاح"));
        setRegisteredStudentsList(prev => prev.filter(s => s.student_code !== studentCode));
        setStats(prev => ({
          ...prev,
          registeredAccounts: Math.max(0, prev.registeredAccounts - 1)
        }));
        if (inspectedAccount?.student?.student_code === studentCode) {
          handleInspectAccount(studentCode);
        }
      } else {
        alert(data.error || "فشل حذف الحساب");
      }
    } catch (e: any) {
      alert("خطأ في الاتصال: " + e.message);
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
      const res = await staffFetch(`/api/admin/portal?action=inspect&code=${encodeURIComponent(code)}`);
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

  // تنفيذ العمليات الإدارية على الحساب (توليد PIN، تعليق، حذف)
  const handleExecuteAccountAction = async (actionType: string, extra?: any) => {
    if (!inspectedAccount?.student?.student_code) return;
    const cleanCode = inspectedAccount.student.student_code;

    if (actionType === "wipe_account" || actionType === "delete_account") {
      const studentName = inspectedAccount.student?.full_name || cleanCode;
      const ok = confirm(`تحذير أمني هام:\nهل أنت متأكد تماماً من رغبتك في حذف حساب الطالب (${studentName}) نهائياً من البوابة؟\n\nسيتم حذف بيانات الحساب وفك ارتباط الأجهزة وتصفيرها بالكامل، ليتمكن الطالب من التسجيل بحساب جديد.`);
      if (!ok) return;

      setActionLoading(true);
      try {
        const res = await staffFetch("/api/admin/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_account",
            student_code: cleanCode
          })
        });
        const data = await res.json();
        if (res.ok) {
          alert("✓ " + (data.message || "تم حذف الحساب بنجاح."));
          handleInspectAccount(cleanCode);
          fetchPortalStats();
          fetchCoordinatorStats();
          setRegisteredStudentsList(prev => prev.filter(s => s.student_code !== cleanCode && s.student_code !== inspectedAccount.student?.student_code));
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
        if (data.newPin) {
          setShowInspectedPin(true);
          setInspectedAccount((prev: any) => prev ? {
            ...prev,
            account: {
              ...prev.account,
              pin_code: data.newPin,
              status: 'active',
              is_pin_used: true,
              locked_until: null,
              failed_attempts: 0
            }
          } : prev);
        }
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
      const res = await staffFetch("/api/admin/portal/fraud-detection");
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
    } catch (err: any) {
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
        setTelegramSentMatches(prev => ({ ...prev, [matchId]: true }));
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

  const filteredSearchLogs = (searchLogsData?.logs || []).filter((log: any) => {
    if (searchLogsFilter === "qr_only" && log.action !== "download_card") return false;
    if (searchLogsFilter === "suspicious_only" && !log.is_suspicious_device) return false;
    if (searchLogsFilter === "primary_only" && (!log.is_suspicious_device || !log.is_primary_device_owner)) return false;

    if (searchLogsTextFilter.trim()) {
      const q = searchLogsTextFilter.trim().toLowerCase();
      const nameMatch = log.student_name && log.student_name.toLowerCase().includes(q);
      const codeMatch = log.student_code && String(log.student_code).includes(q);
      const otherMatch = log.other_students && log.other_students.some((s: string) => s.toLowerCase().includes(q));
      const primaryMatch = log.primary_owner_name && log.primary_owner_name.toLowerCase().includes(q);
      if (!nameMatch && !codeMatch && !otherMatch && !primaryMatch) return false;
    }
    return true;
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
          { id: "advanced_students", label: "إدارة الطلاب المتقدمة 🎓⚡", color: "#10b981" },
          { id: "accounts", label: "إدارة وبحث الحسابات 👤", color: "#6366f1" },
          { id: "plagiarism", label: "كشف تطابق اللوحات الفنية (AI) 🎨", color: "#f59e0b" },
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

              {/* إدارة الطلاب المتقدمة */}
              <div 
                onClick={() => setActiveTab("advanced_students")}
                style={{ 
                  background: "linear-gradient(135deg, #0d2818, #164024)", 
                  border: "1.5px solid #10b981", 
                  padding: "14px", 
                  borderRadius: "12px", 
                  textAlign: "center",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: "0 4px 15px rgba(16, 185, 129, 0.15)",
                  transition: "all 0.2s"
                }}
                title="انقر للانتقال إلى إدارة الطلاب المتقدمة ورصد الحسابات"
              >
                <div style={{ fontSize: "11px", color: "#a7f3d0", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span>إدارة الطلاب المتقدمة</span>
                  <span style={{ fontSize: "10px", background: "#059669", color: "#fff", padding: "1px 5px", borderRadius: "6px" }}>↗ عرض</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#6ee7b7", marginTop: "7px" }}>
                  رصد ونشاط ⚡
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
        {/* التبويب الجديد: إدارة الطلاب المتقدمة */}
        {/* ========================================================= */}
        {activeTab === "advanced_students" && (
          <div className="animate-fade-in">
            <AdvancedStudentsTab />
          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب: إدارة وبحث الحسابات المركزية (مركز شامل للطالب) */}
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
                  style={{ flex: "1 1 auto", minWidth: 0, width: "100%", height: "44px", padding: "0 12px", background: "#0d131f", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px", fontWeight: "bold", boxSizing: "border-box", margin: 0 }}
                />
                <button
                  type="button"
                  className="btn-compact"
                  onClick={() => handleInspectAccount()}
                  disabled={searchingAccount}
                  style={{ width: "auto", minWidth: "80px", maxWidth: "95px", height: "44px", background: "#2563eb", color: "#fff", border: "none", padding: "0 14px", borderRadius: "10px", fontWeight: "bold", fontSize: "13px", cursor: searchingAccount ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", whiteSpace: "nowrap", flexShrink: 0, boxSizing: "border-box", margin: 0 }}
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
                    padding: 0
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
                        background: inspectedAccount.account?.status === 'suspended' 
                          ? 'rgba(239, 68, 68, 0.2)' 
                          : (inspectedAccount.account?.status === 'pending' || (!inspectedAccount.account?.activated_by && !inspectedAccount.account?.is_pin_used))
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(16, 185, 129, 0.2)',
                        color: inspectedAccount.account?.status === 'suspended' 
                          ? '#f87171' 
                          : (inspectedAccount.account?.status === 'pending' || (!inspectedAccount.account?.activated_by && !inspectedAccount.account?.is_pin_used))
                            ? '#f59e0b'
                            : '#34d399',
                        border: inspectedAccount.account?.status === 'suspended' 
                          ? '1px solid rgba(239, 68, 68, 0.4)' 
                          : (inspectedAccount.account?.status === 'pending' || (!inspectedAccount.account?.activated_by && !inspectedAccount.account?.is_pin_used))
                            ? '1px solid rgba(245, 158, 11, 0.4)'
                            : '1px solid rgba(16, 185, 129, 0.4)'
                      }}>
                        {inspectedAccount.account?.status === 'suspended' 
                          ? 'حساب معلق 🔒' 
                          : (inspectedAccount.account?.status === 'pending' || (!inspectedAccount.account?.activated_by && !inspectedAccount.account?.is_pin_used))
                            ? 'قيد الانتظار (لم يعتمد بعد) ⏳'
                            : 'حساب نشط ومفعل ✅'}
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
                            type="button"
                            className="btn-compact"
                            onClick={() => setShowInspectedPin(!showInspectedPin)}
                            style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", margin: 0, width: "auto" }}
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
                        <span style={{ 
                          color: (inspectedAccount.account?.activated_by || inspectedAccount.account?.pin_issued_by) ? "#34d399" : "#f59e0b", 
                          fontWeight: "bold", 
                          fontSize: "12px" 
                        }}>
                          {inspectedAccount.account?.activated_by || inspectedAccount.account?.pin_issued_by || "غير معتمد بعد ⏳"}
                        </span>
                      </div>

                      {/* السطر الرابع: تاريخ الاعتماد */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>تاريخ الاعتماد:</span>
                        <span style={{ color: "#cbd5e1", fontSize: "12px" }}>
                          {inspectedAccount.account?.activated_at 
                            ? new Date(inspectedAccount.account.activated_at).toLocaleString("ar-EG") 
                            : (inspectedAccount.account?.activated_by ? "معتمد" : "غير مسجل (بانتظار الاعتماد)")}
                        </span>
                      </div>
                    </div>

                    {/* زر اعتماد وتفعيل الحساب مباشرة إن لم يكن معتمداً */}
                    {inspectedAccount.isRegistered && (!inspectedAccount.account?.activated_by || inspectedAccount.account?.status === 'pending') && (
                      <div style={{ marginBottom: "16px" }}>
                        <button
                          type="button"
                          onClick={handleDirectActivateInInspector}
                          disabled={actionLoading}
                          style={{
                            width: "100%",
                            padding: "12px",
                            background: "linear-gradient(135deg, #10b981, #059669)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "14px",
                            fontWeight: "bold",
                            cursor: actionLoading ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)"
                          }}
                        >
                          <span>⚡</span>
                          <span>{actionLoading ? "جاري الاعتماد الفوري وتفعيل الحساب..." : "⚡ اعتماد فوري وتفعيل الحساب"}</span>
                        </button>
                        <div style={{
                          background: "rgba(16, 185, 129, 0.08)",
                          border: "1px dashed rgba(16, 185, 129, 0.35)",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          color: "#6ee7b7",
                          fontSize: "11px",
                          textAlign: "center",
                          lineHeight: "1.5",
                          marginTop: "8px"
                        }}>
                          💡 بمجرد النقر يتم اعتماد وتفعيل الحساب فوراً، ثم يدخل الطالب إلى بوابته باستخدام كوده ورقمه السري.
                        </div>
                      </div>
                    )}

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
                            type="button"
                            className="btn-compact"
                            onClick={() => setZoomedIdCard(inspectedAccount.account.id_card_url)}
                            style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", margin: 0, width: "auto", padding: "2px 6px" }}
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
                      
                      {/* زر الدخول لحساب الطالب (وضع الإدارة) */}
                      <button
                        type="button"
                        className="btn-compact"
                        onClick={() => {
                          const code = inspectedAccount.student?.student_code;
                          if (code) {
                            window.open(`/system?impersonate=${encodeURIComponent(code)}`, '_blank');
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
                          boxShadow: "0 3px 12px rgba(2, 132, 199, 0.3)"
                        }}
                      >
                        <span style={{ fontSize: "16px" }}>👑</span>
                        <span>الدخول لحساب الطالب مباشرة (وضع الإدارة)</span>
                      </button>

                      {/* زر تعليق أو فك تعليق الحساب */}
                      {inspectedAccount.account?.status === 'suspended' ? (
                        <button
                          type="button"
                          className="btn-compact"
                          onClick={() => handleExecuteAccountAction('toggle_status', { status: 'active' })}
                          disabled={actionLoading}
                          style={{ width: "100%", margin: 0, background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          <Unlock size={14} />
                          <span>إلغاء تعليق الحساب</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-compact"
                          onClick={() => handleExecuteAccountAction('toggle_status', { status: 'suspended' })}
                          disabled={actionLoading}
                          style={{ width: "100%", margin: 0, background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          <Lock size={14} />
                          <span>تعليق وقفل الحساب</span>
                        </button>
                      )}

                      {/* زر إعادة توليد رقم سري جديد */}
                      <button
                        type="button"
                        className="btn-compact"
                        onClick={() => handleExecuteAccountAction('reset_pin')}
                        disabled={actionLoading}
                        style={{ width: "100%", margin: 0, background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <RotateCcw size={14} />
                        <span>إعادة توليد رقم PIN</span>
                      </button>

                      {/* زر تسجيل الخروج من جميع الأجهزة */}
                      <button
                        type="button"
                        className="btn-compact"
                        onClick={() => handleExecuteAccountAction('logout_all_devices')}
                        disabled={actionLoading}
                        style={{ width: "100%", margin: 0, background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", color: "#f59e0b", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <LogOut size={14} />
                        <span>تسجيل الخروج من جميع الأجهزة</span>
                      </button>

                      {/* زر تصفير أعمال الطالب لإعادة الرفع */}
                      <button
                        type="button"
                        className="btn-compact"
                        onClick={() => {
                          if (confirm("هل أنت متأكد من رغبتك في حذف وتصفير جميع أعمال ومشاريع هذا الطالب لإتاحة إعادة التصوير والرفع له؟")) {
                            handleExecuteAccountAction('reset_submissions');
                          }
                        }}
                        disabled={actionLoading}
                        style={{ width: "100%", margin: 0, background: "#1e293b", border: "1px solid #eab308", color: "#facc15", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <RefreshCw size={14} />
                        <span>تصفير الأعمال لإعادة الرفع</span>
                      </button>

                      {/* زر حذف الحساب نهائياً */}
                      <button
                        type="button"
                        className="btn-compact"
                        onClick={() => handleExecuteAccountAction('delete_account')}
                        disabled={actionLoading}
                        style={{ width: "100%", margin: 0, background: "rgba(239, 68, 68, 0.2)", border: "1.5px solid #ef4444", color: "#fca5a5", padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <Trash2 size={15} />
                        <span>حذف الحساب نهائياً 🗑️</span>
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
                    gap: "6px"
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

                      {/* سبب وتشخيص التطابق */}
                      {m.reason && (
                        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "8px 10px", marginBottom: "12px", fontSize: "11px", color: "#cbd5e1", border: "1px dashed #334155" }}>
                          💡 <b>تشخيص الـ AI:</b> {m.reason}
                        </div>
                      )}

                      {/* مقارنة اللوحتين جنباً إلى جنب مع إمكانية التكبير والمعاينة */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", textAlign: "center" }}>
                        {/* لوحة الطالب الأول */}
                        <div style={{ background: "#0f172a", borderRadius: "10px", padding: "10px", border: "1px solid #1e293b" }}>
                          <div style={{ fontSize: "13px", color: "#fff", fontWeight: "bold", marginBottom: "2px" }}>
                            {name1} {code1 ? `(كود: ${code1})` : ''}
                          </div>
                          {course1 && <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px" }}>{course1}</div>}
                          
                          <div 
                            onClick={() => img1 && setZoomedIdCard(img1)}
                            title="انقر لتكبير اللوحة"
                            style={{ 
                              position: "relative",
                              height: "160px", 
                              borderRadius: "8px", 
                              overflow: "hidden", 
                              border: "2px solid #ef4444", 
                              background: "#000",
                              cursor: img1 ? "zoom-in" : "default" 
                            }}
                          >
                            {img1 ? (
                              <img 
                                src={img1} 
                                alt="عمل الطالب الأول" 
                                style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0a0a0c" }}
                                onError={(e: any) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.parentElement?.querySelector('.fallback-error');
                                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="fallback-error" style={{ 
                              display: img1 ? "none" : "flex", 
                              flexDirection: "column",
                              alignItems: "center", 
                              justifyContent: "center", 
                              height: "100%", 
                              color: "#94a3b8", 
                              fontSize: "12px",
                              gap: "4px"
                            }}>
                              <span>🖼️ تعذر تحميل الصورة</span>
                              {img1 && <a href={img1} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ color: "#38bdf8", fontSize: "11px" }}>فتح الرابط مباشرة</a>}
                            </div>
                            {img1 && (
                              <div style={{
                                position: "absolute",
                                bottom: "4px",
                                left: "4px",
                                background: "rgba(0,0,0,0.75)",
                                color: "#fff",
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                pointerEvents: "none"
                              }}>
                                🔍 انقر للتكبير
                              </div>
                            )}
                          </div>
                        </div>

                        {/* لوحة الطالب الثاني */}
                        <div style={{ background: "#0f172a", borderRadius: "10px", padding: "10px", border: "1px solid #1e293b" }}>
                          <div style={{ fontSize: "13px", color: "#fff", fontWeight: "bold", marginBottom: "2px" }}>
                            {name2} {code2 ? `(كود: ${code2})` : ''}
                          </div>
                          {course2 && <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px" }}>{course2}</div>}
                          
                          <div 
                            onClick={() => img2 && setZoomedIdCard(img2)}
                            title="انقر لتكبير اللوحة"
                            style={{ 
                              position: "relative",
                              height: "160px", 
                              borderRadius: "8px", 
                              overflow: "hidden", 
                              border: "2px solid #ef4444", 
                              background: "#000",
                              cursor: img2 ? "zoom-in" : "default" 
                            }}
                          >
                            {img2 ? (
                              <img 
                                src={img2} 
                                alt="عمل الطالب الثاني" 
                                style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0a0a0c" }}
                                onError={(e: any) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.parentElement?.querySelector('.fallback-error');
                                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="fallback-error" style={{ 
                              display: img2 ? "none" : "flex", 
                              flexDirection: "column",
                              alignItems: "center", 
                              justifyContent: "center", 
                              height: "100%", 
                              color: "#94a3b8", 
                              fontSize: "12px",
                              gap: "4px"
                            }}>
                              <span>🖼️ تعذر تحميل الصورة</span>
                              {img2 && <a href={img2} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ color: "#38bdf8", fontSize: "11px" }}>فتح الرابط مباشرة</a>}
                            </div>
                            {img2 && (
                              <div style={{
                                position: "absolute",
                                bottom: "4px",
                                left: "4px",
                                background: "rgba(0,0,0,0.75)",
                                color: "#fff",
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                pointerEvents: "none"
                              }}>
                                🔍 انقر للتكبير
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* شريط الإجراءات: إرسال إشعار التليجرام بالصورتين */}
                      <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px dashed #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>🤖 مراقبة التطابق: يعمل النظام في الخلفية ويرسل تنبيهات تلقائية.</span>
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
                            cursor: sendingTelegramMatchId === (m.id || `match_${idx}`) ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                            transition: "all 0.2s ease"
                          }}
                        >
                          {sendingTelegramMatchId === (m.id || `match_${idx}`) ? (
                            <>
                              <RefreshCw size={14} className="spin" />
                              <span>جاري إرسال الصورتين للتليجرام...</span>
                            </>
                          ) : telegramSentMatches[m.id || `match_${idx}`] ? (
                            <>
                              <CheckCircle2 size={14} color="#34d399" />
                              <span>تم إرسال الصورتين لبوت التليجرام بنجاح ✓</span>
                            </>
                          ) : (
                            <>
                              <span>📲 إرسال إشعار التليجرام الآن (مع الصورتين)</span>
                            </>
                          )}
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
                  لم يعثر محرك الذكاء الاصطناعي على أي شبهة نسخ أو تطابق بين الطلاب (عتبة الفحص الحالية: {plagiarismThreshold}% فأكثر).<br/>
                  <span style={{ color: "#64748b", fontSize: "11px" }}>💡 علمياً: التباين الطبيعي بين أي صورتين مختلفتين تماماً يتراوح عشوائياً بين 45% و 60%، ولا يُعتبر تطابقاً إلا إذا تجاوز 80%.</span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {zoomedIdCard && (
        <div 
          onClick={() => setZoomedIdCard(null)}
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
            cursor: "zoom-out"
          }}
        >
          <div style={{ position: "absolute", top: "16px", right: "20px", color: "#fff", background: "#ef4444", padding: "6px 14px", borderRadius: "8px", fontWeight: "bold", fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
            ✕ إغلاق المعاينة
          </div>
          <img 
            src={zoomedIdCard} 
            alt="معاينة مكبرة" 
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: "12px", border: "2px solid #38bdf8", objectFit: "contain", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }} 
          />
        </div>
      )}

      <StaffReauthModal onSuccess={() => { fetchPortalStats(); fetchPortalSettings(); fetchCoordinatorStats(); }} />
    </div>
  );
}
