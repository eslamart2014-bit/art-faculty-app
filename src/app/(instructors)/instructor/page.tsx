"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  GraduationCap,
  Layers,
  Search,
  RotateCw,
  UserCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  Eye,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Camera,
  ArrowRight,
  FolderOpen,
  Download,
  Palette,
  Pencil,
  User,
  X,
  Lightbulb
} from "lucide-react";
import { formatStudentCode } from "@/lib/students/codeHelper";
import QRScanner from "@/components/scanner/QRScanner";
import { extractStudentCode } from "@/lib/students/codeHelper";

export default function InstructorPage() {
  // 1. Instructor Identity & Selection
  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // 2. Courses & Projects Scoped to This Instructor
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [galleryViewMode, setGalleryViewMode] = useState<"grid" | "submissions">("grid");
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
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // 5. Lightbox Modal State
  const [previewImage, setPreviewImage] = useState<any>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [mounted, setMounted] = useState(false);

  // 6. Action status & feedback
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Current logged in user & role
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingScoreStudent, setEditingScoreStudent] = useState<{ studentCode: string; currentScore: number | null } | null>(null);
  const [scoreInput, setScoreInput] = useState<string>("");
  const [savingScore, setSavingScore] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const cached = localStorage.getItem("cached_profile");
      if (cached) {
        setCurrentUser(JSON.parse(cached));
      }
    } catch (e) {}

    return () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    };
  }, []);

  useEffect(() => {

    import("@/lib/core/supabase").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
            if (data) setCurrentUser(data);
          });
        }
      });
    });
  }, []);

  const isPrimaryAdmin = currentUser?.role === "مدير";

  const handleSaveScore = async (studentCode: string) => {
    if (scoreInput === "" || isNaN(Number(scoreInput))) {
      alert("يرجى إدخال درجة صحيحة");
      return;
    }
    const numScore = Number(scoreInput);
    setSavingScore(true);

    try {
      const { supabase } = await import("@/lib/core/supabase");
      const { data: st } = await supabase.from("students").select("id").eq("student_code", studentCode).maybeSingle();
      if (!st) {
        alert("لم يتم العثور على الطالب في قاعدة البيانات");
        setSavingScore(false);
        return;
      }

      const { error } = await supabase.from("evaluations").upsert({
        course_id: selectedCourseId,
        student_id: st.id,
        project_name: selectedProjectName,
        score: numScore,
        updated_at: new Date().toISOString()
      }, { onConflict: "course_id,student_id,project_name" });

      if (error) {
        console.error("Evaluation save error:", error);
        alert("تعذر حفظ الدرجة: " + error.message);
      } else {
        setSubmissions(prev => prev.map(s => {
          if (s.student_code === studentCode) {
            return { ...s, score: numScore, status: "graded" };
          }
          return s;
        }));
        setEditingScoreStudent(null);
        setFeedbackMsg(`تم رصد وتحديث الدرجة (${numScore}) بنجاح.`);
      }
    } catch (e: any) {
      alert("خطأ: " + e.message);
    } finally {
      setSavingScore(false);
    }
  };

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
    setGalleryViewMode("grid");

    try {
      const res = await fetch(`/api/instructor/submissions?instructor_id=${inst.id}`);
      const data = await res.json();
      if (data.courses) {
        const cleanCourses = (data.courses || [])
          .filter((c: any) => c.custom_week_names?.__archived !== true)
          .map((c: any) => ({
            ...c,
            custom_week_names: {
              ...(c.custom_week_names || {}),
              __projects__: (c.custom_week_names?.__projects__ || []).filter((p: any) => !p.is_archived && p.is_active !== false)
            }
          }));
        setMyCourses(cleanCourses);
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

  const handleSelectProjectCard = (cId: string, pName: string) => {
    setSelectedCourseId(cId);
    setSelectedProjectName(pName);
    setGalleryViewMode("submissions");
    if (selectedInstructor) {
      loadSubmissions(selectedInstructor.id, cId, pName);
    }
  };

  // Live Student Search (ONLY for Arabic/letters; digits require Enter/Search button)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !selectedInstructor) {
      setSearchResults([]);
      return;
    }

    // إذا كان الإدخال أرقاماً فقط، لا تقم بالبحث الفوري التلقائي (يتم عند الضغط على بحث أو Enter)
    if (/^\d+$/.test(trimmed)) {
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

  const executeStudentSearch = async (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
    if (!q || !selectedInstructor) return;
    setIsSearching(true);
    setExpandedStudentId(null);
    try {
      const res = await fetch(
        `/api/instructor/submissions?instructor_id=${selectedInstructor.id}&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (data.searchResults) {
        setSearchResults(data.searchResults);
        if (data.searchResults.length === 1) {
          setExpandedStudentId(data.searchResults[0].student.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // Export Submissions as Mobile-Scrolling Formatted PDF
  const handleExportMobilePdf = async () => {
    if (!submissions || submissions.length === 0) {
      alert("لا توجد أعمال مرفوعة في هذا المشروع لتحميلها كـ PDF");
      return;
    }
    setIsExportingPdf(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      
      const container = document.createElement("div");
      container.style.width = "380px";
      container.style.background = "#0f172a";
      container.style.color = "#ffffff";
      container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
      container.style.direction = "rtl";
      container.style.padding = "10px";

      const courseObj = myCourses.find(c => c.id === selectedCourseId);

      let html = `
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border: 2px solid #3b82f6; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 20px; page-break-after: always;">
          <div style="font-size: 13px; font-weight: bold; color: #94a3b8; margin-bottom: 4px;">جامعة قنا • كلية التربية النوعية • قسم التربية الفنية</div>
          <h1 style="font-size: 18px; color: #38bdf8; margin: 0 0 10px 0;">ألبوم أعمال ومشاريع الطلاب</h1>
          <div style="background: rgba(59, 130, 246, 0.15); border-radius: 8px; padding: 12px; margin: 12px 0;">
            <div style="font-size: 15px; font-weight: bold; color: #fff; margin-bottom: 4px;">المقرر: ${courseObj?.name || ""}</div>
            <div style="font-size: 13px; color: #34d399; font-weight: bold;">المشروع: ${selectedProjectName}</div>
            <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">أستاذ المقرر: ${selectedInstructor?.full_name || ""}</div>
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 15px;">
            إجمالي الأعمال: ${submissions.length} عمل • تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG")}
          </div>
          <div style="margin-top: 25px; font-size: 11px; color: #38bdf8;">نسخة مخصصة لتصفح شاشات الهواتف الذكية 📱</div>
        </div>
      `;

      submissions.forEach((sub, i) => {
        const img = sub.images?.[0]?.url || sub.photo_url || "";
        html += `
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px; margin-bottom: 20px; page-break-after: ${i === submissions.length - 1 ? 'avoid' : 'always'}; page-break-inside: avoid; text-align: right;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 10px;">
              <div>
                <div style="font-size: 15px; font-weight: bold; color: #ffffff;">${sub.student_name}</div>
                <div style="font-size: 12px; color: #38bdf8;">كود: ${formatStudentCode(sub.student_code)} • سكشن: ${sub.section || "1"}</div>
              </div>
              ${sub.score !== null ? `<div style="background: #059669; color: #fff; font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 6px;">درجة: ${sub.score}</div>` : ''}
            </div>

            ${img ? `
              <div style="width: 100%; border-radius: 8px; overflow: hidden; background: #000; text-align: center; margin-bottom: 10px;">
                <img src="${img}" crossorigin="anonymous" style="width: 100%; max-height: 480px; object-fit: contain; display: block;" />
              </div>
            ` : `
              <div style="padding: 40px; text-align: center; color: #64748b; font-size: 13px;">لا توجد صورة للعمل</div>
            `}

            <div style="font-size: 10px; color: #64748b; display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px dashed #334155;">
              <span>مشروع: ${selectedProjectName}</span>
              <span>${sub.created_at ? new Date(sub.created_at).toLocaleDateString("ar-EG") : ""}</span>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      document.body.appendChild(container);

      const opt: any = {
        margin: [6, 6, 6, 6],
        filename: `اعمال_${courseObj?.name || 'مقرر'}_${selectedProjectName}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
        jsPDF: { unit: 'mm', format: [120, 220], orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(container).save();
      document.body.removeChild(container);
    } catch (err: any) {
      console.error("PDF Export error:", err);
      alert("تعذر تصدير ملف الـ PDF: " + (err?.message || "خطأ غير متوقع"));
    } finally {
      setIsExportingPdf(false);
    }
  };

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
        setFeedbackMsg(data.message);
        setSubmissions(prev => prev.filter(s => !(s.student_code === studentCode && s.project_name === projectName)));
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

  // Flatten all projects belonging to this assistant's courses
  const allProjectsList = myCourses
    .filter((c: any) => c.custom_week_names?.__archived !== true)
    .flatMap((c: any) => {
      const projs = (c.custom_week_names?.__projects__ || []).filter((p: any) => !p.is_archived && p.is_active !== false);
      return projs.map((p: any) => ({
        courseId: c.id,
        courseName: c.name,
        academicYear: c.academic_year,
        sections: c.sections || [],
        projectName: p.name || p.title,
        maxScore: p.max_score || p.maxScore,
      }));
    });

  const selectedCourse = myCourses.find(c => c.id === selectedCourseId);

  if (loadingInitial) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-ink)", background: "var(--bg-deep)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid var(--accent-ink)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div>جاري تحميل بيانات أعضاء الهيئة المعاونة والتدريس...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", color: "var(--text-primary)", padding: "16px", maxWidth: "1200px", margin: "0 auto", direction: "rtl" }}>
      
      {/* 1. Header & Navigation */}
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 18px", background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <GraduationCap size={22} strokeWidth={1.5} />
          </div>
          <div>
            <h1 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-primary)", margin: 0 }}>بوابة الهيئة المعاونة</h1>
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>استعراض أعمال ومشاريع الطلاب والتحقق الفوري</div>
          </div>
        </div>

        {/* Instructor Identity Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>الحساب النشط:</span>
            {isPrimaryAdmin ? (
              <select
                value={selectedInstructor?.id || ""}
                onChange={(e) => {
                  const found = instructors.find(i => i.id === e.target.value);
                  if (found) handleSelectInstructor(found);
                }}
                style={{ padding: "6px 12px", background: "var(--surface-hover)", border: "1px solid var(--primary)", color: "var(--text-primary)", borderRadius: "8px", fontSize: "13px", fontWeight: "600", outline: "none", cursor: "pointer" }}
              >
                {instructors.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.degree ? `${inst.degree}/ ` : ""}{inst.full_name} ({inst.role})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ background: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--accent-ink)", padding: "6px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                <User size={15} strokeWidth={1.5} />
                <span>{selectedInstructor?.degree ? `${selectedInstructor.degree}/ ` : ""}{selectedInstructor?.full_name || currentUser?.full_name}</span>
              </div>
            )}
          </div>

          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontSize: "12px" }}>
            <ChevronLeft size={16} strokeWidth={1.5} />
            <span>الرئيسية</span>
          </Link>
        </div>
      </header>

      {/* Feedback message banner */}
      {feedbackMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.14)", border: "1px solid var(--success)", color: "var(--success)", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }} aria-label="إغلاق">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "var(--surface)", padding: "6px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("gallery")}
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "gallery" ? "var(--primary)" : "transparent",
            color: activeTab === "gallery" ? "#fff" : "var(--text-secondary)",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <Layers size={16} strokeWidth={1.5} />
          <span>تصفح أعمال المشاريع</span>
        </button>
        <button
          onClick={() => setActiveTab("search")}
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "search" ? "var(--primary)" : "transparent",
            color: activeTab === "search" ? "#fff" : "var(--text-secondary)",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <Search size={16} strokeWidth={1.5} />
          <span>بحث ذكي وتأكد من الطالب</span>
        </button>
      </div>

      {/* TAB 1: GALLERY & PROJECT CARDS */}
      {activeTab === "gallery" && (
        <div>
          {/* VIEW A: PROJECT CARDS GRID (شبكة كروت باسم المشروع) */}
          {galleryViewMode === "grid" ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", margin: 0 }}>مشاريع المقررات المسندة إليك</h2>
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>اختر أي مشروع لاستعراض الأعمال والصور ورصد الدرجات</div>
                </div>
                <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--accent-ink)", background: "rgba(56, 189, 248, 0.12)", padding: "4px 10px", borderRadius: "6px", fontWeight: "600" }}>
                  {allProjectsList.length} مشروع مسجل
                </span>
              </div>

              {allProjectsList.length === 0 ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                  <BookOpen size={38} strokeWidth={1.5} style={{ margin: "0 auto 12px", color: "var(--text-muted)" }} />
                  <h3 style={{ color: "var(--text-primary)", fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}>لا توجد مشاريع مضافة حالياً</h3>
                  <p style={{ fontSize: "13px", maxWidth: "420px", margin: "0 auto" }}>
                    لم يتم تسجيل أي مشاريع فنية داخل المقررات المسندة لك حتى الآن.
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                  {allProjectsList.map((proj, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectProjectCard(proj.courseId, proj.projectName)}
                      style={{
                        padding: "18px",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: "var(--surface)",
                        transition: "border-color 0.15s",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "11px", background: "rgba(56, 189, 248, 0.14)", color: "var(--accent-ink)", padding: "3px 8px", borderRadius: "6px", fontWeight: "600" }}>
                            {proj.academicYear || "عام"}
                          </span>
                          {proj.maxScore && (
                            <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--success)", fontWeight: "600" }}>
                              من {proj.maxScore} درجة
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontSize: "15px", color: "var(--text-primary)", fontWeight: "600", margin: "6px 0 8px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Palette size={16} strokeWidth={1.5} color="var(--accent-ink)" />
                          <span>مشروع: {proj.projectName}</span>
                        </h3>
                        <div style={{ color: "var(--text-muted)", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <BookOpen size={14} strokeWidth={1.5} color="var(--accent-ink)" />
                          <span>المقرر: {proj.courseName}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--success)", fontSize: "12px", fontWeight: "600" }}>استعراض الأعمال المرفوعة</span>
                        <ChevronLeft size={16} strokeWidth={1.5} color="var(--success)" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* VIEW B: SUBMISSIONS GALLERY FOR SELECTED PROJECT */
            <div>
              {/* Back to cards & Project Header bar */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 18px", marginBottom: "18px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    onClick={() => setGalleryViewMode("grid")}
                    className="btn-compact"
                    style={{
                      background: "var(--surface-hover)",
                      color: "var(--accent-ink)",
                      border: "1px solid var(--primary)",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <ArrowRight size={15} strokeWidth={1.5} />
                    <span>الرجوع لكافة المشاريع</span>
                  </button>

                  <div>
                    <h2 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", margin: 0 }}>
                      مشروع: {selectedProjectName}
                    </h2>
                    <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>
                      المقرر: {selectedCourse?.name || ""} • الفرقة: {selectedCourse?.academic_year || "عام"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="tabular-nums" style={{ background: "rgba(16, 185, 129, 0.14)", color: "var(--success)", padding: "6px 10px", borderRadius: "6px", fontWeight: "600", fontSize: "12px" }}>
                    إجمالي الأعمال: {submissions.length}
                  </span>

                  {submissions.length > 0 && (
                    <button
                      onClick={handleExportMobilePdf}
                      disabled={isExportingPdf}
                      className="btn-compact"
                      style={{
                        background: "var(--success)",
                        color: "#fff",
                        border: "none",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontWeight: "600",
                        fontSize: "12px",
                        cursor: isExportingPdf ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {isExportingPdf ? (
                        <>
                          <div style={{ width: "12px", height: "12px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                          <span>جاري تجهيز PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download size={14} strokeWidth={1.5} />
                          <span>تحميل PDF (مقاس الجوال)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Submissions Gallery Grid */}
              {loadingSubmissions ? (
                <div style={{ textAlign: "center", padding: "50px", color: "var(--text-muted)" }}>
                  <div style={{ width: "30px", height: "30px", border: "2px solid var(--accent-ink)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
                  <div>جاري استعراض أعمال الطلاب...</div>
                </div>
              ) : submissions.length === 0 ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                  <BookOpen size={38} strokeWidth={1.5} style={{ margin: "0 auto 12px", color: "var(--text-muted)" }} />
                  <h3 style={{ color: "var(--text-primary)", fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}>لا توجد أعمال مرفوعة حتى الآن</h3>
                  <p style={{ fontSize: "13px", maxWidth: "420px", margin: "0 auto" }}>
                    لم يقم أي طالب برفع صور لمشروع ({selectedProjectName}) في مقرر ({selectedCourse?.name || ""}) حتى اللحظة.
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
                  {submissions.map((sub: any, idx: number) => {
                    const firstImg = sub.images?.[0]?.url || sub.photo_url || "";
                    const isActionLoading = actionLoading === `${sub.student_code}_${sub.project_name}`;

                    return (
                      <div
                        key={sub.id || idx}
                        style={{ background: "var(--surface)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid var(--border)", overflow: "hidden" }}
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
                            style={{ position: "relative", width: "100%", height: "200px", borderRadius: "8px", overflow: "hidden", background: "var(--bg-deep)", cursor: "pointer", marginBottom: "12px", border: "1px solid var(--border)" }}
                          >
                            {firstImg ? (
                              <img
                                src={firstImg}
                                alt={sub.student_name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                                لا توجد صورة
                              </div>
                            )}

                            <div style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Eye size={12} strokeWidth={1.5} />
                              <span>تكبير الصورة</span>
                            </div>

                            {/* Status Badge */}
                            <div className="tabular-nums" style={{ position: "absolute", top: "8px", right: "8px", background: sub.score !== null ? "rgba(16, 185, 129, 0.9)" : "rgba(245, 158, 11, 0.9)", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
                              {sub.score !== null ? `الدرجة: ${sub.score}` : "قيد التقييم"}
                            </div>
                          </div>

                          {/* Student Info */}
                          <div style={{ marginBottom: "12px" }}>
                            <div style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "15px", marginBottom: "4px", lineHeight: "1.4" }}>
                              {sub.student_name}
                            </div>
                            <div className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "12px", display: "flex", gap: "8px" }}>
                              <span>كود: {formatStudentCode(sub.student_code)}</span>
                              <span>•</span>
                              <span>سكشن: {sub.section || "1"}</span>
                            </div>
                            {sub.created_at && (
                              <div className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "4px" }}>
                                تاريخ الرفع: {new Date(sub.created_at).toLocaleDateString("ar-EG")}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Multiple images row */}
                        {sub.images && sub.images.length > 1 && (
                          <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "4px 0", marginBottom: "8px" }}>
                            {sub.images.map((imgObj: any, iIdx: number) => (
                              <div
                                key={iIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage({
                                    url: imgObj.url,
                                    title: `عمل الطالب: ${sub.student_name} (${iIdx + 1}/${sub.images.length})`,
                                    subTitle: `كود: ${formatStudentCode(sub.student_code)} • سكشن: ${sub.section || "1"}`
                                  });
                                  setRotationDegrees(0);
                                }}
                                style={{
                                  width: "42px",
                                  height: "42px",
                                  borderRadius: "6px",
                                  overflow: "hidden",
                                  border: "1px solid var(--primary)",
                                  cursor: "pointer",
                                  flexShrink: 0
                                }}
                                title="عرض اللقطة"
                              >
                                <img src={imgObj.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Grading Form / Button */}
                        <div style={{ marginBottom: "8px" }}>
                          {editingScoreStudent?.studentCode === sub.student_code ? (
                            <div style={{ background: "var(--bg-deep)", border: "1px solid var(--primary)", padding: "8px", borderRadius: "8px", display: "flex", gap: "6px", alignItems: "center" }}>
                              <input
                                type="number"
                                value={scoreInput}
                                onChange={e => setScoreInput(e.target.value)}
                                placeholder="الدرجة"
                                className="tabular-nums"
                                style={{ width: "65px", padding: "6px", borderRadius: "6px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)", fontWeight: "600", textAlign: "center" }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveScore(sub.student_code)}
                                disabled={savingScore}
                                style={{ flex: 1, padding: "6px 8px", background: "var(--success)", border: "none", borderRadius: "6px", color: "#fff", fontWeight: "600", cursor: "pointer", fontSize: "12px" }}
                              >
                                {savingScore ? "حفظ..." : "حفظ"}
                              </button>
                              <button
                                onClick={() => setEditingScoreStudent(null)}
                                style={{ padding: "6px 8px", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                aria-label="إلغاء"
                              >
                                <X size={13} strokeWidth={1.5} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingScoreStudent({ studentCode: sub.student_code, currentScore: sub.score });
                                setScoreInput(sub.score !== null ? String(sub.score) : "");
                              }}
                              style={{
                                width: "100%",
                                background: sub.score !== null ? "rgba(16, 185, 129, 0.14)" : "rgba(37, 99, 235, 0.14)",
                                border: `1px solid ${sub.score !== null ? "var(--success)" : "var(--primary)"}`,
                                color: sub.score !== null ? "var(--success)" : "var(--accent-ink)",
                                padding: "7px 10px",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                              }}
                            >
                              <Pencil size={13} strokeWidth={1.5} />
                              <span className="tabular-nums">{sub.score !== null ? `تعديل الدرجة (${sub.score})` : "رصد الدرجة لهذا العمل"}</span>
                            </button>
                          )}
                        </div>

                        {/* Action Button: Allow Retake */}
                        <div>
                          <button
                            onClick={() => handleAllowRetake(sub.student_code, selectedCourseId, selectedProjectName, sub.student_name)}
                            disabled={isActionLoading}
                            className="btn-secondary"
                            style={{ width: "100%", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "var(--error)", fontSize: "11px", padding: "7px", borderRadius: "8px", fontWeight: "500" }}
                          >
                            <RefreshCw size={12} strokeWidth={1.5} className={isActionLoading ? "spin" : ""} />
                            <span>{isActionLoading ? "جاري فك القفل..." : "فك قفل إعادة التصوير"}</span>
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SMART SEARCH & STUDENT VERIFICATION */}
      {activeTab === "search" && (
        <div>
          {/* Search Box */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px", marginBottom: "20px" }}>
            <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>
              ابحث عن الطالب بالكود الجامعي أو بالاسم:
            </label>
            <div style={{ display: "flex", gap: "6px", alignItems: "stretch", width: "100%", boxSizing: "border-box" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") executeStudentSearch(); }}
                  placeholder="كود الطالب أو الاسم..."
                  className="tabular-nums"
                  style={{ width: "100%", height: "44px", padding: "0 12px", background: "var(--bg-deep)", border: "1px solid var(--primary)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "14px", boxSizing: "border-box" }}
                />
                {isSearching && !/^\d+$/.test(searchQuery.trim()) && (
                  <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", border: "2px solid var(--accent-ink)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                )}
              </div>

              {/* زر البحث الفوري */}
              <button
                type="button"
                onClick={() => executeStudentSearch()}
                disabled={isSearching || !searchQuery.trim()}
                style={{
                  height: "44px",
                  padding: "0 14px",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: isSearching ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxSizing: "border-box"
                }}
              >
                <Search size={15} strokeWidth={1.5} />
                <span>بحث</span>
              </button>

              {/* زر الكاميرا لمسح QR */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(!isCameraOpen)}
                style={{
                  height: "44px",
                  width: "44px",
                  background: isCameraOpen ? "var(--error)" : "var(--surface-hover)",
                  color: isCameraOpen ? "#fff" : "var(--accent-ink)",
                  border: isCameraOpen ? "1px solid transparent" : "1px solid var(--primary)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxSizing: "border-box"
                }}
                title={isCameraOpen ? "إغلاق الكاميرا" : "مسح QR بالكاميرا"}
              >
                <Camera size={18} strokeWidth={1.5} />
              </button>
            </div>

            {isCameraOpen && (
              <div style={{ marginTop: "14px", borderRadius: "12px", overflow: "hidden" }}>
                <QRScanner
                  onScan={(decoded) => {
                    const code = extractStudentCode(decoded) || decoded.trim();
                    if (code) {
                      setSearchQuery(code);
                      setIsCameraOpen(false);
                      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(80);
                      executeStudentSearch(code);
                    }
                  }}
                  onClose={() => setIsCameraOpen(false)}
                  height="260px"
                  compact={true}
                />
              </div>
            )}
            <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
              <Lightbulb size={13} strokeWidth={1.5} color="var(--accent-ink)" style={{ flexShrink: 0 }} />
              <span>يقتصر البحث على الفرق والمقررات المسندة إليك فقط لمطابقة وجه الطالب، وفحص أعماله معك.</span>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length === 0 && searchQuery && !isSearching && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
              لا يوجد طالب مطابق لهذا البحث في كشوف مقرراتك المسندة.
            </div>
          )}

          {/* Results List: Showing ONLY Student Name and Academic Year */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {searchResults.map((res: any) => {
              const st = res.student;
              const acc = res.account;
              const subs = res.submissions || [];
              const isExpanded = expandedStudentId === st.id;

              return (
                <div
                  key={st.id}
                  style={{
                    padding: "14px 18px",
                    border: isExpanded ? "1px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "12px",
                    background: isExpanded ? "var(--surface-hover)" : "var(--surface)",
                    transition: "border-color 0.2s ease, background-color 0.2s ease"
                  }}
                >
                  {/* Clean List Row: Student Name + Academic Year ONLY */}
                  <div
                    onClick={() => setExpandedStudentId(isExpanded ? null : st.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.14)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-ink)" }}>
                        <User size={16} strokeWidth={1.5} />
                      </div>
                      <div>
                        <div style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "15px" }}>
                          {st.full_name}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        background: "rgba(56, 189, 248, 0.12)",
                        color: "var(--accent-ink)",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}>
                        {st.academic_year || "عام"}
                      </span>
                      <button
                        className="btn-compact"
                        style={{
                          background: isExpanded ? "var(--primary)" : "var(--bg-deep)",
                          color: "#fff",
                          border: isExpanded ? "none" : "1px solid var(--border)",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "500",
                          cursor: "pointer"
                        }}
                      >
                        {isExpanded ? "إخفاء السجل" : "عرض السجل والأعمال"}
                      </button>
                    </div>
                  </div>

                  {/* Detailed View on Click: Shows ID Card and Submissions with THIS Assistant Only */}
                  {isExpanded && (
                    <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed #2a374f" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "10px" }}>
                        
                        {/* Student ID Photo for Face Verification */}
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>
                            صورة بطاقة الرقم القومي (لمطابقة الوجه والهوية):
                          </div>
                          {acc?.id_card_url ? (
                            <div
                              onClick={() => {
                                setPreviewImage({ url: acc.id_card_url, title: `بطاقة هوية: ${st.full_name}`, subTitle: `كود: ${st.student_code}` });
                                setRotationDegrees(0);
                              }}
                              style={{ width: "160px", height: "100px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--success)", cursor: "pointer", background: "#000" }}
                            >
                              <img src={acc.id_card_url} alt="بطاقة الهوية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                          ) : (
                            <div style={{ padding: "10px", background: "rgba(245, 158, 11, 0.08)", border: "1px dashed var(--warning)", borderRadius: "8px", color: "var(--warning)", fontSize: "12px" }}>
                              لم يقم الطالب برفع صورة بطاقة الهوية بعد
                            </div>
                          )}
                          <div className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "6px" }}>
                            السكشن: {st.section || "1"} {acc?.mobile && `• هاتف: ${acc.mobile}`}
                          </div>
                        </div>

                        {/* Submissions with THIS assistant only */}
                        <div>
                          <div style={{ color: "var(--accent-ink)", fontSize: "12px", fontWeight: "600", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Layers size={14} strokeWidth={1.5} />
                            <span>الأعمال المرفوعة في مقرراتك المسندة إليك:</span>
                          </div>

                          {subs.length === 0 ? (
                            <div style={{ padding: "14px", background: "var(--bg-deep)", borderRadius: "8px", color: "var(--text-muted)", fontSize: "12px", textAlign: "center" }}>
                              لا توجد أعمال مرفوعة لهذا الطالب في مقرراتك حتى الآن.
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {subs.map((s: any, sIdx: number) => {
                                const imgUrl = s.images?.[0]?.url || s.photo_url || "";
                                const isActionLoading = actionLoading === `${st.student_code}_${s.project_name}`;

                                return (
                                  <div key={sIdx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "8px", gap: "10px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                      {imgUrl && (
                                        <div
                                          onClick={() => {
                                            setPreviewImage({ url: imgUrl, title: `عمل: ${s.project_name} - ${st.full_name}`, subTitle: `مقرر: ${s.course_name || ""}` });
                                            setRotationDegrees(0);
                                          }}
                                          style={{ width: "44px", height: "44px", borderRadius: "6px", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}
                                        >
                                          <img src={imgUrl} alt="اللوحة" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        </div>
                                      )}
                                      <div>
                                        <div style={{ color: "var(--text-primary)", fontWeight: "600", fontSize: "12px" }}>{s.project_name}</div>
                                        <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>{s.course_name || "مقرر مسند"}</div>
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => handleAllowRetake(st.student_code, s.course_id, s.project_name, st.full_name)}
                                      disabled={isActionLoading}
                                      className="btn-compact"
                                      style={{ background: "rgba(239, 68, 68, 0.14)", border: "1px solid var(--error)", color: "var(--error)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                                    >
                                      <RefreshCw size={11} strokeWidth={1.5} className={isActionLoading ? "spin" : ""} />
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal (Rendered directly into document.body via Portal) */}
      {previewImage && mounted && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 999999,
            background: "rgba(0,0,0,0.94)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "20px",
            boxSizing: "border-box"
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-primary)", zIndex: 10 }}>
            <div>
              <div style={{ fontWeight: "600", fontSize: "15px" }}>{previewImage.title}</div>
              <div className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "12px" }}>{previewImage.subTitle}</div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRotationDegrees(prev => (prev + 90) % 360);
                }}
                className="btn-compact"
                style={{ background: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                <RotateCw size={14} strokeWidth={1.5} />
                <span>تدوير 90°</span>
              </button>
              <button
                onClick={() => setPreviewImage(null)}
                className="btn-compact"
                style={{ background: "var(--error)", border: "none", color: "#fff", width: "36px", height: "36px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                aria-label="إغلاق"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Full Image Centered in Current Viewport */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "16px 0" }}>
            <img
              src={previewImage.url}
              alt="معاينة"
              style={{ maxHeight: "80vh", maxWidth: "90vw", objectFit: "contain", borderRadius: "12px", transform: `rotate(${rotationDegrees}deg)`, transition: "transform 0.3s" }}
            />
          </div>

          {/* Footer note */}
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
            اضغط في أي مكان فارغ للإغلاق
          </div>
        </div>,
        document.body
      )}

      <footer style={{ textAlign: "center", paddingTop: "28px", paddingBottom: "20px", color: "var(--text-muted)", fontSize: "11px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </footer>
    </div>
  );
}
