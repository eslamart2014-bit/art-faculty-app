"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  GraduationCap, 
  Layers, 
  Search, 
  RotateCw, 
  UserCheck, 
  Sparkles, 
  ChevronLeft, 
  CheckCircle2, 
  ShieldAlert, 
  RefreshCw, 
  Eye, 
  AlertTriangle,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";

export default function InstructorPage() {
  // 1. Instructor Identity & Selection
  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // 2. Courses & Projects Scoped to This Instructor
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>("الكل");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedProjectName, setSelectedProjectName] = useState<string>("");

  // 3. Submissions & Gallery State
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // 4. Student Search & Verification State
  const [activeTab, setActiveTab] = useState<"gallery" | "search">("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // 5. Lightbox Modal State
  const [previewImage, setPreviewImage] = useState<any>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);

  // 6. Action status & feedback
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Fetch initial instructors list
  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    setLoadingInitial(true);
    try {
      const res = await fetch("/api/instructor/submissions");
      const data = await res.json();
      if (data.instructors) {
        setInstructors(data.instructors);

        // Check if there is a cached instructor ID
        const cachedId = localStorage.getItem("fania_active_instructor_id");
        const found = data.instructors.find((i: any) => i.id === cachedId) || data.instructors[0];
        if (found) {
          handleSelectInstructor(found);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSelectInstructor = async (inst: any) => {
    setSelectedInstructor(inst);
    localStorage.setItem("fania_active_instructor_id", inst.id);
    setSelectedCourseId("");
    setSelectedProjectName("");
    setSubmissions([]);
    setSearchResults([]);

    try {
      const res = await fetch(`/api/instructor/submissions?instructor_id=${inst.id}`);
      const data = await res.json();
      if (data.courses) {
        setMyCourses(data.courses);
        if (data.courses.length > 0) {
          const firstCourse = data.courses[0];
          setSelectedCourseId(firstCourse.id);
          const projects = firstCourse.custom_week_names?.__projects__ || [];
          if (projects.length > 0) {
            setSelectedProjectName(projects[0].name || "الاول");
            loadSubmissions(inst.id, firstCourse.id, projects[0].name || "الاول");
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load submissions for a specific course & project
  const loadSubmissions = async (instId: string, cId: string, pName: string) => {
    if (!instId || !cId || !pName) return;
    setLoadingSubmissions(true);
    try {
      const res = await fetch(
        `/api/instructor/submissions?instructor_id=${instId}&course_id=${cId}&project_name=${encodeURIComponent(pName)}`
      );
      const data = await res.json();
      if (data.submissions) {
        setSubmissions(data.submissions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // When selected course changes
  const handleCourseChange = (cId: string) => {
    setSelectedCourseId(cId);
    const course = myCourses.find(c => c.id === cId);
    const projects = course?.custom_week_names?.__projects__ || [];
    if (projects.length > 0) {
      const pName = projects[0].name || "الاول";
      setSelectedProjectName(pName);
      if (selectedInstructor) {
        loadSubmissions(selectedInstructor.id, cId, pName);
      }
    } else {
      setSelectedProjectName("");
      setSubmissions([]);
    }
  };

  // When selected project changes
  const handleProjectChange = (pName: string) => {
    setSelectedProjectName(pName);
    if (selectedInstructor && selectedCourseId) {
      loadSubmissions(selectedInstructor.id, selectedCourseId, pName);
    }
  };

  // Live Student Search (Scoped strictly to this instructor's courses)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !selectedInstructor) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/instructor/submissions?instructor_id=${selectedInstructor.id}&q=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        if (data.searchResults) {
          setSearchResults(data.searchResults);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedInstructor]);

  // Action: Allow Student to Retake / Change Artwork Photo
  const handleAllowRetake = async (studentCode: string, courseId: string, projectName: string, studentName: string) => {
    if (!selectedInstructor) return;
    const confirmAction = confirm(
      `هل أنت متأكد من فك القفل والسماح للطالب (${studentName}) بإعادة تصوير ورفع مشروع (${projectName})؟\nسيتيح هذا للطالب فتح الكاميرا ورفع صورة جديدة فوراً.`
    );
    if (!confirmAction) return;

    setActionLoading(`${studentCode}_${projectName}`);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/instructor/allow-retake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructor_id: selectedInstructor.id,
          student_code: studentCode,
          course_id: courseId,
          project_name: projectName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg(`✓ ${data.message}`);
        // Remove or update the submission in the gallery list
        setSubmissions(prev => prev.filter(s => !(s.student_code === studentCode && s.project_name === projectName)));
        // Also update search results if active
        setSearchResults(prev => prev.map(sr => {
          if (sr.student.student_code === studentCode) {
            return {
              ...sr,
              submissions: sr.submissions.filter((s: any) => !(s.course_id === courseId && s.project_name === projectName)),
              evaluations: sr.evaluations.map((ev: any) => ev.course_id === courseId && ev.project_name === projectName ? { ...ev, photo_url: null } : ev),
            };
          }
          return sr;
        }));
      } else {
        alert(data.error || "تعذر تنفيذ الطلب");
      }
    } catch (e: any) {
      alert("خطأ في الاتصال: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter courses by level if specified
  const filteredCourses = myCourses.filter(c => {
    if (selectedLevel === "الكل") return true;
    const norm = c.academic_year || "";
    if (selectedLevel.includes("أول") || selectedLevel.includes("اول")) return norm.includes("اول");
    if (selectedLevel.includes("ثان")) return norm.includes("ثاني");
    if (selectedLevel.includes("ثالث")) return norm.includes("ثالث");
    if (selectedLevel.includes("رابع")) return norm.includes("رابع");
    return true;
  });

  const selectedCourse = myCourses.find(c => c.id === selectedCourseId);
  const currentProjects = selectedCourse?.custom_week_names?.__projects__ || [];

  if (loadingInitial) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8", background: "#0a0e17" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div>جاري تحميل بيانات أعضاء هيئة التدريس والمعيدين...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e2e8f0", padding: "16px", maxWidth: "1200px", margin: "0 auto", direction: "rtl" }}>
      
      {/* 1. Header & Navigation */}
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 18px", background: "#141b29", borderRadius: "16px", border: "1px solid #2a374f", marginBottom: "20px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #2563eb, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <GraduationCap size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: "17px", fontWeight: "bold", color: "#fff", margin: 0 }}>بوابة المدرسين والمعيدين</h1>
            <div style={{ color: "#94a3b8", fontSize: "12px" }}>تصفح أعمال ومشاريع الطلاب والتحقق الفوري</div>
          </div>
        </div>

        {/* Instructor Identity Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ textAlign: "left" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", display: "block" }}>الحساب النشط:</span>
            <select
              value={selectedInstructor?.id || ""}
              onChange={(e) => {
                const found = instructors.find(i => i.id === e.target.value);
                if (found) handleSelectInstructor(found);
              }}
              style={{ padding: "6px 12px", background: "#1e293b", border: "1px solid #3b82f6", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: "bold", outline: "none", cursor: "pointer" }}
            >
              {instructors.map(inst => (
                <option key={inst.id} value={inst.id}>
                  {inst.degree ? `${inst.degree}/ ` : ""}{inst.full_name} ({inst.role})
                </option>
              ))}
            </select>
          </div>

          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid #2a374f", color: "#94a3b8", padding: "8px 12px", borderRadius: "10px", textDecoration: "none", fontSize: "12px" }}>
            <ChevronLeft size={16} />
            <span>بوابة الطلاب</span>
          </Link>
        </div>
      </header>

      {/* Security Scope Notice */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(37, 99, 235, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", padding: "10px 16px", borderRadius: "12px", marginBottom: "18px", fontSize: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8" }}>
          <Sparkles size={16} />
          <span><b>نظام الخصوصية المشدد:</b> يتم عرض المقررات والأعمال المسندة إليك فقط ({myCourses.length} مقررات).</span>
        </div>
        <span style={{ color: "#94a3b8" }}>{selectedInstructor?.full_name}</span>
      </div>

      {/* Feedback message banner */}
      {feedbackMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "12px 16px", borderRadius: "12px", marginBottom: "16px", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: "14px" }}>✕</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "#141b29", padding: "6px", borderRadius: "14px", border: "1px solid #2a374f", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("gallery")}
          style={{
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "gallery" ? "#2563eb" : "transparent",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <Layers size={16} />
          <span>تصفح أعمال المشاريع</span>
        </button>
        <button
          onClick={() => setActiveTab("search")}
          style={{
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "search" ? "#2563eb" : "transparent",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <Search size={16} />
          <span>بحث ذكي وتأكد من الطالب</span>
        </button>
      </div>

      {/* TAB 1: GALLERY & PROJECT SUBMISSIONS */}
      {activeTab === "gallery" && (
        <div>
          {/* Filters Bar: Level -> Course -> Project */}
          <div className="glass-card" style={{ padding: "16px 20px", marginBottom: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", alignItems: "flex-end" }}>
              
              {/* Level Filter */}
              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                  الفرقة الدراسية:
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => {
                    setSelectedLevel(e.target.value);
                  }}
                  style={{ width: "100%", padding: "10px 12px", background: "#0d131f", border: "1px solid #2a374f", color: "#fff", borderRadius: "10px", fontSize: "13px" }}
                >
                  <option value="الكل">كل الفرق الدراسية</option>
                  <option value="الفرقة الأولى">الفرقة الأولى</option>
                  <option value="الفرقة الثانية">الفرقة الثانية</option>
                  <option value="الفرقة الثالثة">الفرقة الثالثة</option>
                  <option value="الفرقة الرابعة">الفرقة الرابعة</option>
                </select>
              </div>

              {/* Course Selector (Only scoped courses) */}
              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                  المقرر الدراسي (مقرراتك فقط):
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", background: "#0d131f", border: "1px solid #3b82f6", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: "bold" }}
                >
                  {filteredCourses.length === 0 && <option value="">لا توجد مقررات مسندة لك في هذه الفرقة</option>}
                  {filteredCourses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.academic_year})
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Selector */}
              <div>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                  المشروع الفني:
                </label>
                <select
                  value={selectedProjectName}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  disabled={currentProjects.length === 0}
                  style={{ width: "100%", padding: "10px 12px", background: "#0d131f", border: "1px solid #2a374f", color: "#fff", borderRadius: "10px", fontSize: "13px" }}
                >
                  {currentProjects.length === 0 && <option value="">لا توجد مشاريع مضافة بهذا المقرر</option>}
                  {currentProjects.map((p: any) => (
                    <option key={p.id || p.name} value={p.name}>
                      مشروع: {p.name} {p.max_score ? `(من ${p.max_score} درجة)` : ""}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Quick Stats Bar */}
            {selectedCourse && selectedProjectName && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #2a374f", fontSize: "12px" }}>
                <span style={{ background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", padding: "4px 10px", borderRadius: "8px", fontWeight: "bold" }}>
                  المقرر: {selectedCourse.name}
                </span>
                <span style={{ background: "rgba(16, 185, 129, 0.1)", color: "#34d399", padding: "4px 10px", borderRadius: "8px", fontWeight: "bold" }}>
                  إجمالي الأعمال المرفوعة: {submissions.length}
                </span>
                <span style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", padding: "4px 10px", borderRadius: "8px" }}>
                  السكاشن المشمولة: {selectedCourse.sections?.join("، ") || "الكل"}
                </span>
              </div>
            )}
          </div>

          {/* Submissions Gallery Grid */}
          {loadingSubmissions ? (
            <div style={{ textAlign: "center", padding: "50px", color: "#94a3b8" }}>
              <div style={{ width: "30px", height: "30px", border: "2px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
              <div>جاري استعراض أعمال الطلاب...</div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="glass-card" style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8" }}>
              <BookOpen size={40} style={{ margin: "0 auto 12px", color: "#475569" }} />
              <h3 style={{ color: "#fff", fontSize: "16px", marginBottom: "6px" }}>لا توجد أعمال مرفوعة حتى الآن</h3>
              <p style={{ fontSize: "13px", maxWidth: "420px", margin: "0 auto" }}>
                لم يقم أي طالب برفع صور لهذا المشروع في مقرر ({selectedCourse?.name || ""}) حتى اللحظة.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {submissions.map((sub: any, idx: number) => {
                const firstImg = sub.images?.[0]?.url || sub.photo_url || "";
                const isActionLoading = actionLoading === `${sub.student_code}_${sub.project_name}`;

                return (
                  <div 
                    key={sub.id || idx}
                    className="glass-card animate-fade-in"
                    style={{ padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid #2a374f", transition: "transform 0.2s", overflow: "hidden" }}
                  >
                    <div>
                      {/* Image Preview with Zoom Overlay */}
                      <div 
                        onClick={() => {
                          setPreviewImage({
                            url: firstImg,
                            title: `عمل الطالب: ${sub.student_name}`,
                            subTitle: `كود: ${formatStudentCode(sub.student_code)} • سكشن: ${sub.section || "1"}`
                          });
                          setRotationDegrees(0);
                        }}
                        style={{ position: "relative", width: "100%", height: "200px", borderRadius: "12px", overflow: "hidden", background: "#0d131f", cursor: "pointer", marginBottom: "12px", border: "1px solid #1e293b" }}
                      >
                        {firstImg ? (
                          <img 
                            src={firstImg} 
                            alt={sub.student_name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "12px" }}>
                            لا توجد صورة
                          </div>
                        )}

                        <div style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Eye size={12} />
                          <span>تكبير اللوحة</span>
                        </div>

                        {/* Status Badge */}
                        <div style={{ position: "absolute", top: "8px", right: "8px", background: sub.score !== null ? "rgba(16, 185, 129, 0.9)" : "rgba(245, 158, 11, 0.9)", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" }}>
                          {sub.score !== null ? `الدرجة: ${sub.score}` : "قيد التقييم"}
                        </div>
                      </div>

                      {/* Student Info */}
                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ color: "#ffffff", fontWeight: "bold", fontSize: "15px", marginBottom: "4px", lineHeight: "1.4" }}>
                          {sub.student_name}
                        </div>
                        <div style={{ color: "#38bdf8", fontSize: "12px", display: "flex", gap: "8px" }}>
                          <span>كود: {formatStudentCode(sub.student_code)}</span>
                          <span>•</span>
                          <span>سكشن: {sub.section || "1"}</span>
                        </div>
                        {sub.created_at && (
                          <div style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                            تاريخ الرفع: {new Date(sub.created_at).toLocaleDateString("ar-EG")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button: Allow Retake */}
                    <div>
                      <button
                        onClick={() => handleAllowRetake(sub.student_code, selectedCourseId, selectedProjectName, sub.student_name)}
                        disabled={isActionLoading}
                        className="btn-secondary"
                        style={{ width: "100%", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#f87171", fontSize: "12px", padding: "9px" }}
                      >
                        <RefreshCw size={14} className={isActionLoading ? "spin" : ""} />
                        <span>{isActionLoading ? "جاري فك القفل..." : "🔄 السماح بتغيير الصورة / إعادة التصوير"}</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SMART SEARCH & STUDENT VERIFICATION */}
      {activeTab === "search" && (
        <div>
          {/* Search Box */}
          <div className="glass-card" style={{ padding: "18px 20px", marginBottom: "20px" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", fontWeight: "bold", marginBottom: "8px" }}>
              ابحث عن الطالب بالكود الجامعي أو بالاسم:
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="أدخل كود الطالب (مثال: 0001) أو اكتب جزءاً من اسمه..."
                style={{ width: "100%", padding: "14px 18px", background: "#0d131f", border: "1px solid #3b82f6", borderRadius: "12px", color: "#fff", fontSize: "15px" }}
              />
              {isSearching && (
                <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", border: "2px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              )}
            </div>
            <div style={{ color: "#64748b", fontSize: "11px", marginTop: "8px" }}>
              💡 يتيح لك البحث استعراض صورة بطاقة الرقم القومي لمطابقة وجه الطالب، وفحص أعماله في مقرراتك فقط.
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length === 0 && searchQuery && !isSearching && (
            <div className="glass-card" style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
              لا يوجد طالب مطابق لهذا البحث في كشوف الكلية.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {searchResults.map((res: any) => {
              const st = res.student;
              const acc = res.account;
              const subs = res.submissions || [];

              return (
                <div key={st.id} className="glass-card animate-fade-in" style={{ padding: "20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "16px" }}>
                    
                    {/* Student Info & ID Card */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ color: "#10b981", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle2 size={14} />
                          <span>طالب مقيد بالكلية</span>
                        </span>
                        <span style={{ color: "#38bdf8", fontSize: "12px" }}>
                          كود: {formatStudentCode(st.student_code)}
                        </span>
                      </div>

                      <h3 style={{ fontSize: "17px", color: "#fff", fontWeight: "bold", marginBottom: "6px" }}>
                        {st.full_name}
                      </h3>

                      <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "12px" }}>
                        الفرقة: {st.academic_year} • السكشن: {st.section || "1"}
                        {acc?.mobile && <span> • هاتف: {acc.mobile}</span>}
                      </div>

                      {/* ID Card Photo for Face Matching */}
                      <div>
                        <div style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                          صورة بطاقة الرقم القومي (لمطابقة الوجه والهوية):
                        </div>
                        {acc?.id_card_url ? (
                          <div 
                            onClick={() => setPreviewImage({ url: acc.id_card_url, title: `بطاقة هوية: ${st.full_name}`, subTitle: `كود: ${st.student_code}` })}
                            style={{ width: "160px", height: "100px", borderRadius: "10px", overflow: "hidden", border: "2px solid #10b981", cursor: "pointer", background: "#000" }}
                          >
                            <img src={acc.id_card_url} alt="بطاقة الهوية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ) : (
                          <div style={{ padding: "10px", background: "rgba(245, 158, 11, 0.08)", border: "1px dashed #f59e0b", borderRadius: "8px", color: "#f59e0b", fontSize: "12px" }}>
                            لم يقم الطالب برفع صورة بطاقة الهوية بعد
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Student Submissions in this Instructor's Courses */}
                    <div>
                      <h4 style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Layers size={15} />
                        <span>الأعمال المرفوعة في مقرراتك المسندة إليك:</span>
                      </h4>

                      {subs.length === 0 ? (
                        <div style={{ padding: "14px", background: "#0d131f", borderRadius: "10px", color: "#64748b", fontSize: "12px", textAlign: "center" }}>
                          لا توجد أعمال مرفوعة لهذا الطالب في مقرراتك حتى الآن.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {subs.map((s: any, sIdx: number) => {
                            const imgUrl = s.images?.[0]?.url || s.photo_url || "";
                            const isActionLoading = actionLoading === `${st.student_code}_${s.project_name}`;

                            return (
                              <div key={sIdx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d131f", border: "1px solid #2a374f", padding: "10px", borderRadius: "10px", gap: "10px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  {imgUrl && (
                                    <div 
                                      onClick={() => setPreviewImage({ url: imgUrl, title: `عمل: ${s.project_name} - ${st.full_name}`, subTitle: `مقرر: ${s.course_name || ""}` })}
                                      style={{ width: "50px", height: "50px", borderRadius: "8px", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}
                                    >
                                      <img src={imgUrl} alt="اللوحة" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    </div>
                                  )}
                                  <div>
                                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "13px" }}>{s.project_name}</div>
                                    <div style={{ color: "#94a3b8", fontSize: "11px" }}>{s.course_name || "مقرر مسند إليك"}</div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleAllowRetake(st.student_code, s.course_id, s.project_name, st.full_name)}
                                  disabled={isActionLoading}
                                  style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", padding: "6px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                                >
                                  <RefreshCw size={12} className={isActionLoading ? "spin" : ""} />
                                  <span>السماح بإعادة التصوير</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px" }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "15px" }}>{previewImage.title}</div>
              <div style={{ color: "#94a3b8", fontSize: "12px" }}>{previewImage.subTitle}</div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setRotationDegrees(prev => (prev + 90) % 360);
                }}
                style={{ background: "#1e293b", border: "1px solid #475569", color: "#fff", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                <RotateCw size={14} />
                <span>تدوير 90°</span>
              </button>
              <button 
                onClick={() => setPreviewImage(null)}
                style={{ background: "#ef4444", border: "none", color: "#fff", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Full Image */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "16px 0" }}>
            <img 
              src={previewImage.url} 
              alt="معاينة" 
              style={{ maxHeight: "80vh", maxWidth: "90vw", objectFit: "contain", borderRadius: "12px", transform: `rotate(${rotationDegrees}deg)`, transition: "transform 0.3s" }} 
            />
          </div>

          {/* Footer note */}
          <div style={{ textAlign: "center", color: "#64748b", fontSize: "12px" }}>
            اضغط في أي مكان فارغ للإغلاق
          </div>
        </div>
      )}

    </div>
  );
}
