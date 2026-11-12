import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/core/supabase";
import QRScanner from "@/components/scanner/QRScanner";

import { extractStudentCode, sanitizeScannedString, getStudentCodeVariants, buildStudentCodeFilter, normalizeAcademicYear } from "@/lib/students/codeHelper";
import LockerAdminTab from "@/components/lockers/LockerAdminTab";
import { staffFetch } from "@/lib/auth/staffAuthFetch";
import {
  Archive,
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  Check,
  Construction,
  DoorOpen,
  FolderOpen,
  Globe,
  GraduationCap,
  Handshake,
  ListChecks,
  Save,
  Search,
  Settings2,
  Shield,
  Smartphone,
  UserCheck,
  X,
  XCircle
} from "lucide-react";

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  onOpenRoster?: () => void;
  onOpenPortalHub?: () => void;
}

export default function AdvancedSettingsModal({ isOpen, onClose, user, onOpenRoster, onOpenPortalHub }: AdvancedSettingsModalProps) {
  useEffect(() => {
    window.history.pushState({ modal: true }, "");
  }, []);

  const [activeTab, setActiveTab] = useState<"study" | "search" | "maintenance" | "shares" | "roster" | "lockers">("study");
  
  // Study Settings state
  const [term1Start, setTerm1Start] = useState("");
  const [term1End, setTerm1End] = useState("");
  const [term2Start, setTerm2Start] = useState("");
  const [term2End, setTerm2End] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceScope, setMaintenanceScope] = useState<"faculty" | "portal" | "all">("faculty");
  const [rawTelegramConfig, setRawTelegramConfig] = useState<any>(null);
  
  // Global Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [studentsList, setStudentsList] = useState<any[] | null>(null);
  const [selectedStudentResult, setSelectedStudentResult] = useState<any | null>(null);
  
  // Share Requests state
  const [shareRequests, setShareRequests] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [selectedColleagues, setSelectedColleagues] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== "search") {
      setIsScanning(false);
    }
    if (isOpen && activeTab === "shares") {
      fetchShareRequests();
      fetchProfiles();
    }
  }, [isOpen, activeTab]);

  const fetchShareRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("course_share_requests")
      .select("*, courses(name), profiles(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setShareRequests(data);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
    if (data) setProfilesList(data);
  };

  const handleApproveShare = async (request: any) => {
    const colleagues = selectedColleagues[request.id];
    if (!colleagues || colleagues.length === 0) {
      alert("يرجى اختيار زميل واحد على الأقل");
      return;
    }
    
    setLoading(true);
    // Fetch current course
    const { data: course } = await supabase.from("courses").select("shared_with").eq("id", request.course_id).single();
    if (course) {
      const currentShared = course.shared_with || [];
      const newShared = Array.from(new Set([...currentShared, ...colleagues]));
      
      // Update course
      await supabase.from("courses").update({ shared_with: newShared }).eq("id", request.course_id);
      
      // Update request status
      await supabase.from("course_share_requests").update({ status: "approved" }).eq("id", request.id);
      
      // Send notifications
      const notifs = [];
      const courseName = request.courses?.name || "المقرر";
      const requesterName = request.profiles?.full_name || "زميلك";
      
      // Get names of added colleagues
      const colleaguesNames = colleagues.map((id: string) => profilesList.find(p => p.id === id)?.full_name || "زميل").join(" و ");

      notifs.push({
        user_id: request.requester_id,
        title: "قبول طلب المشاركة 🤝",
        message: `تمت الموافقة على طلبك بنجاح. تمت إضافة (${colleaguesNames}) للمقرر: ${courseName}. جميع البيانات الآن أصبحت مشتركة.`
      });
      
      for(const col of colleagues) {
        notifs.push({
          user_id: col,
          title: "إضافة لمقرر مشترك 🤝",
          message: `تمت إضافتك للمقرر المشترك: ${courseName} بناءً على طلب (${requesterName}). يرجى العلم أن أي تعديل في الغياب أو الدرجات سيطبق عند كلا الطرفين.`
        });
      }
      await supabase.from("notifications").insert(notifs);

      alert("تمت إضافة الزملاء وإرسال الإشعارات بنجاح");
      fetchShareRequests();
    }
    setLoading(false);
  };

  const handleRejectShare = async (id: string) => {
    setLoading(true);
    await supabase.from("course_share_requests").update({ status: "rejected" }).eq("id", id);
    fetchShareRequests();
    setLoading(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from("system_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      if (data.term1_start) setTerm1Start(data.term1_start);
      if (data.term2_start) setTerm2Start(data.term2_start);
      if (data.term1_end) setTerm1End(data.term1_end);
      if (data.term2_end) setTerm2End(data.term2_end);
      if (data.is_maintenance_mode !== undefined) setIsMaintenance(data.is_maintenance_mode);
      if (data.maintenance_message) setMaintenanceMessage(data.maintenance_message);
      if (data.telegram_config) {
        setRawTelegramConfig(data.telegram_config);
        if (data.telegram_config.maintenance_scope) {
          setMaintenanceScope(data.telegram_config.maintenance_scope);
        }
      }
    }
    setLoading(false);
  };


  const saveSettings = async () => {
    setLoading(true);
    const { error } = await supabase.from("system_settings").upsert({
      id: 1,
      term1_start: term1Start || null,
      term2_start: term2Start || null,
      term1_end: term1End || null,
      term2_end: term2End || null,
      updated_at: new Date().toISOString()
    });

    if (error) {
      alert("حدث خطأ أثناء الحفظ");
    } else {
      alert("تم الحفظ بنجاح!");
    }
    setLoading(false);
  };

  const toggleMaintenance = async (newState: boolean) => {
    let confirmMsg = "";
    if (newState) {
      const scopeLabel = maintenanceScope === 'faculty' 
        ? "نظام أعضاء هيئة التدريس فقط (بوابة الطلاب ستظل مفتوحة)" 
        : maintenanceScope === 'portal' 
        ? "بوابة الطلاب فقط (نظام التدريس سيظل مفتوحاً)" 
        : "النظام بالكامل (تطبيق التدريس + بوابة الطلاب)";
      confirmMsg = `تنبيه: هل أنت متأكد من تفعيل وضع الصيانة على: [${scopeLabel}]؟\nلن يتمكن المستخدمون المشمولون من الدخول حتى تقوم بإيقاف الصيانة. (حسابات الإدارة مستثناة دائماً).`;
    } else {
      confirmMsg = "هل أنت متأكد من إنهاء وضع الصيانة؟ سيعود النظام للعمل بصورة طبيعية لدى الجميع فوراً.";
    }

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    const updatedTelegramConfig = {
      ...(rawTelegramConfig || {}),
      maintenance_scope: maintenanceScope
    };

    const { error } = await supabase.from("system_settings").upsert({
      id: 1,
      is_maintenance_mode: newState,
      maintenance_message: maintenanceMessage || "التطبيق يخضع لصيانة وتحديثات الآن. يرجى الانتظار...",
      telegram_config: updatedTelegramConfig,
      updated_at: new Date().toISOString()
    });

    if (!error) {
      setIsMaintenance(newState);
      setRawTelegramConfig(updatedTelegramConfig);
      alert(newState ? "تم تفعيل وضع الصيانة بنجاح وفق النطاق المحدد." : "تم إنهاء وضع الصيانة بنجاح وعاد النظام للعمل طبيعياً.");
    } else {
      alert("حدث خطأ أثناء تغيير وضع الصيانة");
    }
    setLoading(false);
  };

  const saveMaintenanceConfig = async () => {
    setLoading(true);
    const updatedTelegramConfig = {
      ...(rawTelegramConfig || {}),
      maintenance_scope: maintenanceScope
    };

    const { error } = await supabase.from("system_settings").upsert({
      id: 1,
      maintenance_message: maintenanceMessage || "التطبيق يخضع لصيانة وتحديثات الآن. يرجى الانتظار...",
      telegram_config: updatedTelegramConfig,
      updated_at: new Date().toISOString()
    });

    if (!error) {
      setRawTelegramConfig(updatedTelegramConfig);
      alert("تم حفظ إعدادات نطاق الصيانة والرسالة بنجاح!");
    } else {
      alert("حدث خطأ أثناء الحفظ");
    }
    setLoading(false);
  };

  const toggleScanner = () => {
    if (isScanning && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
    setIsScanning(!isScanning);
  };

  const normalizeArabic = (str: string = '') => {
    return str
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '') // remove tashkeel
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const performGlobalSearch = async (query: string) => {
    const raw = query ? sanitizeScannedString(query) : '';
    if (!raw) return;
    setSearchLoading(true);
    setStudentsList(null);
    setSelectedStudentResult(null);

    try {
      const isNum = /^\d+$/.test(raw);
      let foundStudents: any[] = [];

      if (isNum) {
        const variants = getStudentCodeVariants(raw);
        const filter = buildStudentCodeFilter(variants);
        // Query by numeric codes (exact, unpadded, padded)
        const { data: byCode } = await supabase
          .from('students')
          .select('*')
          .or(filter);
        
        if (byCode && byCode.length > 0) {
          foundStudents = byCode;
        }
      }

      // If not found by direct code or if query is textual:
      if (foundStudents.length === 0) {
        // Fetch all active students for smart Arabic normalization matching
        const { data: allStudents } = await supabase
          .from('students')
          .select('*')
          .order('student_code', { ascending: true });

        if (allStudents && allStudents.length > 0) {
          const normQ = normalizeArabic(raw);
          const rawVariants = getStudentCodeVariants(raw);
          // 1. Try matching normalized name or code
          foundStudents = allStudents.filter(s => {
            const normName = normalizeArabic(s.full_name || '');
            const sc = (s.student_code || '').trim();
            const scVariants = getStudentCodeVariants(sc);
            return normName.includes(normQ) || rawVariants.some(v => scVariants.includes(v));
          });

          // 2. If still not found, try multi-word matching
          if (foundStudents.length === 0 && normQ.length >= 2) {
            const words = normQ.split(' ').filter(w => w.length > 1);
            if (words.length > 0) {
              foundStudents = allStudents.filter(s => {
                const normName = normalizeArabic(s.full_name || '');
                return words.every(w => normName.includes(w));
              });
            }
          }
        }
      }

      if (!foundStudents || foundStudents.length === 0) {
        alert("لم يتم العثور على أي طالب يطابق البحث: " + raw);
        setSearchLoading(false);
        return;
      }

      // Prioritize active students first
      foundStudents.sort((a, b) => {
        if (a.is_active === b.is_active) return 0;
        return a.is_active ? -1 : 1;
      });

      if (foundStudents.length === 1) {
        await fetchStudentDetails(foundStudents[0]);
      } else {
        setStudentsList(foundStudents);
      }
    } catch (err: any) {
      console.error("Global search error:", err);
      alert("حدث خطأ أثناء البحث: " + (err.message || err));
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchStudentDetails = async (student: any) => {
    setSearchLoading(true);
    setStudentsList(null);

    try {
      // 1. Fetch courses
      const { data: allCourses } = await supabase.from('courses').select('id, name, academic_year, term, teacher_id');
      const coursesMap = new Map((allCourses || []).map(c => [c.id, c]));

      // 2. Fetch attendance & evaluations & portal account
      const [attRes, evalRes, accRes] = await Promise.all([
        supabase.from('attendance').select('course_id, status, date').eq('student_id', student.id),
        supabase.from('evaluations').select('course_id, project_name, score, created_at').eq('student_id', student.id),
        supabase.from('student_accounts').select('*').eq('student_code', student.student_code).maybeSingle()
      ]);

      const attendance = attRes.data || [];
      const evaluations = evalRes.data || [];
      const studentAccount = accRes.data || null;

      // 3. Fetch locker info if available
      let lockerInfo: string | null = null;
      try {
        const { data: lockerData } = await supabase
          .from('lockers')
          .select('locker_code, cohort')
          .eq('student_code', student.student_code)
          .maybeSingle();
        if (lockerData) {
          lockerInfo = `دولاب رقم: ${lockerData.locker_code}`;
        }
      } catch (e) {}

      const courseStats = new Map<string, any>();

      // First, include all courses for the student's academic year
      (allCourses || []).forEach(c => {
        if (normalizeAcademicYear(c.academic_year) === normalizeAcademicYear(student.academic_year)) {
          courseStats.set(c.id, {
            courseId: c.id,
            courseName: c.name,
            term: c.term || '',
            totalAttended: 0,
            totalAbsences: 0,
            evaluations: []
          });
        }
      });

      // Map attendance
      attendance.forEach(att => {
        const cId = att.course_id;
        if (!courseStats.has(cId)) {
          const c = coursesMap.get(cId);
          courseStats.set(cId, {
            courseId: cId,
            courseName: c ? c.name : 'مقرر دراسي',
            term: c?.term || '',
            totalAttended: 0,
            totalAbsences: 0,
            evaluations: []
          });
        }
        const item = courseStats.get(cId);
        if (att.status === 'حاضر') {
          item.totalAttended += 1;
        } else if (att.status === 'غائب') {
          item.totalAbsences += 1;
        }
      });

      // Map evaluations
      evaluations.forEach(ev => {
        const cId = ev.course_id;
        if (!courseStats.has(cId)) {
          const c = coursesMap.get(cId);
          courseStats.set(cId, {
            courseId: cId,
            courseName: c ? c.name : 'مقرر دراسي',
            term: c?.term || '',
            totalAttended: 0,
            totalAbsences: 0,
            evaluations: []
          });
        }
        courseStats.get(cId).evaluations.push({
          project_name: ev.project_name,
          score: ev.score,
          created_at: ev.created_at
        });
      });

      setSelectedStudentResult({
        student,
        account: studentAccount,
        lockerInfo,
        courses: Array.from(courseStats.values())
      });
    } catch (err: any) {
      console.error("fetchStudentDetails error:", err);
      alert("حدث خطأ أثناء جلب تفاصيل الطالب: " + (err.message || err));
    } finally {
      setSearchLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "var(--bg-deep)", zIndex: 1000,
      display: "flex", flexDirection: "column", direction: "rtl"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "12px 18px", 
        background: "var(--surface)", 
        borderBottom: "1px solid var(--border)",
        minHeight: "56px"
      }}>
        <div>
          <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
            <Settings2 size={18} strokeWidth={1.5} style={{ color: "var(--accent-ink)" }} />
            <span>الإعدادات المتقدمة</span>
          </h3>
          <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
            جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="modal-close-btn"
          title="إغلاق"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      <div 
        className="no-scrollbar"
        style={{ 
          display: "flex", 
          flexWrap: "nowrap", 
          overflowX: "auto", 
          whiteSpace: "nowrap", 
          gap: "6px", 
          padding: "10px 14px", 
          background: "var(--background)", 
          borderBottom: "1px solid var(--border)",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch"
        }}
      >
        {[
          { id: "study", label: "الدراسة والتواريخ", Icon: Calendar, color: "var(--accent-ink)", activeBg: "rgba(56, 189, 248, 0.12)" },
          { id: "search", label: "البحث الشامل", Icon: Search, color: "var(--accent-ink)", activeBg: "rgba(56, 189, 248, 0.12)" },
          { id: "roster", label: "كشوف الطلاب", Icon: ListChecks, color: "var(--accent-ink)", activeBg: "rgba(56, 189, 248, 0.12)" },
          { id: "lockers", label: "بوابة الدواليب", Icon: DoorOpen, color: "var(--primary)", activeBg: "rgba(37, 99, 235, 0.14)" },
          { id: "shares", label: "طلبات المشاركة", Icon: Handshake, color: "var(--success-ink)", activeBg: "rgba(16, 185, 129, 0.12)" },
          { id: "maintenance", label: "وضع الصيانة", Icon: Construction, color: "var(--error-ink)", activeBg: "rgba(239, 68, 68, 0.12)" },
        ].map(t => {
          const isActive = activeTab === t.id;
          const TabIcon = t.Icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className="btn-compact"
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: "8px",
                border: isActive ? `1px solid ${t.color}` : "1px solid var(--border)",
                background: isActive ? t.activeBg : "var(--surface)",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease"
              }}
            >
              <TabIcon size={15} strokeWidth={1.5} style={{ color: isActive ? t.color : "var(--text-muted)" }} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto" }}>
        
        {/* Study Settings Tab */}
        {activeTab === "study" && (
          <div>
            <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "20px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: 0, marginBottom: "20px", lineHeight: 1.6 }}>
                قم بتحديد تواريخ بداية كل ترم. سيقوم النظام بحساب رقم الأسبوع تلقائياً بناءً على هذه التواريخ ودمجها في التقارير (PDF).
              </p>
              
              <div style={{ marginBottom: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ display: "block", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500, fontSize: "13px" }}>بداية الترم الأول</label>
                  <input type="date" className="tabular-nums" value={term1Start} onChange={(e) => setTerm1Start(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ display: "block", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500, fontSize: "13px" }}>نهاية الترم الأول</label>
                  <input type="date" className="tabular-nums" value={term1End} onChange={(e) => setTerm1End(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ display: "block", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500, fontSize: "13px" }}>بداية الترم الثاني</label>
                  <input type="date" className="tabular-nums" value={term2Start} onChange={(e) => setTerm2Start(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ display: "block", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500, fontSize: "13px" }}>نهاية الترم الثاني</label>
                  <input type="date" className="tabular-nums" value={term2End} onChange={(e) => setTerm2End(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
                </div>
              </div>

              <button 
                onClick={saveSettings} 
                disabled={loading}
                style={{ width: "100%", padding: "12px 16px", background: "var(--success)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "14px", cursor: loading ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <Save size={16} strokeWidth={1.5} />
                <span>{loading ? "جاري الحفظ..." : "حفظ إعدادات التواريخ"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Global Search Tab */}
        {activeTab === "search" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", textAlign: "center" }}>
              <Globe size={34} strokeWidth={1.5} style={{ color: "var(--accent-ink)", margin: "0 auto 12px", display: "block" }} />
              <h3 style={{ color: "var(--text-primary)", margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600 }}>البحث الشامل للطلاب</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                ابحث برقم الطالب أو اسمه أو قم بمسح بطاقته للحصول على تقرير مفصل بجميع مقرراته وحضوره وتقييماته في مكان واحد.
              </p>

              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", width: "100%", alignItems: "stretch", boxSizing: "border-box" }}>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performGlobalSearch(searchQuery)}
                  placeholder="كود أو اسم الطالب..."
                  style={{ flex: 1, minWidth: 0, height: "42px", padding: "0 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }}
                />
                <button 
                  onClick={() => performGlobalSearch(searchQuery)}
                  disabled={searchLoading}
                  style={{ height: "42px", background: "var(--primary)", color: "#fff", border: "none", padding: "0 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", whiteSpace: "nowrap", flexShrink: 0, boxSizing: "border-box", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Search size={15} strokeWidth={1.5} />
                  <span>{searchLoading ? "جاري البحث..." : "بحث"}</span>
                </button>
                <button 
                  onClick={toggleScanner}
                  style={{ height: "42px", background: isScanning ? "var(--error)" : "var(--success)", color: "#fff", border: "none", padding: "0 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", whiteSpace: "nowrap", flexShrink: 0, boxSizing: "border-box" }}
                  title={isScanning ? "إغلاق الكاميرا" : "مسح QR بالكاميرا"}
                >
                  {isScanning ? (
                    <>
                      <X size={15} strokeWidth={1.5} />
                      <span>إغلاق</span>
                    </>
                  ) : (
                    <Camera size={17} strokeWidth={1.5} />
                  )}
                </button>
              </div>

              {isScanning && (
                <div style={{ marginBottom: "20px", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border)" }}>
                  <QRScanner 
                    onScan={(result) => { 
                      const clean = extractStudentCode(result) || result.trim();
                      if(clean) { 
                        setSearchQuery(clean);
                        performGlobalSearch(clean); 
                        setIsScanning(false); 
                      } 
                    }} 
                    onClose={() => setIsScanning(false)}
                    height="280px"
                  />
                </div>
              )}

              {/* نتائج البحث */}
              {studentsList && !selectedStudentResult && (
                <div style={{ background: "var(--bg-deep)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", marginTop: "20px", textAlign: "right" }}>
                  <h3 className="tabular-nums" style={{ color: "var(--accent-ink)", marginTop: 0, borderBottom: "1px solid var(--border)", paddingBottom: "10px", fontSize: "15px", fontWeight: 600 }}>تم العثور على {studentsList.length} طلاب</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
                    {studentsList.map((student: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--border)", gap: "10px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>{student.full_name}</div>
                          <div className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
                            الكود: {student.student_code} | الفرقة: {student.academic_year} | السكشن: {student.section}
                          </div>
                        </div>
                        <button 
                          onClick={() => fetchStudentDetails(student)}
                          style={{ background: "var(--success)", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
                        >
                          عرض التفاصيل
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStudentResult && (() => {
                const searchResult = selectedStudentResult;
                return (
                  <div style={{ textAlign: "right", marginTop: "20px" }}>
                    <div style={{ marginBottom: "15px" }}>
                      <button 
                        onClick={() => setSelectedStudentResult(null)} 
                        style={{ background: "var(--surface-hover)", color: "var(--accent-ink)", border: "1px solid var(--primary)", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <ArrowRight size={15} strokeWidth={1.5} />
                        <span>عودة لنتائج البحث</span>
                      </button>
                    </div>
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "18px", borderRadius: "12px", marginBottom: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "20px", fontWeight: 600 }}>{searchResult.student.full_name}</h2>
                            <span style={{
                              background: searchResult.student.is_active ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
                              color: searchResult.student.is_active ? "var(--success-ink)" : "var(--error-ink)",
                              border: `1px solid ${searchResult.student.is_active ? 'var(--success)' : 'var(--error)'}`,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              {searchResult.student.is_active ? <UserCheck size={12} strokeWidth={1.5} /> : <Archive size={12} strokeWidth={1.5} />}
                              <span>{searchResult.student.is_active ? "طالب نشط" : "غير نشط / مؤرشف"}</span>
                            </span>
                          </div>

                          <div className="tabular-nums" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px", color: "var(--text-muted)", fontSize: "13px" }}>
                            <span>كود: <strong style={{ color: "var(--accent-ink)", fontWeight: 600 }}>{searchResult.student.student_code}</strong></span>
                            <span>|</span>
                            <span>الفرقة: <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{searchResult.student.academic_year}</strong></span>
                            <span>|</span>
                            <span>السكشن: <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{searchResult.student.section || 'عام'}</strong></span>
                            {(searchResult.account?.mobile || searchResult.student?.phone) && (
                              <>
                                <span>|</span>
                                <span>هاتف: <strong style={{ color: "var(--warning-ink)", fontWeight: 600 }}>{searchResult.account?.mobile || searchResult.student?.phone}</strong></span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Badges: Locker & Portal */}
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {searchResult.lockerInfo && (
                            <div className="tabular-nums" style={{ background: "rgba(56, 189, 248, 0.14)", color: "var(--accent-ink)", border: "1px solid var(--accent-ink)", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <DoorOpen size={13} strokeWidth={1.5} />
                              <span>{searchResult.lockerInfo}</span>
                            </div>
                          )}
                          <div style={{
                            background: searchResult.account ? (searchResult.account.id_card_verified ? "rgba(16, 185, 129, 0.14)" : "rgba(245, 158, 11, 0.14)") : "rgba(100, 116, 139, 0.14)",
                            color: searchResult.account ? (searchResult.account.id_card_verified ? "var(--success-ink)" : "var(--warning-ink)") : "var(--text-muted)",
                            border: `1px solid ${searchResult.account ? (searchResult.account.id_card_verified ? 'var(--success)' : 'var(--warning)') : 'var(--border-light)'}`,
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}>
                            <Smartphone size={13} strokeWidth={1.5} />
                            <span>
                              {searchResult.account 
                                ? (searchResult.account.id_card_verified ? "مسجل بالبوابة وموثق" : "مسجل بالبوابة (قيد الاعتماد)")
                                : "غير مسجل بالبوابة"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Overall Summary Row */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginTop: "15px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>المقررات المقيدة</div>
                          <div className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "18px", fontWeight: 600 }}>{searchResult.courses.length}</div>
                        </div>
                        <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>إجمالي الحضور</div>
                          <div className="tabular-nums" style={{ color: "var(--success-ink)", fontSize: "18px", fontWeight: 600 }}>
                            {searchResult.courses.reduce((sum: number, c: any) => sum + (c.totalAttended || 0), 0)}
                          </div>
                        </div>
                        <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>إجمالي الغياب</div>
                          <div className="tabular-nums" style={{ color: "var(--error-ink)", fontSize: "18px", fontWeight: 600 }}>
                            {searchResult.courses.reduce((sum: number, c: any) => sum + (c.totalAbsences || 0), 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <h3 style={{ color: "var(--success-ink)", borderBottom: "1px solid var(--border)", paddingBottom: "10px", marginBottom: "15px", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                      <BookOpen size={17} strokeWidth={1.5} />
                      <span>سجل المقررات الدراسية</span>
                    </h3>
                    
                    {searchResult.courses.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px" }}>لا توجد مقررات مسجلة لهذا الطالب حالياً.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
                        {searchResult.courses.map((c: any, idx: number) => (
                          <div key={idx} style={{ background: "var(--bg-deep)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px" }}>
                                <h4 style={{ color: "var(--accent-ink)", margin: 0, fontSize: "15px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                                  <BookOpen size={15} strokeWidth={1.5} />
                                  <span>{c.courseName}</span>
                                </h4>
                                {c.term && (
                                  <span style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "11px", padding: "2px 7px", borderRadius: "6px" }}>{c.term}</span>
                                )}
                              </div>
                              
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "8px", borderRadius: "8px", textAlign: "center" }}>
                                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>مرات الحضور</div>
                                  <div className="tabular-nums" style={{ color: "var(--success-ink)", fontSize: "18px", fontWeight: 600 }}>{c.totalAttended || 0}</div>
                                </div>
                                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "8px", borderRadius: "8px", textAlign: "center" }}>
                                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>مرات الغياب</div>
                                  <div className="tabular-nums" style={{ color: (c.totalAbsences || 0) >= 3 ? "var(--error-ink)" : "var(--warning-ink)", fontSize: "18px", fontWeight: 600 }}>{c.totalAbsences || 0}</div>
                                </div>
                              </div>

                              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px" }}>
                                <div style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "8px", fontWeight: 600 }}>التقييمات والدرجات:</div>
                                {(!c.evaluations || c.evaluations.length === 0) ? (
                                  <div style={{ color: "var(--text-dim)", fontSize: "12px", textAlign: "center", padding: "6px 0" }}>لا توجد درجات مسجلة</div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {c.evaluations.map((ev: any, evIdx: number) => (
                                      <div key={evIdx} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "4px", fontSize: "13px" }}>
                                        <span style={{ color: "var(--text-primary)" }}>{ev.project_name}</span>
                                        <strong className="tabular-nums" style={{ color: "var(--success-ink)", fontWeight: 600 }}>{ev.score}</strong>
                                      </div>
                                    ))}
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px", borderTop: "1px solid var(--border-light)", fontSize: "13px" }}>
                                      <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>الإجمالي:</strong>
                                      <strong className="tabular-nums" style={{ color: "var(--warning-ink)", fontWeight: 600 }}>{c.evaluations.reduce((acc: number, curr: any) => acc + Number(curr.score || 0), 0)}</strong>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Maintenance Settings Tab */}
        {activeTab === "maintenance" && (
          <div>
            <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: `1px solid ${isMaintenance ? "var(--error)" : "var(--border)"}`, marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                <h3 style={{ color: isMaintenance ? "var(--error-ink)" : "var(--success-ink)", margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: 600 }}>
                  <Construction size={19} strokeWidth={1.5} />
                  <span>وضع الصيانة والتحكم في النطاق</span>
                </h3>
                <div style={{
                  background: isMaintenance ? "rgba(239, 68, 68, 0.14)" : "rgba(16, 185, 129, 0.14)",
                  color: isMaintenance ? "var(--error-ink)" : "var(--success-ink)",
                  border: `1px solid ${isMaintenance ? "var(--error)" : "var(--success)"}`,
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  {isMaintenance ? (
                    <>
                      <XCircle size={14} strokeWidth={1.5} />
                      <span>
                        {maintenanceScope === "faculty" ? "نشط: نظام أعضاء هيئة التدريس فقط" :
                        maintenanceScope === "portal" ? "نشط: بوابة الطلاب فقط" : "نشط: النظام بالكامل"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Check size={14} strokeWidth={1.5} />
                      <span>النظام يعمل طبيعياً للجميع</span>
                    </>
                  )}
                </div>
              </div>

              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px", lineHeight: "1.6" }}>
                يمكنك تحديد <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>الجزء أو النطاق المحدد</strong> الذي ترغب في وضعه قيد الصيانة، لمنع إيقاف خدمات الطلاب عند تحديث نظام أعضاء هيئة التدريس، والعكس. 
                <span style={{ color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                  <Shield size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  <span><strong style={{ fontWeight: 600 }}>ملاحظة أمان:</strong> حسابات المديرين والمديرين المساعدين مستثناة دائماً من شاشة الصيانة لتتمكن من إدارة النظام والتعديل في أي وقت.</span>
                </span>
              </p>

              {/* Scope Selection */}
              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "block", color: "var(--text-primary)", marginBottom: "10px", fontWeight: 600, fontSize: "14px" }}>
                  اختر نطاق الصيانة المطلوب:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                  {/* Option 1: Faculty only */}
                  <div 
                    onClick={() => setMaintenanceScope("faculty")}
                    style={{
                      background: maintenanceScope === "faculty" ? "rgba(37, 99, 235, 0.14)" : "var(--bg-deep)",
                      border: `1px solid ${maintenanceScope === "faculty" ? "var(--primary)" : "var(--border)"}`,
                      borderRadius: "12px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "border-color 0.15s ease, background-color 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: maintenanceScope === "faculty" ? "var(--accent-ink)" : "var(--text-primary)", marginBottom: "6px", fontSize: "14px" }}>
                      <UserCheck size={16} strokeWidth={1.5} />
                      <span>نظام أعضاء هيئة التدريس فقط</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                      حجب تسجيل الحضور والدرجات والمقررات عن الزملاء أثناء التحديث، بينما <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>تظل بوابة الطلاب والـ QR تعمل كالمعتاد</strong>.
                    </div>
                  </div>

                  {/* Option 2: Student Portal only */}
                  <div 
                    onClick={() => setMaintenanceScope("portal")}
                    style={{
                      background: maintenanceScope === "portal" ? "rgba(245, 158, 11, 0.14)" : "var(--bg-deep)",
                      border: `1px solid ${maintenanceScope === "portal" ? "var(--warning)" : "var(--border)"}`,
                      borderRadius: "12px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "border-color 0.15s ease, background-color 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: maintenanceScope === "portal" ? "var(--warning-ink)" : "var(--text-primary)", marginBottom: "6px", fontSize: "14px" }}>
                      <GraduationCap size={16} strokeWidth={1.5} />
                      <span>بوابة الطلاب العامة والـ QR فقط</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                      حجب بوابة الطلاب فقط (أثناء ضبط الكشوف أو التدقيق)، مع <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>استمرار عمل تطبيق التدريس للأساتذة والمعيدين</strong>.
                    </div>
                  </div>

                  {/* Option 3: All */}
                  <div 
                    onClick={() => setMaintenanceScope("all")}
                    style={{
                      background: maintenanceScope === "all" ? "rgba(239, 68, 68, 0.14)" : "var(--bg-deep)",
                      border: `1px solid ${maintenanceScope === "all" ? "var(--error)" : "var(--border)"}`,
                      borderRadius: "12px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "border-color 0.15s ease, background-color 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: maintenanceScope === "all" ? "var(--error-ink)" : "var(--text-primary)", marginBottom: "6px", fontSize: "14px" }}>
                      <Globe size={16} strokeWidth={1.5} />
                      <span>النظام بالكامل (التطبيق + بوابة الطلاب)</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                      حجب شامل لجميع الأنظمة والبوابات والخدمات لجميع المستخدمين والطلاب في آن واحد.
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Message Input */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500, fontSize: "13px" }}>
                  الرسالة التوضيحية للمستخدمين المحجوبين:
                </label>
                <textarea 
                  value={maintenanceMessage} 
                  onChange={e => setMaintenanceMessage(e.target.value)}
                  placeholder="مثال: التطبيق يخضع لصيانة وتحديثات الآن. يرجى الانتظار..."
                  rows={3}
                  style={{ width: "100%", padding: "12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: "8px", resize: "none", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <button
                  onClick={saveMaintenanceConfig}
                  disabled={loading}
                  style={{
                    padding: "10px 16px",
                    background: "var(--surface-hover)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Save size={15} strokeWidth={1.5} />
                  <span>حفظ خيارات النطاق والرسالة</span>
                </button>

                <button 
                  onClick={() => toggleMaintenance(!isMaintenance)}
                  style={{ 
                    padding: "10px 20px", 
                    background: isMaintenance ? "var(--success)" : "var(--error)", 
                    color: "#fff", 
                    border: "none", 
                    borderRadius: "8px", 
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                  disabled={loading}
                >
                  {isMaintenance ? <XCircle size={16} strokeWidth={1.5} /> : <Check size={16} strokeWidth={1.5} />}
                  <span>{loading ? "جاري التطبيق..." : isMaintenance ? "إيقاف وإنهاء وضع الصيانة" : "تفعيل وضع الصيانة بالنطاق المحدد"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shares Settings Tab */}
        {activeTab === "shares" && (
          <div>
            <h2 style={{ color: "var(--text-primary)", marginBottom: "16px", fontSize: "18px", fontWeight: 600 }}>طلبات مشاركة المقررات</h2>
            {shareRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                لا توجد طلبات مشاركة معلقة حالياً.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {shareRequests.map(req => (
                  <div key={req.id} style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--success)" }}>
                    <div style={{ marginBottom: "10px", color: "var(--text-primary)" }}>
                      <strong style={{ color: "var(--accent-ink)", fontWeight: 600 }}>{req.profiles.full_name}</strong> يطلب مشاركة المقرر: <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{req.courses.name}</strong>
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "14px" }}>
                      طلب إضافة: <strong style={{ color: "var(--warning-ink)", fontWeight: 600 }}>{req.target_name}</strong>
                    </div>
                    
                    <div style={{ marginBottom: "14px" }}>
                      <label style={{ display: "block", color: "var(--text-muted)", fontSize: "13px", marginBottom: "8px" }}>اختر الزميل (أو الزملاء) لربطهم بالمقرر:</label>
                      <select 
                        multiple
                        value={selectedColleagues[req.id] || []}
                        onChange={(e) => {
                          const values = Array.from(e.target.selectedOptions, option => option.value);
                          setSelectedColleagues(prev => ({ ...prev, [req.id]: values }));
                        }}
                        style={{ width: "100%", padding: "10px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: "8px", height: "100px" }}
                      >
                        {profilesList.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                      </select>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px" }}>يمكنك اختيار أكثر من زميل باستخدام زر Ctrl (أو سحب بإصبعك على الهاتف).</div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button 
                        onClick={() => handleApproveShare(req)}
                        style={{ flex: 1, padding: "10px", background: "var(--success)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
                      >موافقة وإضافة</button>
                      <button 
                        onClick={() => handleRejectShare(req.id)}
                        style={{ flex: 1, padding: "10px", background: "var(--error)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
                      >رفض</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* Roster Tab */}
        {activeTab === "roster" && (
          <div style={{ background: "var(--surface)", padding: "30px 20px", borderRadius: "12px", border: "1px solid var(--border)", textAlign: "center" }}>
            <ListChecks size={36} strokeWidth={1.5} style={{ color: "var(--accent-ink)", margin: "0 auto 12px", display: "block" }} />
            <h3 style={{ color: "var(--text-primary)", margin: "0 0 8px 0", fontSize: "18px", fontWeight: 600 }}>إدارة كشوف وقوائم الطلاب</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "520px", margin: "0 auto 24px auto", lineHeight: "1.7" }}>
              استيراد كشوف الطلاب من ملفات Excel، وتحديث الأكواد والفرق الدراسية، وإدارة حالات النشاط والحذف وتصدير الكشوف بصيغة Excel و PDF.
            </p>
            <button
              onClick={() => {
                onClose();
                if (onOpenRoster) onOpenRoster();
              }}
              style={{
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <FolderOpen size={16} strokeWidth={1.5} />
              <span>فتح لوحة إدارة الكشوف الكاملة</span>
            </button>
          </div>
        )}

        {/* Lockers Tab */}
        {activeTab === "lockers" && (
          <LockerAdminTab />
        )}

        </div>
    </div>
  );
}
