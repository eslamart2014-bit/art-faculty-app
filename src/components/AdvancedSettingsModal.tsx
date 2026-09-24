import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import QRScanner from "@/components/QRScanner";

import { extractStudentCode } from "@/lib/scannerHelper";
import LockerAdminTab from "./lockers/LockerAdminTab";

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
    const raw = query ? query.trim() : '';
    if (!raw) return;
    setSearchLoading(true);
    setStudentsList(null);
    setSelectedStudentResult(null);

    try {
      const cleanNumeric = raw.replace(/^0+/, '') || '0';
      const padded4 = cleanNumeric.padStart(4, '0');
      const isNum = /^\d+$/.test(raw);

      let foundStudents: any[] = [];

      if (isNum) {
        // Query by numeric codes (exact, unpadded, padded)
        const { data: byCode } = await supabase
          .from('students')
          .select('*')
          .or(`student_code.eq.${raw},student_code.eq.${cleanNumeric},student_code.eq.${padded4}`);
        
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
          // 1. Try matching normalized name or code
          foundStudents = allStudents.filter(s => {
            const normName = normalizeArabic(s.full_name || '');
            const sc = (s.student_code || '').trim();
            const scClean = sc.replace(/^0+/, '');
            return normName.includes(normQ) || sc === raw || scClean === cleanNumeric || sc === padded4;
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
        if (c.academic_year === student.academic_year) {
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
      background: "rgba(0,0,0,0.85)", zIndex: 1000,
      display: "flex", flexDirection: "column", direction: "rtl"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "12px 18px", 
        background: "#181f2c", 
        borderBottom: "1px solid #2a374f",
        minHeight: "56px"
      }}>
        <div>
          <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🧩</span> الإعدادات المتقدمة
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

      <div 
        className="no-scrollbar"
        style={{ 
          display: "flex", 
          flexWrap: "nowrap", 
          overflowX: "auto", 
          whiteSpace: "nowrap", 
          gap: "6px", 
          padding: "10px 14px", 
          background: "#121824", 
          borderBottom: "1px solid #2a374f",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch"
        }}
      >
        {[
          { id: "study", label: "الدراسة والتواريخ 📅", color: "#38bdf8" },
          { id: "search", label: "البحث الشامل 🔍", color: "#38bdf8" },
          { id: "roster", label: "كشوف الطلاب 📋", color: "#00BCD4" },
          { id: "lockers", label: "بوابة الدواليب 🗄️", color: "#6366f1" },
          { id: "shares", label: "طلبات المشاركة 🤝", color: "#10b981" },
          { id: "maintenance", label: "وضع الصيانة 🚧", color: "#ef4444" },
        ].map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className="btn-compact"
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: "10px",
                border: isActive ? `1px solid ${t.color}` : "1px solid rgba(255,255,255,0.08)",
                background: isActive ? `${t.color}22` : "rgba(255,255,255,0.03)",
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
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto" }}>
        
        {/* Study Settings Tab */}
        {activeTab === "study" && (
          <div>
            <div style={{ background: "#222", padding: "20px", borderRadius: "10px", border: "1px solid #333", marginBottom: "20px" }}>
              <p style={{ color: "#aaa", fontSize: "14px", marginTop: 0, marginBottom: "20px" }}>
                قم بتحديد تواريخ بداية كل ترم. سيقوم النظام بحساب رقم الأسبوع تلقائياً بناءً على هذه التواريخ ودمجها في التقارير (PDF).
              </p>
              
              <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>بداية الترم الأول</label>
                  <input type="date" value={term1Start} onChange={(e) => setTerm1Start(e.target.value)} style={{ width: "100%", padding: "12px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>نهاية الترم الأول</label>
                  <input type="date" value={term1End} onChange={(e) => setTerm1End(e.target.value)} style={{ width: "100%", padding: "12px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px" }} />
                </div>
              </div>

              <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>بداية الترم الثاني</label>
                  <input type="date" value={term2Start} onChange={(e) => setTerm2Start(e.target.value)} style={{ width: "100%", padding: "12px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>نهاية الترم الثاني</label>
                  <input type="date" value={term2End} onChange={(e) => setTerm2End(e.target.value)} style={{ width: "100%", padding: "12px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px" }} />
                </div>
              </div>

              <button 
                onClick={saveSettings} 
                disabled={loading}
                style={{ width: "100%", padding: "15px", background: "#4CAF50", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? "جاري الحفظ..." : "حفظ إعدادات التواريخ"}
              </button>
            </div>
          </div>
        )}

        {/* Global Search Tab */}
        {activeTab === "search" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#222", padding: "20px", borderRadius: "10px", border: "1px solid #333", textAlign: "center" }}>
              <div style={{ fontSize: "50px", marginBottom: "15px" }}>🌍</div>
              <h3 style={{ color: "#fff", margin: "0 0 10px 0" }}>البحث الشامل للطلاب</h3>
              <p style={{ color: "#aaa", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                ابحث برقم الطالب أو اسمه أو قم بمسح بطاقته للحصول على تقرير مفصل بجميع مقرراته وحضوره وتقييماته في مكان واحد.
              </p>

              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", width: "100%", alignItems: "stretch", boxSizing: "border-box" }}>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performGlobalSearch(searchQuery)}
                  placeholder="كود أو اسم الطالب..."
                  style={{ flex: 1, minWidth: 0, height: "44px", padding: "0 12px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }}
                />
                <button 
                  onClick={() => performGlobalSearch(searchQuery)}
                  disabled={searchLoading}
                  style={{ height: "44px", background: "#2196F3", color: "#fff", border: "none", padding: "0 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap", flexShrink: 0, boxSizing: "border-box" }}
                >
                  {searchLoading ? "..." : "بحث 🔍"}
                </button>
                <button 
                  onClick={toggleScanner}
                  style={{ height: "44px", background: isScanning ? "#f44336" : "#4CAF50", color: "#fff", border: "none", padding: "0 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "13px", whiteSpace: "nowrap", flexShrink: 0, boxSizing: "border-box" }}
                  title={isScanning ? "إغلاق الكاميرا" : "مسح QR بالكاميرا"}
                >
                  {isScanning ? "إغلاق ❌" : "📷"}
                </button>
              </div>

              {isScanning && (
                <div style={{ marginBottom: "20px", borderRadius: "14px", overflow: "hidden" }}>
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
                    title="ماسح بطاقة الطالب"
                  />
                </div>
              )}

              {/* نتائج البحث */}
              {/* نتائج البحث */}
              {studentsList && !selectedStudentResult && (
                <div style={{ background: "#222", padding: "15px", borderRadius: "10px", marginTop: "20px" }}>
                  <h3 style={{ color: "#2196F3", marginTop: 0, borderBottom: "1px solid #444", paddingBottom: "10px" }}>تم العثور على {studentsList.length} طلاب</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
                    {studentsList.map((student: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", padding: "15px", borderRadius: "8px", border: "1px solid #333" }}>
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: "16px", color: "#fff" }}>{student.full_name}</div>
                          <div style={{ color: "#aaa", fontSize: "13px", marginTop: "5px" }}>
                            الكود: {student.student_code} | الفرقة: {student.academic_year} | السكشن: {student.section}
                          </div>
                        </div>
                        <button 
                          onClick={() => fetchStudentDetails(student)}
                          style={{ background: "#4CAF50", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
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
                        style={{ background: "transparent", color: "#2196F3", border: "1px solid #2196F3", padding: "8px 15px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        🔙 عودة لنتائج البحث
                      </button>
                    </div>
                    <div style={{ background: "#1c2433", border: "1px solid #2e3e5b", padding: "18px", borderRadius: "12px", marginBottom: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <h2 style={{ margin: "0", color: "#fff", fontSize: "20px", fontWeight: "bold" }}>{searchResult.student.full_name}</h2>
                            <span style={{
                              background: searchResult.student.is_active ? "rgba(76, 175, 80, 0.2)" : "rgba(244, 67, 54, 0.2)",
                              color: searchResult.student.is_active ? "#4CAF50" : "#f44336",
                              border: `1px solid ${searchResult.student.is_active ? '#4CAF50' : '#f44336'}`,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "bold"
                            }}>
                              {searchResult.student.is_active ? "🟢 طالب نشط" : "🔴 غير نشط / مؤرشف"}
                            </span>
                          </div>

                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px", color: "#cbd5e1", fontSize: "13px" }}>
                            <span>كود: <strong style={{ color: "#38bdf8" }}>{searchResult.student.student_code}</strong></span>
                            <span>|</span>
                            <span>الفرقة: <strong style={{ color: "#fff" }}>{searchResult.student.academic_year}</strong></span>
                            <span>|</span>
                            <span>السكشن: <strong style={{ color: "#fff" }}>{searchResult.student.section || 'عام'}</strong></span>
                            {(searchResult.account?.mobile || searchResult.student?.phone) && (
                              <>
                                <span>|</span>
                                <span>هاتف: <strong style={{ color: "#fbbf24" }}>{searchResult.account?.mobile || searchResult.student?.phone}</strong></span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Badges: Locker & Portal */}
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {searchResult.lockerInfo && (
                            <div style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid #38bdf8", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold" }}>
                              🚪 {searchResult.lockerInfo}
                            </div>
                          )}
                          <div style={{
                            background: searchResult.account ? (searchResult.account.id_card_verified ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)") : "rgba(100, 116, 139, 0.15)",
                            color: searchResult.account ? (searchResult.account.id_card_verified ? "#34d399" : "#fbbf24") : "#94a3b8",
                            border: `1px solid ${searchResult.account ? (searchResult.account.id_card_verified ? '#34d399' : '#fbbf24') : '#64748b'}`,
                            padding: "4px 10px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "bold"
                          }}>
                            {searchResult.account 
                              ? (searchResult.account.id_card_verified ? "📱 مسجل بالبوابة وموثق" : "📱 مسجل بالبوابة (قيد الاعتماد)")
                              : "📱 غير مسجل بالبوابة"}
                          </div>
                        </div>
                      </div>

                      {/* Overall Summary Row */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginTop: "15px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ background: "#111827", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                          <div style={{ color: "#94a3b8", fontSize: "11px" }}>المقررات المقيدة</div>
                          <div style={{ color: "#38bdf8", fontSize: "18px", fontWeight: "bold" }}>{searchResult.courses.length}</div>
                        </div>
                        <div style={{ background: "#111827", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                          <div style={{ color: "#94a3b8", fontSize: "11px" }}>إجمالي الحضور</div>
                          <div style={{ color: "#4CAF50", fontSize: "18px", fontWeight: "bold" }}>
                            {searchResult.courses.reduce((sum: number, c: any) => sum + (c.totalAttended || 0), 0)}
                          </div>
                        </div>
                        <div style={{ background: "#111827", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                          <div style={{ color: "#94a3b8", fontSize: "11px" }}>إجمالي الغياب</div>
                          <div style={{ color: "#f44336", fontSize: "18px", fontWeight: "bold" }}>
                            {searchResult.courses.reduce((sum: number, c: any) => sum + (c.totalAbsences || 0), 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <h3 style={{ color: "#4CAF50", borderBottom: "1px solid #444", paddingBottom: "10px", marginBottom: "15px" }}>📊 سجل المقررات الدراسية</h3>
                    
                    {searchResult.courses.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px", color: "#888", background: "#111", borderRadius: "8px" }}>لا توجد مقررات مسجلة لهذا الطالب حالياً.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
                        {searchResult.courses.map((c: any, idx: number) => (
                          <div key={idx} style={{ background: "#111", padding: "15px", borderRadius: "10px", border: "1px solid #333", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <h4 style={{ color: "#2196F3", margin: 0, fontSize: "16px", fontWeight: "bold" }}>📘 {c.courseName}</h4>
                                {c.term && (
                                  <span style={{ background: "#222", color: "#aaa", fontSize: "11px", padding: "2px 6px", borderRadius: "4px" }}>{c.term}</span>
                                )}
                              </div>
                              
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                                <div style={{ background: "#1e1e1e", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                                  <div style={{ color: "#888", fontSize: "11px" }}>مرات الحضور</div>
                                  <div style={{ color: "#4CAF50", fontSize: "18px", fontWeight: "bold" }}>{c.totalAttended || 0}</div>
                                </div>
                                <div style={{ background: "#1e1e1e", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                                  <div style={{ color: "#888", fontSize: "11px" }}>مرات الغياب</div>
                                  <div style={{ color: (c.totalAbsences || 0) >= 3 ? "#f44336" : "#ff9800", fontSize: "18px", fontWeight: "bold" }}>{c.totalAbsences || 0}</div>
                                </div>
                              </div>

                              <div style={{ background: "#1a1a1a", padding: "10px", borderRadius: "8px" }}>
                                <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "8px", fontWeight: "bold" }}>التقييمات والدرجات:</div>
                                {(!c.evaluations || c.evaluations.length === 0) ? (
                                  <div style={{ color: "#666", fontSize: "12px", textAlign: "center", padding: "6px 0" }}>لا توجد درجات مسجلة</div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {c.evaluations.map((ev: any, evIdx: number) => (
                                      <div key={evIdx} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #2a2a2a", paddingBottom: "4px", fontSize: "13px" }}>
                                        <span style={{ color: "#ccc" }}>{ev.project_name}</span>
                                        <strong style={{ color: "#4CAF50" }}>{ev.score}</strong>
                                      </div>
                                    ))}
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px", borderTop: "1px solid #444", fontSize: "13px" }}>
                                      <strong style={{ color: "#fff" }}>الإجمالي:</strong>
                                      <strong style={{ color: "#ff9800" }}>{c.evaluations.reduce((acc: number, curr: any) => acc + Number(curr.score || 0), 0)}</strong>
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
            <div style={{ background: "#222", padding: "20px", borderRadius: "14px", border: `1px solid ${isMaintenance ? "#f44336" : "#333"}`, marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                <h3 style={{ color: isMaintenance ? "#f44336" : "#4CAF50", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "22px" }}>🚧</span> وضع الصيانة والتحكم في النطاق
                </h3>
                <div style={{
                  background: isMaintenance ? "rgba(244, 67, 54, 0.15)" : "rgba(76, 175, 80, 0.15)",
                  color: isMaintenance ? "#ef5350" : "#81c784",
                  border: `1px solid ${isMaintenance ? "#f44336" : "#4CAF50"}`,
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "bold"
                }}>
                  {isMaintenance ? (
                    maintenanceScope === "faculty" ? "⚠️ نشط: نظام أعضاء هيئة التدريس فقط" :
                    maintenanceScope === "portal" ? "⚠️ نشط: بوابة الطلاب فقط" : "⛔ نشط: النظام بالكامل"
                  ) : "🟢 النظام يعمل طبيعياً للجميع"}
                </div>
              </div>

              <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px", lineHeight: "1.6" }}>
                يمكنك تحديد <strong>الجزء أو النطاق المحدد</strong> الذي ترغب في وضعه قيد الصيانة، لمنع إيقاف خدمات الطلاب عند تحديث نظام أعضاء هيئة التدريس، والعكس. 
                <span style={{ color: "#64B5F6", display: "block", marginTop: "4px" }}>
                  🛡️ <strong>ملاحظة أمان:</strong> حسابات المديرين والمديرين المساعدين مستثناة دائماً من شاشة الصيانة لتتمكن من إدارة النظام والتعديل في أي وقت.
                </span>
              </p>

              {/* Scope Selection */}
              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "block", color: "#fff", marginBottom: "10px", fontWeight: "bold", fontSize: "14px" }}>
                  اختر نطاق الصيانة المطلوب:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                  {/* Option 1: Faculty only */}
                  <div 
                    onClick={() => setMaintenanceScope("faculty")}
                    style={{
                      background: maintenanceScope === "faculty" ? "rgba(33, 150, 243, 0.15)" : "#161616",
                      border: `2px solid ${maintenanceScope === "faculty" ? "#2196F3" : "#333"}`,
                      borderRadius: "10px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", color: maintenanceScope === "faculty" ? "#64B5F6" : "#fff", marginBottom: "6px" }}>
                      <span>👨‍🏫 نظام أعضاء هيئة التدريس فقط</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.5" }}>
                      حجب تسجيل الحضور والدرجات والمقررات عن الزملاء أثناء التحديث، بينما <strong>تظل بوابة الطلاب والـ QR تعمل كالمعتاد</strong>.
                    </div>
                  </div>

                  {/* Option 2: Student Portal only */}
                  <div 
                    onClick={() => setMaintenanceScope("portal")}
                    style={{
                      background: maintenanceScope === "portal" ? "rgba(156, 39, 176, 0.15)" : "#161616",
                      border: `2px solid ${maintenanceScope === "portal" ? "#AB47BC" : "#333"}`,
                      borderRadius: "10px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", color: maintenanceScope === "portal" ? "#BA68C8" : "#fff", marginBottom: "6px" }}>
                      <span>🎓 بوابة الطلاب العامة والـ QR فقط</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.5" }}>
                      حجب بوابة الطلاب فقط (أثناء ضبط الكشوف أو التدقيق)، مع <strong>استمرار عمل تطبيق التدريس للأساتذة والمعيدين</strong>.
                    </div>
                  </div>

                  {/* Option 3: All */}
                  <div 
                    onClick={() => setMaintenanceScope("all")}
                    style={{
                      background: maintenanceScope === "all" ? "rgba(244, 67, 54, 0.15)" : "#161616",
                      border: `2px solid ${maintenanceScope === "all" ? "#f44336" : "#333"}`,
                      borderRadius: "10px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", color: maintenanceScope === "all" ? "#ef5350" : "#fff", marginBottom: "6px" }}>
                      <span>🌐 النظام بالكامل (التطبيق + بوابة الطلاب)</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.5" }}>
                      حجب شامل لجميع الأنظمة والبوابات والخدمات لجميع المستخدمين والطلاب في آن واحد.
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Message Input */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>
                  الرسالة التوضيحية للمستخدمين المحجوبين:
                </label>
                <textarea 
                  value={maintenanceMessage} 
                  onChange={e => setMaintenanceMessage(e.target.value)}
                  placeholder="مثال: التطبيق يخضع لصيانة وتحديثات الآن. يرجى الانتظار..."
                  rows={3}
                  style={{ width: "100%", padding: "12px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px", resize: "none", fontSize: "14px" }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <button
                  onClick={saveMaintenanceConfig}
                  disabled={loading}
                  style={{
                    padding: "10px 18px",
                    background: "#333",
                    color: "#fff",
                    border: "1px solid #555",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "13px"
                  }}
                >
                  حفظ خيارات النطاق والرسالة 💾
                </button>

                <button 
                  onClick={() => toggleMaintenance(!isMaintenance)}
                  style={{ 
                    padding: "12px 24px", 
                    background: isMaintenance ? "#4CAF50" : "#f44336", 
                    color: "#fff", 
                    border: "none", 
                    borderRadius: "8px", 
                    fontWeight: "bold",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                  disabled={loading}
                >
                  {loading ? "جاري التطبيق..." : isMaintenance ? "إيقاف وإنهاء وضع الصيانة ❌" : "تفعيل وضع الصيانة بالنطاق المحدد ✅"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shares Settings Tab */}
        {activeTab === "shares" && (
          <div>
            <h2 style={{ color: "#fff", marginBottom: "20px" }}>طلبات مشاركة المقررات</h2>
            {shareRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#888", background: "#222", borderRadius: "10px" }}>
                لا توجد طلبات مشاركة معلقة حالياً.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {shareRequests.map(req => (
                  <div key={req.id} style={{ background: "#222", padding: "15px", borderRadius: "10px", border: "1px solid #4CAF50" }}>
                    <div style={{ marginBottom: "10px" }}>
                      <strong style={{ color: "#2196F3" }}>{req.profiles.full_name}</strong> يطلب مشاركة المقرر: <strong style={{ color: "#fff" }}>{req.courses.name}</strong>
                    </div>
                    <div style={{ color: "#aaa", fontSize: "14px", marginBottom: "15px" }}>
                      طلب إضافة: <strong style={{ color: "#FF9800" }}>{req.target_name}</strong>
                    </div>
                    
                    <div style={{ marginBottom: "15px" }}>
                      <label style={{ display: "block", color: "#aaa", fontSize: "13px", marginBottom: "8px" }}>اختر الزميل (أو الزملاء) لربطهم بالمقرر:</label>
                      <select 
                        multiple
                        value={selectedColleagues[req.id] || []}
                        onChange={(e) => {
                          const values = Array.from(e.target.selectedOptions, option => option.value);
                          setSelectedColleagues(prev => ({ ...prev, [req.id]: values }));
                        }}
                        style={{ width: "100%", padding: "10px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "5px", height: "100px" }}
                      >
                        {profilesList.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                      </select>
                      <div style={{ fontSize: "11px", color: "#888", marginTop: "5px" }}>يمكنك اختيار أكثر من زميل باستخدام زر Ctrl (أو سحب بإصبعك على الهاتف).</div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button 
                        onClick={() => handleApproveShare(req)}
                        style={{ flex: 1, padding: "10px", background: "#4CAF50", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
                      >موافقة وإضافة</button>
                      <button 
                        onClick={() => handleRejectShare(req.id)}
                        style={{ flex: 1, padding: "10px", background: "#f44336", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
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
          <div style={{ background: "#222", padding: "30px 20px", borderRadius: "12px", border: "1px solid #333", textAlign: "center" }}>
            <div style={{ fontSize: "44px", marginBottom: "12px" }}>📋</div>
            <h3 style={{ color: "#fff", margin: "0 0 8px 0", fontSize: "18px" }}>إدارة كشوف وقوائم الطلاب</h3>
            <p style={{ color: "#aaa", fontSize: "14px", maxWidth: "520px", margin: "0 auto 24px auto", lineHeight: "1.7" }}>
              استيراد كشوف الطلاب من ملفات Excel، وتحديث الأكواد والفرق الدراسية، وإدارة حالات النشاط والحذف وتصدير الكشوف بصيغة Excel و PDF.
            </p>
            <button
              onClick={() => {
                onClose();
                if (onOpenRoster) onOpenRoster();
              }}
              style={{
                background: "#00BCD4",
                color: "#000",
                border: "none",
                padding: "12px 28px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span>📂</span> فتح لوحة إدارة الكشوف الكاملة
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
