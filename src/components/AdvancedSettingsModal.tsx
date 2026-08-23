import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import QRScanner from "@/components/QRScanner";

import { Html5QrcodeScanner } from "html5-qrcode";
import { extractStudentCode } from "@/lib/scannerHelper";

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdvancedSettingsModal({ isOpen, onClose }: AdvancedSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"study" | "students" | "search" | null>("study");
  
  // Study Settings state
  const [term1Start, setTerm1Start] = useState("");
  const [term2Start, setTerm2Start] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Analytics state
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Global Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== "search") {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      setIsScanning(false);
    }
  }, [isOpen, activeTab]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from("system_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      if (data.term1_start) setTerm1Start(data.term1_start);
      if (data.term2_start) setTerm2Start(data.term2_start);
    }
    setLoading(false);
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    const { data, error } = await supabase.from("portal_analytics").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      setAnalytics(data);
    }
    setLoadingAnalytics(false);
  };

  useEffect(() => {
    if (isOpen && activeTab === "students") {
      fetchAnalytics();
    }
  }, [isOpen, activeTab]);

  const clearAnalytics = async () => {
    if (!confirm("هل أنت متأكد من مسح جميع إحصائيات البوابة بالكامل؟")) return;
    setLoadingAnalytics(true);
    await fetch('/api/analytics/clear', { method: 'POST' });
    setAnalytics([]);
    setLoadingAnalytics(false);
    alert("تم مسح الإحصائيات بنجاح!");
  };

  const saveSettings = async () => {
    setLoading(true);
    const { error } = await supabase.from("system_settings").upsert({
      id: 1,
      term1_start: term1Start || null,
      term2_start: term2Start || null,
      updated_at: new Date().toISOString()
    });

    if (error) {
      alert("حدث خطأ أثناء الحفظ");
    } else {
      alert("تم حفظ تواريخ الفصول الدراسية بنجاح!");
    }
    setLoading(false);
  };

  const toggleScanner = () => {
    if (isScanning) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      setIsScanning(false);
    } else {
      setIsScanning(true);
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          "global-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scannerRef.current = scanner;
        scanner.render(
          (text) => {
            scanner.clear();
            scannerRef.current = null;
            setIsScanning(false);
            const studentCode = extractStudentCode(text);
            setSearchQuery(studentCode);
            performGlobalSearch(studentCode);
          },
          (err) => {
            // ignore
          }
        );
      }, 100);
    }
  };

  const performGlobalSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);

    // 1. Find Student (First by code, then by name)
    let { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('student_code', query)
      .limit(1);

    if (!students || students.length === 0) {
      const { data: studentsByName } = await supabase
        .from('students')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .limit(1);
      students = studentsByName;
    }

    if (!students || students.length === 0) {
      alert("لم يتم العثور على طالب بهذا الكود أو الاسم.");
      setSearchLoading(false);
      return;
    }

    const student = students[0];

    // 2. Fetch all courses
    const { data: courses } = await supabase.from('courses').select('id, name');
    const coursesMap = new Map((courses || []).map(c => [c.id, c.name]));

    // 3. Fetch attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('course_id, status')
      .eq('student_id', student.id);

    // 4. Fetch evaluations
    const { data: evaluations } = await supabase
      .from('evaluations')
      .select('course_id, project_name, score')
      .eq('student_id', student.id);

    // Aggregate data by course
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

    setSearchResult({
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px", background: "#1e1e1e", borderBottom: "1px solid #333" }}>
        <h2 style={{ margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
          <span>🧩</span> الإعدادات المتقدمة
        </h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: "24px", cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ display: "flex", background: "#222", borderBottom: "1px solid #333" }}>
        <button 
          onClick={() => setActiveTab("study")}
          style={{ flex: 1, padding: "15px", background: activeTab === "study" ? "#333" : "transparent", color: activeTab === "study" ? "#fff" : "#888", border: "none", borderBottom: activeTab === "study" ? "2px solid #2196F3" : "none", fontWeight: "bold", cursor: "pointer" }}
        >إعدادات الدراسة</button>
        <button 
          onClick={() => setActiveTab("students")}
          style={{ flex: 1, padding: "15px", background: activeTab === "students" ? "#333" : "transparent", color: activeTab === "students" ? "#fff" : "#888", border: "none", borderBottom: activeTab === "students" ? "2px solid #2196F3" : "none", fontWeight: "bold", cursor: "pointer" }}
        >بوابة الطلاب</button>
        <button 
          onClick={() => setActiveTab("search")}
          style={{ flex: 1, padding: "15px", background: activeTab === "search" ? "#333" : "transparent", color: activeTab === "search" ? "#fff" : "#888", border: "none", borderBottom: activeTab === "search" ? "2px solid #2196F3" : "none", fontWeight: "bold", cursor: "pointer" }}
        >البحث الشامل 🔍</button>
      </div>

      <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto" }}>
        
        {/* Study Settings Tab */}
        {activeTab === "study" && (
          <div>
            <div style={{ background: "#222", padding: "20px", borderRadius: "10px", border: "1px solid #333", marginBottom: "20px" }}>
              <p style={{ color: "#aaa", fontSize: "14px", marginTop: 0, marginBottom: "20px" }}>
                قم بتحديد تواريخ بداية كل ترم. سيقوم النظام بحساب رقم الأسبوع تلقائياً بناءً على هذه التواريخ ودمجها في التقارير (PDF).
              </p>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>الترم الأول</label>
                <input 
                  type="date" 
                  value={term1Start} 
                  onChange={(e) => setTerm1Start(e.target.value)}
                  style={{ width: "100%", padding: "12px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>الترم الثاني</label>
                <input 
                  type="date" 
                  value={term2Start} 
                  onChange={(e) => setTerm2Start(e.target.value)}
                  style={{ width: "100%", padding: "12px", background: "#111", border: "1px solid #444", color: "#fff", borderRadius: "8px" }}
                />
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

        {/* Student Settings & Analytics Tab */}
        {activeTab === "students" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* بوابة الطلاب */}
            <div style={{ background: "#222", padding: "20px", borderRadius: "10px", border: "1px solid #333", textAlign: "center" }}>
              <div style={{ fontSize: "50px", marginBottom: "15px" }}>🎓</div>
              <h3 style={{ color: "#fff", margin: "0 0 10px 0" }}>بوابة الطلاب المستقلة</h3>
              <p style={{ color: "#aaa", fontSize: "14px", lineHeight: 1.6 }}>
                هذه البوابة تمكن الطلاب من الدخول واختيار الفرقة الخاصة بهم، ثم البحث عن أسمائهم للحصول على الـ (QR Code) الخاص بهم بشكل مباشر لالتقاط سكرين شوت له.
              </p>
              
              <div style={{ marginTop: "25px", background: "#111", padding: "15px", borderRadius: "8px", border: "1px solid #444" }}>
                <div style={{ color: "#4CAF50", fontWeight: "bold", marginBottom: "10px" }}>رابط بوابة الطلاب لمشاركته:</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={typeof window !== "undefined" ? `${window.location.origin}/student-portal` : ""}
                    style={{ flexGrow: 1, padding: "10px", background: "#000", border: "1px solid #333", color: "#fff", borderRadius: "5px", direction: "ltr", textAlign: "left" }}
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/student-portal`);
                      alert("تم نسخ الرابط بنجاح!");
                    }}
                    style={{ background: "#2196F3", color: "#fff", border: "none", padding: "0 15px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
                  >نسخ</button>
                </div>
              </div>
            </div>
            
            {/* قسم الإحصائيات */}
            <div style={{ background: "#222", padding: "20px", borderRadius: "10px", border: "1px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ color: "#fff", margin: 0 }}>📊 إحصائيات ونشاط الأجهزة</h3>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={fetchAnalytics} disabled={loadingAnalytics} style={{ background: "#333", color: "#fff", border: "1px solid #444", padding: "8px 15px", borderRadius: "5px", cursor: "pointer" }}>
                    {loadingAnalytics ? "جاري التحديث..." : "تحديث 🔄"}
                  </button>
                  <button onClick={clearAnalytics} disabled={loadingAnalytics} style={{ background: "#f44336", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "5px", cursor: "pointer" }}>
                    تفريغ السجل 🗑️
                  </button>
                </div>
              </div>

              {analytics.length === 0 && !loadingAnalytics ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#888" }}>لا توجد بيانات إحصائية حتى الآن.</div>
              ) : (
                <>
                  {/* جدول الإجماليات */}
                  {(() => {
                    const grouped: Record<string, { searches: number, qr_views: number }> = {};
                    analytics.forEach(row => {
                      const year = row.academic_year || 'غير محدد';
                      if (!grouped[year]) grouped[year] = { searches: 0, qr_views: 0 };
                      if (row.event_type === 'search') grouped[year].searches++;
                      if (row.event_type === 'qr_view') grouped[year].qr_views++;
                    });
                    const summaryArr = Object.keys(grouped).map(k => ({ year: k, ...grouped[k] })).sort((a, b) => a.year.localeCompare(b.year, 'ar'));
                    
                    return (
                      <div style={{ overflowX: "auto", marginBottom: "20px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff" }}>
                          <thead>
                            <tr style={{ background: "#111" }}>
                              <th style={{ padding: "12px", border: "1px solid #333", textAlign: "right" }}>الفرقة الدراسية</th>
                              <th style={{ padding: "12px", border: "1px solid #333", textAlign: "center" }}>إجمالي عمليات البحث 🔍</th>
                              <th style={{ padding: "12px", border: "1px solid #333", textAlign: "center" }}>البطاقات المستخرجة 📸</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryArr.map((row, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? "#1a1a1a" : "#222" }}>
                                <td style={{ padding: "12px", border: "1px solid #333", fontWeight: "bold" }}>{row.year}</td>
                                <td style={{ padding: "12px", border: "1px solid #333", textAlign: "center", color: "#4CAF50", fontWeight: "bold", fontSize: "16px" }}>{row.searches}</td>
                                <td style={{ padding: "12px", border: "1px solid #333", textAlign: "center", color: "#2196F3", fontWeight: "bold", fontSize: "16px" }}>{row.qr_views}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* الأجهزة المشبوهة */}
                  {(() => {
                    // تجميع الأجهزة التي بحثت عن أكثر من طالب مختلف
                    const deviceMap: Record<string, Set<string>> = {};
                    analytics.filter(a => a.event_type === 'qr_view' && a.student_name && a.browser_id).forEach(a => {
                      if (!deviceMap[a.browser_id]) deviceMap[a.browser_id] = new Set();
                      deviceMap[a.browser_id].add(a.student_name);
                    });

                    const suspicious = Object.entries(deviceMap).filter(([_, names]) => names.size > 1);

                    if (suspicious.length === 0) return null;

                    return (
                      <div style={{ marginBottom: "20px", background: "#3a1515", border: "1px solid #f44336", borderRadius: "10px", padding: "15px" }}>
                        <h4 style={{ color: "#f44336", marginTop: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>🚨</span> أجهزة مشبوهة (نفس الجهاز بحث عن عدة طلاب)
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {suspicious.map(([deviceId, names], idx) => (
                            <div key={idx} style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "5px" }}>
                              <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "5px" }}>جهاز رقم: {idx + 1} ({deviceId.substring(0, 8)}...)</div>
                              <div style={{ color: "#fff" }}>الأسماء المستخرجة: {Array.from(names).join('، ')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* سجل العمليات */}
                  <h4 style={{ color: "#fff", marginBottom: "15px" }}>سجل أحدث العمليات</h4>
                  <div style={{ overflowX: "auto", maxHeight: "400px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ background: "#111", position: "sticky", top: 0 }}>
                          <th style={{ padding: "12px", borderBottom: "1px solid #333", textAlign: "right" }}>الوقت</th>
                          <th style={{ padding: "12px", borderBottom: "1px solid #333", textAlign: "right" }}>العملية</th>
                          <th style={{ padding: "12px", borderBottom: "1px solid #333", textAlign: "right" }}>الطالب / الفرقة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.slice(0, 50).map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? "#1a1a1a" : "#222" }}>
                            <td style={{ padding: "12px", borderBottom: "1px solid #333", color: "#aaa", direction: "ltr", textAlign: "right" }}>
                              {new Date(row.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td style={{ padding: "12px", borderBottom: "1px solid #333", color: row.event_type === 'qr_view' ? '#2196F3' : '#4CAF50' }}>
                              {row.event_type === 'qr_view' ? 'استخراج QR 📸' : 'بحث 🔍'}
                            </td>
                            <td style={{ padding: "12px", borderBottom: "1px solid #333" }}>
                              {row.student_name ? <strong style={{ color: "#fff" }}>{row.student_name}</strong> : <span style={{ color: "#888" }}>{row.academic_year}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
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

              <div style={{ display: isScanning ? "block" : "none", marginBottom: "20px" }}>
                <div style={{ background: "black", borderRadius: "10px", overflow: "hidden", position: "relative", height: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <QRScanner onScan={(result) => { if(result) { performGlobalSearch(extractStudentCode(result)); setIsScanning(false); } }} />
                </div>
              </div>

              {/* نتائج البحث */}
              {searchResult && (
                <div style={{ textAlign: "right", marginTop: "20px" }}>
                  <div style={{ background: "#333", padding: "20px", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h2 style={{ margin: "0 0 5px 0", color: "#fff" }}>{searchResult.student.full_name}</h2>
                      <div style={{ color: "#aaa" }}>
                        الكود: <strong style={{ color: "#fff" }}>{searchResult.student.student_code}</strong> | 
                        الفرقة: <strong style={{ color: "#fff" }}>{searchResult.student.academic_year}</strong>
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
