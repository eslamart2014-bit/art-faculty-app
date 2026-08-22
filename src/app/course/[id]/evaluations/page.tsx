"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import QRScanner from "@/components/QRScanner";
import { extractStudentCode } from "@/lib/scannerHelper";

type Project = {
  id: string;
  name: string;
  max_score: number;
  is_archived?: boolean;
};

export default function EvaluationsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Camera state
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraIndex, setCameraIndex] = useState(0);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setCameraIndex(videoDevices.length - 1);
          setSelectedCameraId(videoDevices[videoDevices.length - 1].deviceId);
        }
      });
    }
  }, []);

  const switchCamera = () => {
    if (cameraDevices.length > 1) {
      const nextIndex = (cameraIndex + 1) % cameraDevices.length;
      setCameraIndex(nextIndex);
      setSelectedCameraId(cameraDevices[nextIndex].deviceId);
    }
  };

  
  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Stats state
  const [totalCourseStudents, setTotalCourseStudents] = useState(0);
  const [projectStats, setProjectStats] = useState<Record<string, number>>({});


  // View states
  const [view, setView] = useState<'PROJECTS' | 'EVAL_MENU' | 'MANUAL' | 'CAMERA'>('PROJECTS');
  
  // Modals
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectMaxScore, setNewProjectMaxScore] = useState("50");

  const [showManageProjectModal, setShowManageProjectModal] = useState(false);
  const [longPressProject, setLongPressProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectMaxScore, setEditProjectMaxScore] = useState("");
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const [scannerPulse, setScannerPulse] = useState(false);

  // Form states
  const [searchInput, setSearchInput] = useState("");
  
  // Camera specific states
  const [markAttendanceWithEval, setMarkAttendanceWithEval] = useState(true);
  const [scannedStudents, setScannedStudents] = useState<any[]>([]);
  const [activeScannedStudent, setActiveScannedStudent] = useState<any>(null); // For the grade panel
  const [savingBatch, setSavingBatch] = useState(false);

  // Manual specific states
  const [targetStudent, setTargetStudent] = useState<any>(null);
  const [manualScore, setManualScore] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [searchingManual, setSearchingManual] = useState(false);

  // Easter Egg
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [easterEggData, setEasterEggData] = useState<any>(null);

  // Search Debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchCourse();
  }, [resolvedParams.id]);

  const fetchCourse = async () => {
    const { data } = await supabase.from("courses").select("*").eq("id", resolvedParams.id).single();
    if (data) {
      setCourse(data);
      const customNames = data.custom_week_names || {};
      const loadedProjects = customNames.__projects__ || [];
      setProjects(loadedProjects);
      await fetchStats(data);
    }
    setLoading(false);
  };

  const fetchStats = async (courseData: any) => {
    const { data: studentsData } = await supabase.from("students").select("id").eq("academic_year", courseData.academic_year);
    const excluded = courseData.excluded_students || [];
    const activeStudents = (studentsData || []).filter((s: any) => !excluded.includes(s.id));
    let count = activeStudents.length;

    if (courseData.makeup_students && courseData.makeup_students.length > 0) {
      const makeupSet = new Set(courseData.makeup_students);
      activeStudents.forEach((s: any) => makeupSet.delete(s.id));
      const validMakeupCount = Array.from(makeupSet).filter((id: any) => !excluded.includes(id)).length;
      count += validMakeupCount;
    }
    setTotalCourseStudents(count);

    const { data: evalsData } = await supabase.from("evaluations").select("project_name").eq("course_id", courseData.id);
    const stats: Record<string, number> = {};
    (evalsData || []).forEach((ev: any) => {
      stats[ev.project_name] = (stats[ev.project_name] || 0) + 1;
    });
    setProjectStats(stats);
  };

  const saveNewProject = async () => {
    if (!newProjectName || !newProjectMaxScore) return;
    const maxScoreNum = Number(newProjectMaxScore);
    if (isNaN(maxScoreNum) || maxScoreNum <= 0) {
      alert("يرجى إدخال درجة قصوى صحيحة");
      return;
    }

    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName,
      max_score: maxScoreNum
    };

    const updatedProjects = [...projects, newProject];
    const updatedCustomWeekNames = {
      ...(course.custom_week_names || {}),
      __projects__: updatedProjects
    };

    await supabase.from("courses").update({ custom_week_names: updatedCustomWeekNames }).eq("id", course.id);
    
    setProjects(updatedProjects);
    setCourse({ ...course, custom_week_names: updatedCustomWeekNames });
    
    if (view === 'CAMERA' || view === 'MANUAL') {
      setSelectedProject(newProject);
    }

    setShowAddProjectModal(false);
    setNewProjectName("");
    setNewProjectMaxScore("50");
  };

  const handleProjectTouchStart = (proj: Project) => {
    longPressTriggered.current = false;
    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setLongPressProject(proj);
      setEditProjectName(proj.name);
      setEditProjectMaxScore(proj.max_score.toString());
      setShowManageProjectModal(true);
      vibrateSuccess();
    }, 600);
  };

  const handleProjectTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const updateProject = async () => {
    if (!longPressProject) return;
    const maxScoreNum = Number(editProjectMaxScore);
    if (isNaN(maxScoreNum) || maxScoreNum <= 0) return;
    const updatedProjects = projects.map(p => 
      p.id === longPressProject.id ? { ...p, name: editProjectName, max_score: maxScoreNum } : p
    );
    const updatedCustomWeekNames = { ...(course.custom_week_names || {}), __projects__: updatedProjects };
    await supabase.from("courses").update({ custom_week_names: updatedCustomWeekNames }).eq("id", course.id);
    setProjects(updatedProjects);
    setCourse({ ...course, custom_week_names: updatedCustomWeekNames });
    setShowManageProjectModal(false);
  };

  const archiveProject = async () => {
    if (!longPressProject) return;
    const updatedProjects = projects.map(p => 
      p.id === longPressProject.id ? { ...p, is_archived: true } : p
    );
    const updatedCustomWeekNames = { ...(course.custom_week_names || {}), __projects__: updatedProjects };
    await supabase.from("courses").update({ custom_week_names: updatedCustomWeekNames }).eq("id", course.id);
    setProjects(updatedProjects);
    setCourse({ ...course, custom_week_names: updatedCustomWeekNames });
    setShowManageProjectModal(false);
  };

  const handleSelectProject = (proj: Project) => {
    if (longPressTriggered.current) return;
    setSelectedProject(proj);
    setView('EVAL_MENU');
  };

  const getQuickGrades = (maxScore: number) => {
    if (maxScore <= 30) return Array.from({length: maxScore + 1}, (_, i) => i);
    if (maxScore === 50) return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    if (maxScore === 100) return [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    return [0, Math.floor(maxScore*0.2), Math.floor(maxScore*0.4), Math.floor(maxScore*0.6), Math.floor(maxScore*0.8), maxScore];
  };

  const vibrateSuccess = () => { if (navigator.vibrate) navigator.vibrate(100); };
  const vibrateError = () => { if (navigator.vibrate) navigator.vibrate([50, 100, 50]); };

  // Helper to fetch attendance count
  const getAttendanceCount = async (studentId: string) => {
    const { data } = await supabase.from("attendance").select("id").eq("course_id", course.id).eq("student_id", studentId);
    return data ? data.length : 0;
  };

  // --- CROSS-COURSE MAKEUP LOGIC ---
  const handleCrossCourseMakeup = async (code: string) => {
    // Look globally for the student
    const { data: globalStudent } = await supabase.from("students").select("*").eq("student_code", code).maybeSingle();
    
    if (!globalStudent) {
      vibrateError();
      alert("لم يتم العثور على طالب بهذا الكود في أي فرقة!");
      return null;
    }

    vibrateError(); // Small alert pattern
    const confirmAdd = window.confirm(`الطالب (${globalStudent.full_name}) مقيد بفرقة أخرى وغير مسجل بالتخلفات هنا.\nهل تود ضمه كطالب تخلفات الآن؟`);
    
    if (confirmAdd) {
      const updatedMakeup = [...(course.makeup_students || []), globalStudent.id];
      await supabase.from("courses").update({ makeup_students: updatedMakeup }).eq("id", course.id);
      setCourse({ ...course, makeup_students: updatedMakeup });
      vibrateSuccess();
      return globalStudent;
    }
    return null;
  };

  const checkStudentLocalOrGlobal = async (code: string) => {
    // 1. Check local
    const isMakeup = course.makeup_students && course.makeup_students.length > 0;
    
    let query = supabase.from("students").select("*").eq("student_code", code);
    
    if (isMakeup) {
      query = query.or(`academic_year.eq.${course.academic_year},id.in.(${course.makeup_students.join(",")})`);
    } else {
      query = query.eq("academic_year", course.academic_year);
    }

    const { data: localStudent } = await query.maybeSingle();
    if (localStudent) return localStudent;

    // 2. Not found locally -> Check cross-course
    return await handleCrossCourseMakeup(code);
  };


  const startScanner = () => {
    setView('CAMERA');
  };

  const handleScannerScan = async (decodedText: string) => {
    if (!decodedText || activeScannedStudent) return;
    
    // pulse effect
    setScannerPulse(true);
    setTimeout(() => setScannerPulse(false), 300);

    const cleanCode = extractStudentCode(decodedText);
    if (cleanCode.match(/^#(.*?)#$/)) {
      vibrateSuccess();
      await triggerEasterEgg(cleanCode.match(/^#(.*?)#$/)![1]);
      return;
    }

          const student = await checkStudentLocalOrGlobal(cleanCode);
          if (student) {
            if (scannedStudents.some(s => s.student.id === student.id)) {
              vibrateError();
              alert("تم مسح هذا الطالب بالفعل!");
            } else {
              const { data: existingGrade } = await supabase
                .from("evaluations")
                .select("score, created_at")
                .eq("course_id", course.id)
                .eq("student_id", student.id)
                .eq("project_name", selectedProject!.name)
                .maybeSingle();

              if (existingGrade) {
                vibrateError();
                const dateStr = new Date(existingGrade.created_at).toLocaleString('ar-EG');
                const confirmModify = window.confirm(`هذا الطالب تم تقييمه بالفعل!\nالدرجة السابقة: ${existingGrade.score} من ${selectedProject!.max_score}\nتاريخ التقييم: ${dateStr}\n\nهل تريد الاستمرار وتعديل درجته؟`);
                if (!confirmModify) return;
              }
              vibrateSuccess();
              const attCount = await getAttendanceCount(student.id);
              setActiveScannedStudent({ ...student, attCount });
            }
          }
  };

  const cancelScanner = () => {
    setView('EVAL_MENU');
    setScannedStudents([]);
    setActiveScannedStudent(null);
  };

  const handleSelectGradeForActiveStudent = (grade: number) => {
    if (!selectedProject) return;
    if (grade > selectedProject.max_score) {
      alert(`الدرجة المسموحة لا تتعدى ${selectedProject.max_score}`);
      return;
    }
    
    setScannedStudents([...scannedStudents, { 
      student: activeScannedStudent, 
      score: grade, 
      project: selectedProject,
      attCount: activeScannedStudent.attCount 
    }]);
    setActiveScannedStudent(null);
  };

  const handleCancelActiveStudent = () => {
    setActiveScannedStudent(null);
  };

  const removeScannedStudent = (id: string) => {
    setScannedStudents(scannedStudents.filter(s => s.student.id !== id));
  };

  const saveBatchEvaluations = async () => {
    if (scannedStudents.length === 0) return;
    setSavingBatch(true);
    
    const evalInserts = scannedStudents.map(s => ({
      course_id: course.id,
      student_id: s.student.id,
      project_name: s.project.name,
      score: s.score,
      teacher_id: course.teacher_id
    }));

    await supabase.from("evaluations").upsert(evalInserts, { onConflict: 'course_id,student_id,project_name' });

    if (markAttendanceWithEval) {
      const today = new Date().toISOString().split('T')[0];
      const attInserts = scannedStudents.map(s => ({
        course_id: course.id,
        student_id: s.student.id,
        date: today,
        status: "حاضر",
        teacher_id: course.teacher_id
      }));
      await supabase.from("attendance").upsert(attInserts, { onConflict: 'course_id,student_id,date' });
    }

    vibrateSuccess();
    alert("✅ تم حفظ التقييمات بنجاح!");
    setScannedStudents([]);
    setSavingBatch(false);
    fetchStats(course);
  };


  // --- MANUAL LOGIC ---
  const handleManualSearch = async () => {
    let code = searchInput.trim();
    if (!code) return;
    
    code = extractStudentCode(code);

    if (code.match(/^#(.*?)#$/)) {
      vibrateSuccess();
      await triggerEasterEgg(code.match(/^#(.*?)#$/)![1]);
      setSearchInput("");
      return;
    }

    setSearchingManual(true);
    const student = await checkStudentLocalOrGlobal(code);
    
    if (student) {
      const { data: ex } = await supabase.from("evaluations")
        .select("score, created_at").eq("course_id", course.id).eq("student_id", student.id).eq("project_name", selectedProject?.name).maybeSingle();
      
      if (ex) {
        vibrateError();
        const dateStr = new Date(ex.created_at).toLocaleString('ar-EG');
        const confirmModify = window.confirm(`هذا الطالب تم تقييمه بالفعل!\nالدرجة السابقة: ${ex.score} من ${selectedProject!.max_score}\nتاريخ التقييم: ${dateStr}\n\nهل تريد الاستمرار وتعديل درجته؟`);
        if (!confirmModify) {
          setSearchingManual(false);
          return;
        }
      }

      vibrateSuccess();
      const attCount = await getAttendanceCount(student.id);
      setTargetStudent({ ...student, attCount });
      
      setManualScore(ex ? ex.score.toString() : "");
      
      // Auto focus grade input
      setTimeout(() => document.getElementById("manualGradeInput")?.focus(), 100);
    } else {
      setTargetStudent(null);
      vibrateError();
      alert("لم يتم العثور على طالب بهذا الكود.");
    }
    setSearchingManual(false);
  };

  const saveManualEvaluation = async () => {
    if (!manualScore || isNaN(Number(manualScore)) || !selectedProject || !targetStudent) return;
    
    const scoreNum = Number(manualScore);
    if (scoreNum > selectedProject.max_score) {
      vibrateError();
      alert(`الدرجة المسموحة لا تتعدى ${selectedProject.max_score}`);
      return;
    }

    setSavingManual(true);
    await supabase.from("evaluations").upsert({
      course_id: course.id,
      student_id: targetStudent.id,
      project_name: selectedProject.name,
      score: scoreNum,
      teacher_id: course.teacher_id
    }, { onConflict: 'course_id,student_id,project_name' });

    vibrateSuccess();
    setSearchInput("");
    setTargetStudent(null);
    setManualScore("");
    setSavingManual(false);
    fetchStats(course);
    
    // Auto focus back to search input
    document.getElementById("manualSearchInput")?.focus();
  };

  const handleManualScoreKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveManualEvaluation();
    }
  };


  // --- EASTER EGG ---
  const triggerEasterEgg = async (actualCode: string) => {
    const { data: student } = await supabase.from("students").select("*").eq("student_code", actualCode).single();
    if (!student) { vibrateError(); alert("كود الطالب السري غير صحيح."); return; }
    const { data: att } = await supabase.from("attendance").select("*").eq("course_id", course.id).eq("student_id", student.id);
    const { data: evals } = await supabase.from("evaluations").select("*").eq("course_id", course.id).eq("student_id", student.id);
    setEasterEggData({ student, attendanceCount: att?.length || 0, evaluations: evals || [] });
    setShowEasterEgg(true);
  };


  if (loading || !course) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><div className="loader-circle"></div></div>;

  return (
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: "#121212" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#1e1e1e", borderBottom: "1px solid #333", direction: "rtl" }}>
        <button className="hide-on-mobile" onClick={() => {
          if (view === 'CAMERA') cancelScanner();
          else if (view === 'MANUAL') { setView('EVAL_MENU'); setTargetStudent(null); setSearchInput(""); }
          else if (view === 'EVAL_MENU') setView('PROJECTS');
          else router.push(`/course/${course?.id}`);
        }} style={{ background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>🡲</button>
        <h2 style={{ margin: 0, color: "#FF9800", fontSize: "18px" }}>بوابة التقييم</h2>
        <div style={{ width: "24px" }}></div>
      </div>

      <div style={{ padding: "20px", direction: "rtl", flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        
        {/* PROJECTS LIST VIEW */}
        {view === 'PROJECTS' && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ color: "#FF9800", margin: 0 }}>المشاريع المتاحة للتقييم</h3>
              <button onClick={() => setShowAddProjectModal(true)} style={{ background: "#4CAF50", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "8px", fontWeight: "bold" }}>➕ إضافة مشروع</button>
            </div>

            {projects.filter(p => !p.is_archived).length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#666", background: "#1e1e1e", borderRadius: "15px", border: "1px dashed #444" }}>
                لا توجد مشاريع مضافة حتى الآن.<br/>اضغط على "إضافة مشروع" للبدء.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
                {projects.filter(p => !p.is_archived).map(proj => {
                  const graded = projectStats[proj.name] || 0;
                  const ungraded = totalCourseStudents - graded;
                  return (
                    <div key={proj.id} 
                      onClick={() => handleSelectProject(proj)} 
                      onTouchStart={() => handleProjectTouchStart(proj)}
                      onTouchEnd={handleProjectTouchEnd}
                      onMouseDown={() => handleProjectTouchStart(proj)}
                      onMouseUp={handleProjectTouchEnd}
                      onMouseLeave={handleProjectTouchEnd}
                      style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1, pointerEvents: "none" }}>
                        <div style={{ color: "#90CAF9", fontWeight: "bold", fontSize: "20px", marginBottom: "10px" }}>{proj.name} <span style={{ color: "#888", fontSize: "14px", fontWeight: "normal" }}>({proj.max_score} درجة)</span></div>
                        <div style={{ display: "flex", gap: "15px", fontSize: "11px", opacity: 0.85 }}>
                          <span style={{ color: "#81C784" }}>✅ مقيّم: {graded}</span>
                          <span style={{ color: "#E57373" }}>⏳ متبقي: {ungraded}</span>
                          <span style={{ color: "#B0BEC5" }}>👥 الإجمالي: {totalCourseStudents}</span>
                        </div>
                      </div>
                      <div style={{ color: "#fff", fontSize: "20px", paddingRight: "15px" }}>🡰</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* EVALUATION MENU */}
        {view === 'EVAL_MENU' && selectedProject && (
          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <div style={{ background: "#2d2d2d", padding: "15px", borderRadius: "10px", marginBottom: "30px", border: "1px solid #4CAF50" }}>
              <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "5px" }}>المشروع المحدد:</div>
              <div style={{ color: "#81C784", fontWeight: "bold", fontSize: "24px", marginBottom: "20px", textAlign: "center" }}>{selectedProject.name} <span style={{ color: "#888", fontSize: "16px", fontWeight: "normal" }}>({selectedProject.max_score} درجة)</span></div>
              
              <div style={{ display: "flex", justifyContent: "space-around", background: "#1e1e1e", padding: "15px", borderRadius: "10px", fontSize: "11px", opacity: 0.9 }}>
                 <div style={{ textAlign: "center" }}><div style={{ color: "#81C784", fontSize: "20px", fontWeight: "bold" }}>{projectStats[selectedProject.name] || 0}</div><div style={{ color: "#888", marginTop: "6px" }}>مقيّم ✅</div></div>
                 <div style={{ width: "1px", background: "#333" }}></div>
                 <div style={{ textAlign: "center" }}><div style={{ color: "#E57373", fontSize: "20px", fontWeight: "bold" }}>{totalCourseStudents - (projectStats[selectedProject.name] || 0)}</div><div style={{ color: "#888", marginTop: "6px" }}>متبقي ⏳</div></div>
                 <div style={{ width: "1px", background: "#333" }}></div>
                 <div style={{ textAlign: "center" }}><div style={{ color: "#90CAF9", fontSize: "20px", fontWeight: "bold" }}>{totalCourseStudents}</div><div style={{ color: "#888", marginTop: "6px" }}>الإجمالي 👥</div></div>
              </div>
            </div>

            <h3 style={{ color: "#FF9800", marginBottom: "30px" }}>⭐ اختر طريقة التقييم</h3>
            <button onClick={startScanner} style={{ width: "100%", background: "#4CAF50", color: "#fff", padding: "20px", borderRadius: "15px", fontSize: "18px", fontWeight: "bold", marginBottom: "15px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>📱</span> التقييم الذكي (بالكاميرا)
            </button>
            <button onClick={() => setView('MANUAL')} style={{ width: "100%", background: "#2196F3", color: "#fff", padding: "20px", borderRadius: "15px", fontSize: "18px", fontWeight: "bold", marginBottom: "15px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>📝</span> التقييم اليدوي الآلي
            </button>
          </div>
        )}

        {/* MANUAL EVALUATION VIEW */}
        {view === 'MANUAL' && (
          <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", flexGrow: 1, display: "flex", flexDirection: "column" }}>
            
            <div style={{ marginBottom: "20px" }}>
              <label style={{ color: "#aaa", fontSize: "12px", display: "block", marginBottom: "5px" }}>المشروع الحالي:</label>
              <select value={selectedProject?.id || ""} onChange={e => {
                if (e.target.value === "ADD_NEW") setShowAddProjectModal(true);
                else {
                  const p = projects.find(x => x.id === e.target.value);
                  if (p) setSelectedProject(p);
                }
              }} style={{ width: "100%", padding: "12px", background: "#222", border: "1px solid #444", borderRadius: "10px", color: "#fff", fontSize: "16px", outline: "none" }}>
                {projects.filter(p => !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.name} (Max {p.max_score})</option>)}
                <option value="ADD_NEW" style={{ color: "#4CAF50" }}>➕ إضافة مشروع جديد...</option>
              </select>
            </div>

            <h3 style={{ marginTop: 0, color: "#2196F3", textAlign: "center" }}>البحث الآلي</h3>
            <input 
              id="manualSearchInput"
              type="text" 
              inputMode="decimal"
              placeholder="اكتب كود الطالب هنا..." 
              value={searchInput} 
              onChange={e => setSearchInput(e.target.value)} 
              onKeyDown={e => { if (e.key === 'Enter') handleManualSearch(); }}
              autoFocus
              style={{ width: "100%", padding: "20px", background: "#121212", border: "2px solid #2196F3", borderRadius: "10px", color: "#fff", fontSize: "24px", textAlign: "center", letterSpacing: "3px", marginBottom: "20px", outline: "none" }} 
            />

            {searchingManual && <div style={{ textAlign: "center", color: "#aaa", fontSize: "14px", marginBottom: "10px" }}>جاري البحث...</div>}

            {targetStudent && selectedProject && !searchingManual && (
              <div style={{ background: "#121212", padding: "20px", borderRadius: "15px", border: "2px solid #4CAF50", animation: "slideUp 0.3s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 5px 0", color: "#fff", fontSize: "18px" }}>{targetStudent.full_name}</h4>
                    <div style={{ color: "#aaa", fontSize: "12px" }}>السكشن: {targetStudent.section} • الكود: {targetStudent.student_code}</div>
                  </div>
                  <div style={{ background: "#2d2d2d", padding: "8px 12px", borderRadius: "8px", textAlign: "center", border: "1px solid #4CAF50" }}>
                    <div style={{ color: "#aaa", fontSize: "10px" }}>مرات الحضور</div>
                    <div style={{ color: "#4CAF50", fontSize: "18px", fontWeight: "bold" }}>{targetStudent.attCount}</div>
                  </div>
                </div>
                
                <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#222", padding: "15px", borderRadius: "10px" }}>
                  <input 
                    id="manualGradeInput"
                    type="number" 
                    inputMode="decimal"
                    step="any"
                    value={manualScore} 
                    onChange={e => setManualScore(e.target.value)} 
                    onKeyDown={handleManualScoreKeyPress}
                    placeholder="الدرجة" 
                    autoFocus
                    style={{ flex: 1, padding: "15px", background: "#121212", border: "2px solid #4CAF50", borderRadius: "8px", color: "#fff", fontSize: "24px", textAlign: "center", outline: "none" }} 
                  />
                  <span style={{ fontSize: "22px", color: "#666", fontWeight: "bold" }}>/ {selectedProject.max_score}</span>
                </div>

                <button onClick={saveManualEvaluation} disabled={savingManual} style={{ width: "100%", background: "#4CAF50", color: "#fff", padding: "15px", borderRadius: "10px", border: "none", fontSize: "18px", fontWeight: "bold", marginTop: "15px", cursor: "pointer" }}>
                  {savingManual ? "جاري الحفظ..." : "حفظ وانتقال للتالي ↵"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CAMERA SCANNER VIEW */}
        {view === 'CAMERA' && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e1e1e", padding: "10px", borderRadius: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>📝 إضافة حضور مع التقييم</span>
              <label style={{ position: "relative", display: "inline-block", width: "46px", height: "24px" }}>
                <input type="checkbox" checked={markAttendanceWithEval} onChange={e => setMarkAttendanceWithEval(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: markAttendanceWithEval ? "#4CAF50" : "#555", borderRadius: "24px", transition: "0.3s" }}>
                  <span style={{ position: "absolute", content: '""', height: "18px", width: "18px", left: "3px", bottom: "3px", backgroundColor: "white", borderRadius: "50%", transition: "0.3s", transform: markAttendanceWithEval ? "translateX(22px)" : "none" }}></span>
                </span>
              </label>
            </div>

            <select value={selectedProject?.id || ""} onChange={e => {
                if (e.target.value === "ADD_NEW") setShowAddProjectModal(true);
                else {
                  const p = projects.find(x => x.id === e.target.value);
                  if (p) setSelectedProject(p);
                }
              }} style={{ width: "100%", padding: "12px", background: "#1e1e1e", border: "1px solid #444", borderRadius: "10px", color: "#fff", marginBottom: "10px", fontSize: "16px", outline: "none" }}>
                {projects.filter(p => !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.name} (Max {p.max_score})</option>)}
                <option value="ADD_NEW" style={{ color: "#4CAF50" }}>➕ إضافة مشروع جديد...</option>
            </select>

            <div style={{ background: "black", borderRadius: "10px", overflow: "hidden", position: "relative", height: "300px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {!activeScannedStudent && (
                <QRScanner onScan={(result) => { if (result) handleScannerScan(result); }} />
              )}
              
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "220px", height: "220px", border: "3px solid", borderColor: scannerPulse ? "#81C784" : "rgba(76, 175, 80, 0.7)", borderRadius: "20px", pointerEvents: "none", boxShadow: scannerPulse ? "0 0 15px #81C784, 0 0 0 4000px rgba(0,0,0,0.5)" : "0 0 0 4000px rgba(0,0,0,0.5)", transition: "all 0.2s" }}></div>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "220px", height: "220px", pointerEvents: "none" }}>
                 <div style={{ position: "absolute", top: "-3px", left: "-3px", width: "30px", height: "30px", borderTop: "4px solid #4CAF50", borderLeft: "4px solid #4CAF50", borderTopLeftRadius: "15px" }}></div>
                 <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "30px", height: "30px", borderTop: "4px solid #4CAF50", borderRight: "4px solid #4CAF50", borderTopRightRadius: "15px" }}></div>
                 <div style={{ position: "absolute", bottom: "-3px", left: "-3px", width: "30px", height: "30px", borderBottom: "4px solid #4CAF50", borderLeft: "4px solid #4CAF50", borderBottomLeftRadius: "15px" }}></div>
                 <div style={{ position: "absolute", bottom: "-3px", right: "-3px", width: "30px", height: "30px", borderBottom: "4px solid #4CAF50", borderRight: "4px solid #4CAF50", borderBottomRightRadius: "15px" }}></div>
              </div>

              {!activeScannedStudent && (
                 <div style={{ position: "absolute", bottom: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "5px 15px", borderRadius: "15px", fontSize: "12px", zIndex: 10 }}>وجه الكاميرا داخل الإطار الأخضر</div>
              )}
            </div>

            {/* QUICK GRADE PANEL */}
            {activeScannedStudent && selectedProject && (
              <div style={{ background: "#1a2a1a", border: "2px solid #4CAF50", padding: "12px", borderRadius: "10px", marginTop: "10px" }}>
                {/* Student Info Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#4CAF50", fontWeight: "bold", fontSize: "15px", marginBottom: "2px" }}>{activeScannedStudent.full_name}</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ background: "#2196F3", color: "#fff", borderRadius: "5px", padding: "2px 8px", fontSize: "11px" }}>س: {activeScannedStudent.section}</span>
                      <span style={{ background: "#FF9800", color: "#fff", borderRadius: "5px", padding: "2px 8px", fontSize: "11px" }}>حضور: {activeScannedStudent.attCount} مرة</span>
                      <span style={{ background: "#555", color: "#fff", borderRadius: "5px", padding: "2px 8px", fontSize: "11px" }}>Max: {selectedProject.max_score}</span>
                    </div>
                  </div>
                  <button onClick={handleCancelActiveStudent} style={{
                    background: "rgba(244,67,54,0.2)", color: "#f44336", border: "1px solid #f44336",
                    borderRadius: "8px", padding: "6px 10px", fontSize: "12px", fontWeight: "bold",
                    cursor: "pointer", width: "auto", margin: 0, flexShrink: 0
                  }}>✕ إلغاء</button>
                </div>

                {/* Grade buttons */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: selectedProject.max_score <= 30 ? "repeat(8, 1fr)" : "repeat(5, 1fr)",
                  gap: "4px", maxHeight: "150px", overflowY: "auto"
                }}>
                  {getQuickGrades(selectedProject.max_score).map(g => (
                    <button key={g} onClick={() => handleSelectGradeForActiveStudent(g)} style={{
                      background: g === 0 ? "#333" : g >= selectedProject.max_score * 0.8 ? "#4CAF50" : g >= selectedProject.max_score * 0.5 ? "#2196F3" : "#FF9800",
                      border: "none", color: "#fff",
                      padding: selectedProject.max_score <= 30 ? "8px 0" : "10px 0",
                      borderRadius: "6px",
                      fontSize: selectedProject.max_score <= 30 ? "13px" : "15px",
                      fontWeight: "bold", cursor: "pointer", margin: 0, width: "auto"
                    }}>
                      {g}
                    </button>
                  ))}
                  <button onClick={() => { const q = prompt(`درجة مخصصة (0-${selectedProject.max_score})`); if(q && !isNaN(Number(q))) handleSelectGradeForActiveStudent(Number(q)); }} style={{
                    background: "#444", border: "none", color: "#aaa", padding: "8px 0",
                    borderRadius: "6px", fontSize: "11px", gridColumn: selectedProject.max_score <= 30 ? "span 8" : "span 5",
                    cursor: "pointer", margin: 0, width: "auto"
                  }}>✏️ درجة مخصصة / كسر</button>
                </div>
              </div>
            )}

            {/* SCANNED LIST */}
            <div style={{ background: "#1e1e1e", borderRadius: "10px", marginTop: "10px", flexGrow: 1, overflowY: "auto", border: "1px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 15px", borderBottom: "1px solid #333", background: "#222", position: "sticky", top: 0 }}>
                <span style={{ color: "#FFB74D", fontWeight: "bold", fontSize: "14px" }}>تم التقييم: <span style={{ color: "#fff" }}>{scannedStudents.length}</span> طلاب</span>
                <button onClick={saveBatchEvaluations} disabled={scannedStudents.length === 0 || savingBatch} style={{ background: scannedStudents.length > 0 ? "#EF6C00" : "#555", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: "bold" }}>
                  {savingBatch ? "جاري الحفظ..." : "حفظ للجميع ✅"}
                </button>
              </div>
              
              <div style={{ padding: "10px" }}>
                {scannedStudents.length === 0 ? <div style={{ textAlign: "center", color: "#666", padding: "20px 0" }}>لم يتم تقييم أي طالب بعد</div> : (
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#333" }}>
                        <th style={{ padding: "8px", border: "1px solid #444", color: "#fff" }}>الاسم</th>
                        <th style={{ padding: "8px", border: "1px solid #444", color: "#fff", width: "40px" }}>حضور</th>
                        <th style={{ padding: "8px", border: "1px solid #444", color: "#fff", width: "40px" }}>الدرجة</th>
                        <th style={{ padding: "8px", border: "1px solid #444", color: "#fff", width: "30px" }}>حذف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedStudents.map(s => (
                        <tr key={s.student.id} style={{ background: "#1e1e1e" }}>
                          <td style={{ padding: "8px", border: "1px solid #444", textAlign: "right" }}>
                            {s.student.full_name}
                            <div style={{ fontSize: "9px", color: "#aaa" }}>{s.project.name} • س:{s.student.section}</div>
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #444", fontWeight: "bold", color: "#2196F3" }}>{s.attCount}</td>
                          <td style={{ padding: "8px", border: "1px solid #444", fontWeight: "bold", color: "#4CAF50", fontSize: "14px" }}>{s.score}</td>
                          <td style={{ padding: "8px", border: "1px solid #444" }}><button onClick={() => removeScannedStudent(s.student.id)} style={{ background: "transparent", border: "none", color: "#f44336", fontSize: "16px" }}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ADD PROJECT MODAL */}
      {showAddProjectModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#1e1e1e", width: "90%", maxWidth: "350px", padding: "20px", borderRadius: "15px", border: "1px solid #4CAF50", direction: "rtl", textAlign: "center" }}>
            <h3 style={{ color: "#4CAF50", marginTop: 0 }}>➕ إضافة مشروع جديد</h3>
            
            <input 
              type="text" 
              placeholder="اسم المشروع (مثال: بحث الفصل الأول)" 
              value={newProjectName} 
              onChange={e => setNewProjectName(e.target.value)}
              style={{ width: "100%", padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "8px", color: "#fff", marginBottom: "15px", textAlign: "right" }}
            />
            
            <label style={{ display: "block", color: "#aaa", fontSize: "12px", marginBottom: "5px", textAlign: "right" }}>الدرجة القصوى للمشروع:</label>
            <input 
              type="number" 
              inputMode="decimal"
              placeholder="50" 
              value={newProjectMaxScore} 
              onChange={e => setNewProjectMaxScore(e.target.value)}
              style={{ width: "100%", padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "8px", color: "#fff", marginBottom: "20px", textAlign: "center", fontSize: "18px" }}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={saveNewProject} style={{ flex: 1, background: "#4CAF50", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "bold" }}>حفظ المشروع</button>
              <button onClick={() => setShowAddProjectModal(false)} style={{ flex: 1, background: "transparent", color: "#fff", border: "1px solid #555", padding: "12px", borderRadius: "8px" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Easter Egg Modal */}
      {showEasterEgg && easterEggData && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 999, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px", borderBottom: "2px solid #0f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0a0a0a" }}>
            <h1 style={{ color: "#0f0", margin: 0, fontFamily: "monospace", fontSize: "20px", textShadow: "0 0 10px #0f0" }}>// CLASSIFIED_REPORT</h1>
            <button onClick={() => setShowEasterEgg(false)} style={{ background: "none", border: "none", color: "#0f0", fontSize: "24px", cursor: "pointer" }}>✖</button>
          </div>
          <div style={{ position: "relative", flexGrow: 1, overflowY: "auto", padding: "20px", direction: "rtl", color: "#0f0", fontFamily: "monospace" }}>
            <div style={{ border: "1px dashed #0f0", padding: "15px", marginBottom: "20px" }}>
              <div style={{ opacity: 0.7 }}>[TARGET_IDENTIFIED]</div>
              <div style={{ fontSize: "22px", fontWeight: "bold", marginTop: "10px" }}>{easterEggData.student.full_name}</div>
              <div>ID_CODE: {easterEggData.student.student_code}</div>
              <div>SECTION: {easterEggData.student.section}</div>
            </div>
            <div style={{ border: "1px dashed #0f0", padding: "15px", marginBottom: "20px" }}>
              <div style={{ opacity: 0.7 }}>[ATTENDANCE_METRICS]</div>
              <div style={{ fontSize: "30px", margin: "10px 0" }}>{easterEggData.attendanceCount} <span style={{ fontSize: "16px" }}>Weeks Present</span></div>
            </div>
            <div style={{ border: "1px dashed #0f0", padding: "15px" }}>
              <div style={{ opacity: 0.7, marginBottom: "15px" }}>[EVALUATION_RECORDS]</div>
              {easterEggData.evaluations.map((ev: any) => (
                <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(0,255,0,0.2)", padding: "10px 0" }}>
                  <span>{ev.project_name}</span><span style={{ fontWeight: "bold" }}>{ev.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* MANAGE PROJECT MODAL */}
      {showManageProjectModal && longPressProject && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#1e1e1e", width: "90%", maxWidth: "350px", padding: "20px", borderRadius: "15px", border: "1px solid #2196F3", direction: "rtl", textAlign: "center" }}>
            <h3 style={{ color: "#2196F3", marginTop: 0 }}>⚙️ إدارة المشروع</h3>
            
            <input 
              type="text" 
              value={editProjectName} 
              onChange={e => setEditProjectName(e.target.value)}
              style={{ width: "100%", padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "8px", color: "#fff", marginBottom: "15px", textAlign: "right" }}
            />
            
            <label style={{ display: "block", color: "#aaa", fontSize: "12px", marginBottom: "5px", textAlign: "right" }}>الدرجة القصوى للمشروع:</label>
            <input 
              type="number" 
              inputMode="decimal"
              value={editProjectMaxScore} 
              onChange={e => setEditProjectMaxScore(e.target.value)}
              style={{ width: "100%", padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "8px", color: "#fff", marginBottom: "20px", textAlign: "center", fontSize: "18px" }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={updateProject} style={{ background: "#2196F3", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "bold" }}>حفظ التعديلات</button>
              <button onClick={() => { if(confirm("هل أنت متأكد من نقل هذا المشروع للأرشيف؟ لن يظهر في القائمة بعد الآن.")) archiveProject(); }} style={{ background: "#F44336", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "bold" }}>أرشفة المشروع</button>
              <button onClick={() => setShowManageProjectModal(false)} style={{ background: "transparent", color: "#fff", border: "1px solid #555", padding: "12px", borderRadius: "8px" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
