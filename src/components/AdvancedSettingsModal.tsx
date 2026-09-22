import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import QRScanner from "@/components/QRScanner";

import { Html5QrcodeScanner } from "html5-qrcode";
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

  const [activeTab, setActiveTab] = useState<"study" | "search" | "maintenance" | "shares" | "roster" | "portal" | "lockers">("study");
  const [portalStats, setPortalStats] = useState({ totalStudents: 0, registeredAccounts: 0, submissionsCount: 0 });
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);
  
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
    if (isOpen && activeTab === "portal") {
      fetchPortalStats();
    }
  }, [isOpen, activeTab]);

  const fetchPortalStats = async () => {
    try {
      const { count: totalSt } = await supabase.from("students").select("id", { count: "exact", head: true });
      const { count: regAcc } = await supabase.from("students").select("id", { count: "exact", head: true }).not("telegram_browser_id", "is", null);
      setPortalStats({
        totalStudents: totalSt || 0,
        registeredAccounts: regAcc || 0,
        submissionsCount: 0
      });
    } catch (e) {
      console.error(e);
    }
  };

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

  const handleClearTelegramDb = async () => {
    if (!confirm("⚠️ تحذير: هل أنت متأكد من تفريغ كافة بيانات وسجلات التليجرام بالكامل من قاعدة البيانات؟\nسيتم حذف جميع المعرفات والربط القديم نهائياً.")) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'clear_telegram_db' })
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ " + data.message);
      } else {
        alert("خطأ: " + (data.error || "فشل التفريغ"));
      }
    } catch (e: any) {
      alert("حدث خطأ في الاتصال: " + e?.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleScanner = () => {
    setIsScanning(!isScanning);
  };

  const performGlobalSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearchLoading(true);
    setStudentsList(null);
    setSelectedStudentResult(null);

    let q = query.trim();
    if (/^\d+$/.test(q) && q.length < 4) {
      q = q.padStart(4, '0');
    }

    let { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('student_code', q)
      .eq('is_active', true);

    if (!students || students.length === 0) {
      const { data: studentsByName } = await supabase
        .from('students')
        .select('*')
        .ilike('full_name', `%${q}%`)
        .eq('is_active', true);
      students = studentsByName;
    }

    if (!students || students.length === 0) {
      alert("لم يتم العثور على طالب نشط بهذا الكود أو الاسم.");
      setSearchLoading(false);
      return;
    }

    if (students.length === 1) {
      await fetchStudentDetails(students[0]);
    } else {
      setStudentsList(students);
      setSearchLoading(false);
    }
  };

  const fetchStudentDetails = async (student: any) => {
    setSearchLoading(true);
    setStudentsList(null);
    
    const { data: courses } = await supabase.from('courses').select('id, name');
    const coursesMap = new Map((courses || []).map(c => [c.id, c.name]));

    const { data: attendance } = await supabase.from('attendance').select('course_id, status').eq('student_id', student.id);
    const { data: evaluations } = await supabase.from('evaluations').select('course_id, project_name, score').eq('student_id', student.id);

    const courseStats = new Map<string, any>();

    (attendance || []).forEach(att => {
      const courseId = att.course_id;
      if (!courseStats.has(courseId)) {
        courseStats.set(courseId, { courseName: coursesMap.get(courseId) || 'مقرر محذوف', totalAbsences: 0, evaluations: [] });
      }
      if (att.status === 'غائب') {
        courseStats.get(courseId).totalAbsences += 1;
      }
    });

    (evaluations || []).forEach(ev => {
      const courseId = ev.course_id;
      if (!courseStats.has(courseId)) {
        courseStats.set(courseId, { courseName: coursesMap.get(courseId) || 'مقرر محذوف', totalAbsences: 0, evaluations: [] });
      }
      courseStats.get(courseId).evaluations.push({ project_name: ev.project_name, score: ev.score });
    });

    setSelectedStudentResult({
      student,
      courses: Array.from(courseStats.values())
    });
    setSearchLoading(false);
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
          { id: "portal", label: "بوابة الطلاب والأمان 🎓", color: "#f59e0b" },
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

              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performGlobalSearch(searchQuery)}
                  placeholder="اكتب كود أو اسم الطالب ثم اضغط Enter..."
                  style={{ flexGrow: 1, padding: "15px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px", fontSize: "16px" }}
                />
                <button 
                  onClick={() => performGlobalSearch(searchQuery)}
                  disabled={searchLoading}
                  style={{ background: "#2196F3", color: "#fff", border: "none", padding: "0 25px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                >
                  {searchLoading ? "..." : "بحث 🔍"}
                </button>
                <button 
                  onClick={toggleScanner}
                  style={{ background: isScanning ? "#f44336" : "#4CAF50", color: "#fff", border: "none", padding: "0 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  {isScanning ? "إغلاق ❌" : "كاميرا 📷"}
                </button>
              </div>

              {isScanning && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ background: "black", borderRadius: "10px", overflow: "hidden", position: "relative", height: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <QRScanner onScan={(result) => { if(result) { performGlobalSearch(extractStudentCode(result)); setIsScanning(false); } }} />
                  </div>
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
                    <div style={{ background: "#333", padding: "20px", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h2 style={{ margin: "0 0 5px 0", color: "#fff" }}>{searchResult.student.full_name}</h2>
                        <div style={{ color: "#aaa" }}>
                          الكود: <strong style={{ color: "#fff" }}>{searchResult.student.student_code}</strong> | 
                          الفرقة: <strong style={{ color: "#fff" }}>{searchResult.student.academic_year}</strong> |
                          السكشن: <strong style={{ color: "#fff" }}>{searchResult.student.section}</strong>
                        </div>
                      </div>
                    </div>

                    <h3 style={{ color: "#4CAF50", borderBottom: "1px solid #444", paddingBottom: "10px", marginBottom: "15px" }}>📊 سجل المقررات</h3>
                    
                    {searchResult.courses.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px", color: "#888", background: "#111", borderRadius: "8px" }}>لا توجد بيانات حضور أو تقييمات لهذا الطالب في أي مقرر.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
                        {searchResult.courses.map((c: any, idx: number) => (
                          <div key={idx} style={{ background: "#111", padding: "15px", borderRadius: "8px", border: "1px solid #333" }}>
                            <h4 style={{ color: "#2196F3", marginTop: 0, marginBottom: "15px", fontSize: "18px" }}>📘 {c.courseName}</h4>
                            
                            <div style={{ marginBottom: "15px", background: "#222", padding: "10px", borderRadius: "5px" }}>
                              <div style={{ color: "#aaa", fontSize: "14px", marginBottom: "5px" }}>إجمالي مرات الغياب</div>
                              <div style={{ color: c.totalAbsences >= 3 ? "#f44336" : "#fff", fontSize: "24px", fontWeight: "bold" }}>
                                {c.totalAbsences} <span style={{ fontSize: "14px", fontWeight: "normal" }}>مرة</span>
                              </div>
                            </div>

                            <div style={{ background: "#222", padding: "10px", borderRadius: "5px" }}>
                              <div style={{ color: "#aaa", fontSize: "14px", marginBottom: "10px" }}>التقييمات والدرجات</div>
                              {c.evaluations.length === 0 ? (
                                <div style={{ color: "#666", fontSize: "13px" }}>لا توجد درجات مسجلة</div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {c.evaluations.map((ev: any, evIdx: number) => (
                                    <div key={evIdx} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #333", paddingBottom: "5px" }}>
                                      <span style={{ color: "#ccc", fontSize: "14px" }}>{ev.project_name}</span>
                                      <strong style={{ color: "#4CAF50" }}>{ev.score}</strong>
                                    </div>
                                  ))}
                                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "5px", borderTop: "1px solid #555" }}>
                                    <strong style={{ color: "#fff" }}>الإجمالي:</strong>
                                    <strong style={{ color: "#ff9800" }}>{c.evaluations.reduce((acc: number, curr: any) => acc + Number(curr.score), 0)}</strong>
                                  </div>
                                </div>
                              )}
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

        {/* Portal Tab */}
        {activeTab === "portal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* جناج الأمان وكشف الاحتيال المتقدم */}
            <div style={{
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.15))",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "14px",
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px"
            }}>
              <div style={{ flex: "1 1 300px" }}>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🚨</span> جناح الأمان الأكاديمي: كشف الغش والاحتيال وتطابق الأعمال
                </div>
                <div style={{ color: "#cbd5e1", fontSize: "12px", marginTop: "4px", lineHeight: "1.6" }}>
                  فحص أجهزة الموبايل المشتركة (كشف فتح أكثر من حساب على نفس الهاتف)، خوارزمية مطابقة اللوحات والمجسمات الفنية، وبحث وفرمتة الحسابات المشبوهة.
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  if (onOpenPortalHub) onOpenPortalHub();
                }}
                className="btn-compact"
                style={{
                  background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(239, 68, 68, 0.3)"
                }}
              >
                <span>🛡️</span> فتح لوحة كشف الاحتيال والتلاعب
              </button>
            </div>

            {/* Quick Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
              <div style={{ background: "#1a2430", border: "1px solid #1e3a5f", padding: "14px", borderRadius: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#90CAF9" }}>إجمالي الطلاب المقيدين</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {portalStats.totalStudents || "--"}
                </div>
              </div>
              <div style={{ background: "#1a2a1a", border: "1px solid #2e4a2e", padding: "14px", borderRadius: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#81C784" }}>حسابات الطلاب المسجلة</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
                  {portalStats.registeredAccounts || "0"}
                </div>
              </div>
            </div>

            {/* Public Student Portal */}
            <div style={{ background: "#222", border: "1px solid #333", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{ background: "rgba(33, 150, 243, 0.2)", color: "#2196F3", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                  🎓
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>بوابة الطلاب العامة (بوابة فنية)</div>
                  <div style={{ color: "#888", fontSize: "12px" }}>الرابط المخصص للطلاب لاستخراج كارت الـ QR ومتابعة الحضور.</div>
                </div>
              </div>
              <div style={{ background: "#151515", border: "1px dashed #444", padding: "10px 14px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                <span style={{ color: "#64B5F6", fontSize: "13px", direction: "ltr" }}>
                  {typeof window !== "undefined" ? `${window.location.origin}/student-portal` : "/student-portal"}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(typeof window !== "undefined" ? `${window.location.origin}/student-portal` : "/student-portal");
                        setCopiedPortalLink(true);
                        setTimeout(() => setCopiedPortalLink(false), 2000);
                      }
                    }}
                    style={{ background: copiedPortalLink ? "#4CAF50" : "#333", color: "#fff", border: "none", padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    {copiedPortalLink ? "✓ تم النسخ" : "📋 نسخ"}
                  </button>
                  <button
                    onClick={() => window.open("/student-portal", "_blank")}
                    style={{ background: "#2196F3", color: "#fff", border: "none", padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    🌐 فتح
                  </button>
                </div>
              </div>
            </div>

            {/* Instructor Gallery */}
            <div style={{ background: "#222", border: "1px solid #333", borderRadius: "12px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "rgba(76, 175, 80, 0.2)", color: "#4CAF50", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                  🖼️
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>معرض أعمال ومشاريع الطلاب</div>
                  <div style={{ color: "#888", fontSize: "12px" }}>فحص الأعمال وتقييم مشاريع الطلاب للمدرسين والمعيدين.</div>
                </div>
              </div>
              <button
                onClick={() => { onClose(); window.open("/instructor", "_blank"); }}
                style={{ background: "#4CAF50", color: "#fff", border: "none", padding: "9px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}
              >
                🎨 الانتقال للمعرض
              </button>
            </div>

            {/* Admin Portal Control (Only Primary Admin) */}
            {user?.role === "مدير" && (
              <div style={{ background: "#222", border: "1px solid #333", borderRadius: "12px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ background: "rgba(156, 39, 176, 0.2)", color: "#AB47BC", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                    🛡️
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>لوحة إدارة حسابات الطلاب المركزية</div>
                    <div style={{ color: "#888", fontSize: "12px" }}>متابعة سجلات التدقيق، فك أجهزة الطلاب، وإلغاء الحسابات.</div>
                  </div>
                </div>
                <button
                  onClick={() => { onClose(); window.open("/admin-portal", "_blank"); }}
                  style={{ background: "#7B1FA2", color: "#fff", border: "none", padding: "9px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}
                >
                  ⚙️ لوحة الإدارة
                </button>
              </div>
            )}

            {/* Clear Telegram Database Card */}
            {user?.role === "مدير" && (
              <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px dashed rgba(239, 68, 68, 0.4)", borderRadius: "12px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                    🧹
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>تفريغ قاعدة بيانات التليجرام بالكامل</div>
                    <div style={{ color: "#f87171", fontSize: "12px" }}>مسح وتصفير كافة معرفات التليجرام وسجلات البوت القديمة من الجداول.</div>
                  </div>
                </div>
                <button
                  onClick={handleClearTelegramDb}
                  disabled={loading}
                  style={{ background: "#ef4444", color: "#fff", border: "none", padding: "9px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "جاري التفريغ..." : "تفريغ الآن 🗑️"}
                </button>
              </div>
            )}
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
