"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { addToQueue } from "@/lib/syncEngine";
import QRScanner from "@/components/QRScanner";
import { extractStudentCode } from "@/lib/scannerHelper";
import { generatePrintableHtml } from "@/lib/pdfHelper";
import { downloadPdf } from "@/lib/downloadPdf";

function formatRelativeTimeArabic(dateInput: string | Date): string {
  const now = new Date();
  const past = new Date(dateInput);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  let relative = '';
  if (diffInSeconds < 60) {
    relative = 'منذ لحظات';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    relative = `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : minutes <= 10 ? 'دقائق' : 'دقيقة'}`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    relative = `منذ ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : hours <= 10 ? 'ساعات' : 'ساعة'}`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    relative = `منذ ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : days <= 10 ? 'أيام' : 'يوم'}`;
  } else {
    const weeks = Math.floor(diffInSeconds / 604800);
    relative = `منذ ${weeks} ${weeks === 1 ? 'أسبوع' : weeks === 2 ? 'أسبوعين' : weeks <= 10 ? 'أسابيع' : 'أسبوع'}`;
  }

  const exactDate = past.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
  const exactTime = past.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return `${relative} (${exactDate} - ${exactTime})`;
}

type Project = {
  id: string;
  name: string;
  max_score: number;
  is_archived?: boolean;
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
  show_score?: boolean;
  camera_mode?: '2d' | '3d';
  required_photos?: number;
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
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectMaxScore, setEditProjectMaxScore] = useState("");
  
  // NEW TELEGRAM SETTINGS STATE
  const [editProjectIsActive, setEditProjectIsActive] = useState(true);
  const [editProjectStartDate, setEditProjectStartDate] = useState("");
  const [editProjectEndDate, setEditProjectEndDate] = useState("");
  const [editProjectShowScore, setEditProjectShowScore] = useState(true);
  const [editProjectCameraMode, setEditProjectCameraMode] = useState<'2d'|'3d'>('2d');
  const [editProjectRequiredPhotos, setEditProjectRequiredPhotos] = useState<number>(1);
  const [showTelegramSettings, setShowTelegramSettings] = useState(false);
  const [sendBroadcastOnSave, setSendBroadcastOnSave] = useState(false);

  const [longPressProject, setLongPressProject] = useState<Project | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const [scannerPulse, setScannerPulse] = useState(false);

  // Project Stats Modal & PDF Export
  const [statsProject, setStatsProject] = useState<Project | null>(null);
  const [statsData, setStatsData] = useState<{ submitted: any[]; missing: any[] } | null>(null);
  const [loadingStatsModal, setLoadingStatsModal] = useState(false);

  // Image Zoom Modal & Mobile Back Handling
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const openZoomImage = (url: string) => {
    setZoomImage(url);
    if (typeof window !== "undefined") {
      window.history.pushState({ modal: "zoomImage" }, "");
    }
  };

  const closeZoomImage = () => {
    if (zoomImage) {
      setZoomImage(null);
      if (typeof window !== "undefined" && window.history.state && window.history.state.modal === "zoomImage") {
        window.history.back();
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (zoomImage) {
        setZoomImage(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [zoomImage]);

  // Form states
  const [searchInput, setSearchInput] = useState("");
  
  // Camera specific states
  const [markAttendanceWithEval, setMarkAttendanceWithEval] = useState(true);
  const [scannedStudents, setScannedStudents] = useState<any[]>([]);
  const [activeScannedStudent, setActiveScannedStudent] = useState<any>(null);
  const [savingBatch, setSavingBatch] = useState(false);

  // Manual specific states
  const [targetStudent, setTargetStudent] = useState<any>(null);
  const [manualScore, setManualScore] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [searchingManual, setSearchingManual] = useState(false);

  // Easter Egg
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [easterEggData, setEasterEggData] = useState<any>(null);

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

    const { data: evalsData } = await supabase.from("evaluations").select("project_name, score").eq("course_id", courseData.id);
    const stats: Record<string, number> = {};
    (evalsData || []).forEach((ev: any) => {
      if (ev.score !== null && ev.score > 0) {
        stats[ev.project_name] = (stats[ev.project_name] || 0) + 1;
      }
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
      setEditProjectIsActive(proj.is_active ?? true);
      setEditProjectStartDate(proj.start_date ?? "");
      setEditProjectEndDate(proj.end_date ?? "");
      setEditProjectShowScore(proj.show_score ?? true);
      setEditProjectCameraMode(proj.camera_mode ?? '2d');
      setEditProjectRequiredPhotos(proj.required_photos ?? 1);
      setShowTelegramSettings(false);
      setSendBroadcastOnSave(false);
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
      p.id === longPressProject.id ? { 
        ...p, 
        name: editProjectName, 
        max_score: maxScoreNum,
        is_active: editProjectIsActive,
        start_date: editProjectStartDate,
        end_date: editProjectEndDate,
        show_score: editProjectShowScore,
        camera_mode: editProjectCameraMode,
        required_photos: editProjectRequiredPhotos
      } : p
    );

    const updatedCustomWeekNames = {
      ...(course?.custom_week_names || {}),
      __projects__: updatedProjects
    };

    await supabase.from("courses").update({ custom_week_names: updatedCustomWeekNames }).eq("id", course!.id);
    
    setProjects(updatedProjects);
    if (course) setCourse({ ...course, custom_week_names: updatedCustomWeekNames });
    
    // Broadcast to students if requested
    if (sendBroadcastOnSave) {
      await fetch('/api/bot/notify_course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course?.id,
          projectName: editProjectName,
          startDate: editProjectStartDate,
          endDate: editProjectEndDate
        })
      });
      alert("تم إرسال إشعار للطلاب بنجاح!");
    }

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

  // --- PROJECT STATS MODAL & PDF EXPORT ---
  const openProjectStats = async (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setStatsProject(proj);
    setLoadingStatsModal(true);

    try {
      const { data: studentsData } = await supabase.from("students").select("*").eq("academic_year", course.academic_year);
      const excluded = course.excluded_students || [];
      let eligible = (studentsData || []).filter((s: any) => !excluded.includes(s.id));

      if (course.course_type === 'sections' && course.sections && Array.isArray(course.sections)) {
        eligible = eligible.filter((s: any) => course.sections.includes(s.section));
      }

      if (course.makeup_students && course.makeup_students.length > 0) {
        const { data: makeup } = await supabase.from("students").select("*").in("id", course.makeup_students);
        if (makeup) {
          const eligibleIds = new Set(eligible.map(s => s.id));
          makeup.forEach(m => {
            if (!eligibleIds.has(m.id) && !excluded.includes(m.id)) eligible.push(m);
          });
        }
      }

      const { data: evals } = await supabase
        .from("evaluations")
        .select("id, student_id, score, photo_url, created_at")
        .eq("course_id", course.id)
        .eq("project_name", proj.name);

      const submittedMap = new Map((evals || []).map(ev => [ev.student_id, ev]));
      const submittedList: any[] = [];
      const missingList: any[] = [];

      eligible.forEach((s: any) => {
        if (submittedMap.has(s.id)) {
          submittedList.push({ ...s, eval: submittedMap.get(s.id) });
        } else {
          missingList.push(s);
        }
      });

      setStatsData({ submitted: submittedList, missing: missingList });
    } catch (err) {
      console.error("Error loading project stats:", err);
    } finally {
      setLoadingStatsModal(false);
    }
  };

  const exportMissingStudentsPdf = (proj: Project, missingList: any[]) => {
    const tableRows = missingList.map((s, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-align: right; font-weight: bold;">${s.full_name}</td>
        <td>${s.student_code}</td>
        <td>${s.section || 'عام'}</td>
        <td>${s.academic_year || course.academic_year}</td>
        <td style="color: red; font-weight: bold;">لم يتم الرفع ❌</td>
      </tr>
    `).join("");

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>اسم الطالب</th>
            <th>كود الطالب</th>
            <th>الشعبة</th>
            <th>الفرقة</th>
            <th>حالة الرفع</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    downloadPdf(
      "missing_students.pdf",
      course.name,
      `تقرير الطلاب المتأخرين عن رفع مشروع (${proj.name})`,
      `إجمالي المتأخرين: ${missingList.length} طالب - تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`,
      tableHtml,
      "أستاذ المقرر: ...................."
    );
  };

  // Full 0 to max_score with +1 increment
  const getQuickGrades = (maxScore: number) => {
    const safeMax = Math.min(Math.max(Math.floor(maxScore || 10), 1), 100);
    return Array.from({ length: safeMax + 1 }, (_, i) => i);
  };

  const vibrateSuccess = () => { if (navigator.vibrate) navigator.vibrate(100); };
  const vibrateError = () => { if (navigator.vibrate) navigator.vibrate([50, 100, 50]); };

  const getAttendanceCount = async (studentId: string) => {
    const { data } = await supabase.from("attendance").select("id").eq("course_id", course.id).eq("student_id", studentId);
    return data ? data.length : 0;
  };

  const handleCrossCourseMakeup = async (code: string) => {
    const { data: globalStudent } = await supabase.from("students").select("*").eq("student_code", code).maybeSingle();
    
    if (!globalStudent) {
      vibrateError();
      alert("لم يتم العثور على طالب بهذا الكود في أي فرقة!");
      return null;
    }

    vibrateError();
    const confirmAdd = window.confirm(`الطالب (${globalStudent.full_name}) مقيد بفرقة ${globalStudent.academic_year} - سكشن ${globalStudent.section} وهو غير مدرج في قوائم هذا المقرر.\nهل تود ضمه كطالب تخلفات / مستمع الآن؟`);
    
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
    let { data: student } = await supabase.from("students")
      .select("*")
      .eq("academic_year", course.academic_year)
      .eq("student_code", code)
      .maybeSingle();

    if (!student && course.makeup_students && course.makeup_students.length > 0) {
      const { data: makeupStudent } = await supabase.from("students")
        .select("*")
        .in("id", course.makeup_students)
        .eq("student_code", code)
        .maybeSingle();
      if (makeupStudent) student = makeupStudent;
    }

    if (!student) {
      student = await handleCrossCourseMakeup(code);
    }
    return student;
  };

  // --- SCANNER LOGIC ---
  const startScanner = () => {
    setScannedStudents([]);
    setActiveScannedStudent(null);
    setView('CAMERA');
  };

  const cancelScanner = () => {
    setScannedStudents([]);
    setActiveScannedStudent(null);
    setView('EVAL_MENU');
  };

  const handleScannerScan = async (codeResult: string) => {
    if (activeScannedStudent) return;
    const cleanCode = extractStudentCode(codeResult);
    if (!cleanCode) return;

    if (scannedStudents.some(s => s.student.student_code === cleanCode)) {
      vibrateError();
      return;
    }

    const student = await checkStudentLocalOrGlobal(cleanCode);
    if (student) {
      vibrateSuccess();
      setScannerPulse(true);
      setTimeout(() => setScannerPulse(false), 500);

      const attCount = await getAttendanceCount(student.id);
      
      const { data: ex } = await supabase.from("evaluations")
        .select("id, score, photo_url, created_at").eq("course_id", course.id).eq("student_id", student.id).eq("project_name", selectedProject?.name).maybeSingle();

      const existingScore = (ex && ex.score !== null && ex.score > 0) ? ex.score : null;

      const studentWithData = {
        student,
        attCount,
        score: existingScore,
        evalRecord: ex,
        isExisting: !!(ex && ex.score > 0)
      };

      setActiveScannedStudent(studentWithData);
    } else {
      vibrateError();
    }
  };

  const handleQuickGradeSelect = (score: number) => {
    if (!activeScannedStudent) return;
    vibrateSuccess();
    const updatedStudent = { ...activeScannedStudent, score };
    setScannedStudents(prev => [updatedStudent, ...prev]);
    setActiveScannedStudent(null);
  };

  const handleCancelActiveStudent = () => {
    setActiveScannedStudent(null);
  };

  const handleRemoveScannedStudent = (index: number) => {
    setScannedStudents(prev => prev.filter((_, i) => i !== index));
  };

  const handleBatchSaveEvaluations = async () => {
    if (!selectedProject || scannedStudents.length === 0) return;
    setSavingBatch(true);

    const evalInserts = scannedStudents.map(s => ({
      course_id: course.id,
      student_id: s.student.id,
      project_name: selectedProject.name,
      score: s.score !== null ? s.score : 0,
      teacher_id: course.teacher_id
    }));

    for (const s of scannedStudents) {
      const { data: existing } = await supabase.from("evaluations").select("id, score").eq("course_id", course.id).eq("student_id", s.student.id).eq("project_name", selectedProject.name).maybeSingle();
      if (existing) {
        if (existing.score !== (s.score !== null ? s.score : 0)) { await supabase.from("evaluations").update({ score: s.score !== null ? s.score : 0, created_at: new Date().toISOString() }).eq("id", existing.id); }
      } else {
        await supabase.from("evaluations").insert({
          course_id: course.id,
          student_id: s.student.id,
          project_name: selectedProject.name,
          score: s.score !== null ? s.score : 0,
          max_score: selectedProject.max_score,
          teacher_id: course.teacher_id
        });
      }
    }

    if (markAttendanceWithEval) {
      const today = new Date().toISOString().split('T')[0];
      const attInserts = scannedStudents.map(s => ({
        course_id: course.id,
        student_id: s.student.id,
        date: today,
        status: "حاضر",
        teacher_id: course.teacher_id
      }));
      for (const s of scannedStudents) {
        const { data: existingAtt } = await supabase.from("attendance").select("id, status").eq("course_id", course.id).eq("student_id", s.student.id).eq("date", today).maybeSingle();
        if (existingAtt) {
          if (existingAtt.status !== "حاضر") { await supabase.from("attendance").update({ status: "حاضر", created_at: new Date().toISOString() }).eq("id", existingAtt.id); }
        } else {
          await supabase.from("attendance").insert({
            course_id: course.id,
            student_id: s.student.id,
            date: today,
            status: "حاضر",
            teacher_id: course.teacher_id
          });
        }
      }
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
        .select("id, score, photo_url, created_at").eq("course_id", course.id).eq("student_id", student.id).eq("project_name", selectedProject?.name).maybeSingle();

      vibrateSuccess();
      const attCount = await getAttendanceCount(student.id);
      setTargetStudent({ ...student, attCount, evalRecord: ex });
      
      setManualScore(ex && ex.score && ex.score > 0 ? ex.score.toString() : "");
      
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

    // Send Telegram Notification
    fetch('/api/bot/notify_eval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: targetStudent.id,
        projectName: selectedProject.name,
        score: scoreNum,
        projectShowScore: selectedProject.show_score
      })
    });

    vibrateSuccess();
    setSearchInput("");
    setTargetStudent(null);
    setManualScore("");
    setSavingManual(false);
    fetchStats(course);
    
    document.getElementById("manualSearchInput")?.focus();
  };

  const handleManualScoreKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveManualEvaluation();
    }
  };

  // --- CANCEL / DELETE ARTWORK & RESET TELEGRAM ---
  const cancelArtwork = async (evalId: string) => {
    if (!confirm("هل أنت متأكد من إلغاء وحذف عمل هذا الطالب؟ سيتمكن الطالب من فتح الكاميرا وإعادة تصوير لوحته مجدداً.")) return;
    
    await supabase.from("evaluations").update({ photo_url: null, ai_status: null, score: 0 }).eq("id", evalId);
    alert("✅ تم إلغاء العمل وحذفه بنجاح. يمكن للطالب الآن إعادة الرفع.");
    if (targetStudent) {
      setTargetStudent({ ...targetStudent, evalRecord: null });
    }
    if (activeScannedStudent) {
      setActiveScannedStudent({ ...activeScannedStudent, evalRecord: null });
    }
    fetchStats(course);
  };

  const resetTelegramLink = async (studentId: string, studentName: string) => {
    if (!confirm(`هل أنت متأكد من إلغاء ربط تليجرام للطالب (${studentName})؟\nسيتيح هذا للطالب الحقيقي ربط حسابه الشرعي مجدداً.`)) return;
    
    await supabase.from("students").update({ telegram_id: null, telegram_username: null, telegram_first_name: null, telegram_browser_id: null }).eq("id", studentId);
    alert("✅ تم فك ربط حساب تليجرام بنجاح!");
    if (targetStudent) {
      setTargetStudent({ ...targetStudent, telegram_id: null });
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
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#121212" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#1e1e1e", borderBottom: "1px solid #333", direction: "rtl" }}>
        <button className="hide-on-mobile" onClick={() => {
          if (view === 'CAMERA') cancelScanner();
          else if (view === 'MANUAL') { setView('EVAL_MENU'); setTargetStudent(null); setSearchInput(""); }
          else if (view === 'EVAL_MENU') setView('PROJECTS');
          else router.push(`/course/${course?.id}`);
        }} style={{ width: "auto", padding: "4px 10px", margin: 0, background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer" }}>🡲</button>
        <h2 style={{ margin: 0, color: "#FF9800", fontSize: "17px", fontWeight: "bold" }}>بوابة التقييم</h2>
        <div style={{ width: "24px" }}></div>
      </div>

      <div style={{ padding: "14px", direction: "rtl", flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        
        {/* PROJECTS LIST VIEW */}
        {view === 'PROJECTS' && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ color: "#FF9800", margin: 0, fontSize: "16px" }}>المشاريع المتاحة للتقييم</h3>
              <button onClick={() => setShowAddProjectModal(true)} style={{ width: "auto", margin: 0, background: "#4CAF50", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "8px", fontWeight: "bold", fontSize: "13px" }}>➕ إضافة مشروع</button>
            </div>

            {projects.filter(p => !p.is_archived).length === 0 ? (
              <div style={{ textAlign: "center", padding: "35px", color: "#666", background: "#1e1e1e", borderRadius: "14px", border: "1px dashed #444", fontSize: "14px" }}>
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
                      style={{ background: "#1e1e1e", padding: "14px 16px", borderRadius: "12px", border: "1px solid #333", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1, pointerEvents: "none" }}>
                        <div style={{ color: "#90CAF9", fontWeight: "bold", fontSize: "16px", marginBottom: "6px" }}>{proj.name} <span style={{ color: "#888", fontSize: "13px", fontWeight: "normal" }}>({proj.max_score} درجة)</span></div>
                        <div style={{ display: "flex", gap: "10px", fontSize: "11px", opacity: 0.9, flexWrap: "wrap" }}>
                          <span style={{ color: "#81C784" }}>✅ مقيّم: {graded}</span>
                          <span style={{ color: "#E57373" }}>⏳ متبقي: {ungraded}</span>
                          <span style={{ color: "#B0BEC5" }}>👥 الإجمالي: {totalCourseStudents}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button 
                          onClick={(e) => openProjectStats(proj, e)}
                          title="إحصائية المشروع وتصدير كشف المتأخرين PDF"
                          style={{ width: "auto", margin: 0, background: "rgba(33, 150, 243, 0.15)", color: "#2196F3", border: "1px solid #2196F3", borderRadius: "8px", padding: "6px 10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}
                        >
                          📊 إحصائية
                        </button>
                        <div style={{ color: "#fff", fontSize: "18px" }}>🡰</div>
                      </div>
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
            <div style={{ background: "#222", padding: "16px", borderRadius: "12px", marginBottom: "24px", border: "1px solid #4CAF50" }}>
              <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "4px" }}>المشروع المحدد:</div>
              <div style={{ color: "#81C784", fontWeight: "bold", fontSize: "20px", marginBottom: "14px", textAlign: "center" }}>{selectedProject.name} <span style={{ color: "#888", fontSize: "14px", fontWeight: "normal" }}>({selectedProject.max_score} درجة)</span></div>
              
              <div style={{ display: "flex", justifyContent: "space-around", background: "#161616", padding: "12px", borderRadius: "8px", fontSize: "11px" }}>
                 <div style={{ textAlign: "center" }}><div style={{ color: "#81C784", fontSize: "18px", fontWeight: "bold" }}>{projectStats[selectedProject.name] || 0}</div><div style={{ color: "#888", marginTop: "4px" }}>مقيّم ✅</div></div>
                 <div style={{ width: "1px", background: "#333" }}></div>
                 <div style={{ textAlign: "center" }}><div style={{ color: "#E57373", fontSize: "18px", fontWeight: "bold" }}>{totalCourseStudents - (projectStats[selectedProject.name] || 0)}</div><div style={{ color: "#888", marginTop: "4px" }}>متبقي ⏳</div></div>
                 <div style={{ width: "1px", background: "#333" }}></div>
                 <div style={{ textAlign: "center" }}><div style={{ color: "#90CAF9", fontSize: "18px", fontWeight: "bold" }}>{totalCourseStudents}</div><div style={{ color: "#888", marginTop: "4px" }}>الإجمالي 👥</div></div>
              </div>
            </div>

            <h3 style={{ color: "#FF9800", marginBottom: "20px", fontSize: "16px" }}>⭐ اختر طريقة التقييم</h3>
            <button onClick={startScanner} style={{ width: "100%", margin: "0 0 12px 0", background: "#4CAF50", color: "#fff", padding: "16px", borderRadius: "12px", fontSize: "16px", fontWeight: "bold", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>📱</span> التقييم الذكي (بالكاميرا والمطابقة)
            </button>
            <button onClick={() => setView('MANUAL')} style={{ width: "100%", margin: "0 0 12px 0", background: "#2196F3", color: "#fff", padding: "16px", borderRadius: "12px", fontSize: "16px", fontWeight: "bold", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>📝</span> التقييم اليدوي ومراجعة اللوحات
            </button>
          </div>
        )}

        {/* MANUAL EVALUATION VIEW */}
        {view === 'MANUAL' && (
          <div style={{ background: "#1e1e1e", padding: "14px", borderRadius: "12px", border: "1px solid #333", flexGrow: 1, display: "flex", flexDirection: "column" }}>
            
            <div style={{ marginBottom: "14px" }}>
              <label style={{ color: "#aaa", fontSize: "11px", display: "block", marginBottom: "4px" }}>المشروع الحالي:</label>
              <select value={selectedProject?.id || ""} onChange={e => {
                if (e.target.value === "ADD_NEW") setShowAddProjectModal(true);
                else {
                  const p = projects.find(x => x.id === e.target.value);
                  if (p) setSelectedProject(p);
                }
              }} style={{ width: "100%", padding: "10px", background: "#222", border: "1px solid #444", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none" }}>
                {projects.filter(p => !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.name} (Max {p.max_score})</option>)}
                <option value="ADD_NEW" style={{ color: "#4CAF50" }}>➕ إضافة مشروع جديد...</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <input 
                id="manualSearchInput"
                type="text" 
                inputMode="numeric"
                placeholder="أدخل كود الطالب..." 
                value={searchInput} 
                onChange={e => setSearchInput(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') handleManualSearch(); }}
                style={{ flex: 1, padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "8px", color: "#fff", fontSize: "16px", textAlign: "center", outline: "none" }} 
              />
              <button onClick={handleManualSearch} disabled={searchingManual} style={{ width: "auto", margin: 0, background: "#2196F3", color: "#fff", border: "none", padding: "0 20px", borderRadius: "8px", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}>
                {searchingManual ? "..." : "بحث"}
              </button>
            </div>

            {targetStudent && selectedProject && (
              <div style={{ background: "#151e15", padding: "14px", borderRadius: "12px", border: "2px solid #4CAF50", animation: "slideUp 0.25s" }}>
                
                {/* Student Full Info Header with Absolute Close Button */}
                <div style={{ position: "relative", marginBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px" }}>
                  <button 
                    onClick={() => { setTargetStudent(null); setSearchInput(""); }} 
                    title="إغلاق بطاقة الطالب"
                    style={{ 
                      position: "absolute", 
                      top: "0", 
                      left: "0", 
                      width: "28px", 
                      height: "28px", 
                      padding: "0", 
                      margin: "0", 
                      background: "rgba(244,67,54,0.2)", 
                      color: "#f44336", 
                      border: "1px solid #f44336", 
                      borderRadius: "50%", 
                      fontSize: "13px", 
                      fontWeight: "bold", 
                      cursor: "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      zIndex: 5
                    }}
                  >✕</button>

                  <div style={{ paddingLeft: "35px" }}>
                    <div style={{ color: "#fff", fontWeight: "bold", fontSize: "16px", marginBottom: "4px", lineHeight: "1.3" }}>{targetStudent.full_name}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: "#2196F3", color: "#fff", borderRadius: "5px", padding: "2px 6px", fontSize: "11px", fontWeight: "bold" }}>كود: {targetStudent.student_code}</span>
                      <span style={{ background: "#333", color: "#ddd", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}>س: {targetStudent.section}</span>
                      <span style={{ background: "#FF9800", color: "#fff", borderRadius: "5px", padding: "2px 6px", fontSize: "11px", fontWeight: "bold" }}>حضور: {targetStudent.attCount}</span>
                      {targetStudent.evalRecord?.score > 0 && (
                        <span style={{ background: "#4CAF50", color: "#000", borderRadius: "5px", padding: "2px 6px", fontSize: "11px", fontWeight: "bold" }}>رُصد: {targetStudent.evalRecord.score}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* BOT UPLOAD STATUS & ARTWORK PREVIEW */}
                <div style={{ background: "#111", border: "1px solid #333", borderRadius: "8px", padding: "10px", marginBottom: "12px" }}>
                  {targetStudent.evalRecord?.photo_url ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "4px" }}>
                        <span style={{ color: "#4CAF50", fontSize: "12px", fontWeight: "bold" }}>
                          ✅ تم رفع العمل عبر البوت
                        </span>
                        <span style={{ color: "#888", fontSize: "11px" }}>
                          ⏱️ {formatRelativeTimeArabic(targetStudent.evalRecord.created_at)}
                        </span>
                      </div>

                      <div 
                        onClick={() => openZoomImage(targetStudent.evalRecord.photo_url)}
                        style={{ position: "relative", width: "100%", height: "160px", background: "#000", borderRadius: "8px", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333" }}
                      >
                        <img src={targetStudent.evalRecord.photo_url} alt="Artwork" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                        <div style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(0,0,0,0.8)", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold" }}>
                          🔍 تكبير ومعاينة
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", gap: "8px" }}>
                        <button 
                          onClick={() => cancelArtwork(targetStudent.evalRecord.id)}
                          style={{ width: "auto", margin: 0, background: "rgba(244, 67, 54, 0.15)", color: "#f44336", border: "1px solid #f44336", padding: "6px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", flex: 1 }}
                        >
                          🗑️ إلغاء واعتماد إعادة الرفع
                        </button>
                        
                        {targetStudent.telegram_id && (
                          <button 
                            onClick={() => resetTelegramLink(targetStudent.id, targetStudent.full_name)}
                            style={{ width: "auto", margin: 0, background: "rgba(255, 152, 0, 0.15)", color: "#ff9800", border: "1px solid #ff9800", padding: "6px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                          >
                            🔓 فك تليجرام
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "8px 0", color: "#aaa", fontSize: "12px" }}>
                      ⏳ لم يقم الطالب برفع صورة لهذا المشروع عبر البوت بعد.
                    </div>
                  )}
                </div>
                
                {/* 0 TO MAX_SCORE QUICK GRADE GRID */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", color: "#aaa", fontSize: "11px", marginBottom: "6px" }}>اضغط لتحديد الدرجة (0 إلى {selectedProject.max_score}):</label>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))",
                    gap: "6px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    padding: "2px"
                  }}>
                    {getQuickGrades(selectedProject.max_score).map(score => (
                      <button
                        key={score}
                        onClick={() => setManualScore(score.toString())}
                        style={{
                          width: "100%",
                          margin: 0,
                          padding: 0,
                          height: "38px",
                          background: manualScore === score.toString() ? "#4CAF50" : "#222",
                          color: manualScore === score.toString() ? "#000" : "#fff",
                          border: manualScore === score.toString() ? "2px solid #fff" : "1px solid #444",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: "bold",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grade Input & Save */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "#111", padding: "8px 12px", borderRadius: "8px", marginBottom: "12px" }}>
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
                    style={{ flex: 1, padding: "8px", background: "#1e1e1e", border: "2px solid #4CAF50", borderRadius: "6px", color: "#fff", fontSize: "18px", textAlign: "center", outline: "none", fontWeight: "bold" }} 
                  />
                  <span style={{ fontSize: "16px", color: "#aaa", fontWeight: "bold" }}>من {selectedProject.max_score}</span>
                </div>

                <button onClick={saveManualEvaluation} disabled={savingManual} style={{ width: "100%", margin: 0, background: "#4CAF50", color: "#fff", padding: "14px", borderRadius: "10px", border: "none", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>
                  {savingManual ? "جاري الحفظ..." : "💾 حفظ التقييم والانتقال للبحث ↵"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CAMERA SCANNER VIEW */}
        {view === 'CAMERA' && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e1e1e", padding: "8px 12px", borderRadius: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold" }}>📝 إضافة حضور مع التقييم</span>
              <label style={{ position: "relative", display: "inline-block", width: "42px", height: "22px" }}>
                <input type="checkbox" checked={markAttendanceWithEval} onChange={e => setMarkAttendanceWithEval(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: markAttendanceWithEval ? "#4CAF50" : "#555", borderRadius: "22px", transition: "0.3s" }}>
                  <span style={{ position: "absolute", content: '""', height: "16px", width: "16px", left: "3px", bottom: "3px", backgroundColor: "white", borderRadius: "50%", transition: "0.3s", transform: markAttendanceWithEval ? "translateX(20px)" : "none" }}></span>
                </span>
              </label>
            </div>

            <select value={selectedProject?.id || ""} onChange={e => {
                if (e.target.value === "ADD_NEW") setShowAddProjectModal(true);
                else {
                  const p = projects.find(x => x.id === e.target.value);
                  if (p) setSelectedProject(p);
                }
              }} style={{ width: "100%", padding: "10px", background: "#1e1e1e", border: "1px solid #444", borderRadius: "8px", color: "#fff", marginBottom: "8px", fontSize: "14px", outline: "none" }}>
                {projects.filter(p => !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.name} (Max {p.max_score})</option>)}
                <option value="ADD_NEW" style={{ color: "#4CAF50" }}>➕ إضافة مشروع جديد...</option>
            </select>

            {/* CAMERA SECTION - ONLY SHOW WHEN NOT GRADING */}
            {!activeScannedStudent && (
              <div style={{ background: "black", borderRadius: "10px", overflow: "hidden", position: "relative", height: "260px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <QRScanner onScan={(result) => { if (result) handleScannerScan(result); }} />
                
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "200px", height: "200px", border: "3px solid", borderColor: scannerPulse ? "#81C784" : "rgba(76, 175, 80, 0.7)", borderRadius: "16px", pointerEvents: "none", boxShadow: scannerPulse ? "0 0 15px #81C784, 0 0 0 4000px rgba(0,0,0,0.5)" : "0 0 0 4000px rgba(0,0,0,0.5)", transition: "all 0.2s" }}></div>
                <div style={{ position: "absolute", bottom: "8px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "4px 12px", borderRadius: "12px", fontSize: "11px", zIndex: 10 }}>وجه الكاميرا داخل الإطار الأخضر</div>
              </div>
            )}

            {/* EXPANDED GRADE PANEL FOR SCANNED STUDENT */}
            {activeScannedStudent && selectedProject && (
              <div style={{ background: "#151e15", border: "2px solid #4CAF50", padding: "14px", borderRadius: "12px", marginTop: "6px", animation: "slideUp 0.2s" }}>
                
                {/* Student Info Header with Absolute Close Button */}
                <div style={{ position: "relative", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "6px" }}>
                  <button 
                    onClick={handleCancelActiveStudent} 
                    title="إلغاء الطالب الحالي"
                    style={{ 
                      position: "absolute", 
                      top: "0", 
                      left: "0", 
                      width: "28px", 
                      height: "28px", 
                      padding: "0", 
                      margin: "0", 
                      background: "rgba(244,67,54,0.2)", 
                      color: "#f44336", 
                      border: "1px solid #f44336", 
                      borderRadius: "50%", 
                      fontSize: "13px", 
                      fontWeight: "bold", 
                      cursor: "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      zIndex: 5
                    }}
                  >✕</button>

                  <div style={{ paddingLeft: "35px" }}>
                    <div style={{ color: "#4CAF50", fontWeight: "bold", fontSize: "16px", marginBottom: "2px", lineHeight: "1.3" }}>{activeScannedStudent.student.full_name}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: "#2196F3", color: "#fff", borderRadius: "5px", padding: "2px 6px", fontSize: "11px", fontWeight: "bold" }}>كود: {activeScannedStudent.student.student_code}</span>
                      <span style={{ background: "#333", color: "#ddd", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}>س: {activeScannedStudent.student.section}</span>
                      <span style={{ background: "#FF9800", color: "#fff", borderRadius: "5px", padding: "2px 6px", fontSize: "11px", fontWeight: "bold" }}>حضور: {activeScannedStudent.attCount}</span>
                      <span style={{ background: "#555", color: "#fff", borderRadius: "5px", padding: "2px 6px", fontSize: "11px" }}>Max: {selectedProject.max_score}</span>
                    </div>
                  </div>
                </div>

                {/* BOT UPLOAD STATUS & ARTWORK PREVIEW */}
                <div style={{ background: "#111", border: "1px solid #333", borderRadius: "8px", padding: "8px 12px", marginBottom: "10px" }}>
                  {activeScannedStudent.evalRecord?.photo_url ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "#4CAF50", fontSize: "12px", fontWeight: "bold" }}>
                          ✅ تم رفع العمل عبر البوت
                        </div>
                        <div style={{ color: "#888", fontSize: "10px", marginTop: "2px" }}>
                          ⏱️ {formatRelativeTimeArabic(activeScannedStudent.evalRecord.created_at)}
                        </div>
                      </div>
                      <button 
                        onClick={() => openZoomImage(activeScannedStudent.evalRecord.photo_url)}
                        style={{ width: "auto", margin: 0, background: "#2196F3", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        🖼️ معاينة وتكبير
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: "#aaa", fontSize: "11px", textAlign: "center" }}>
                      ⏳ لم يقم الطالب برفع صورة لهذا المشروع بعد.
                    </div>
                  )}
                </div>

                {/* 0 TO MAX_SCORE QUICK GRADE GRID */}
                <div style={{ marginBottom: "4px" }}>
                  <label style={{ display: "block", color: "#aaa", fontSize: "11px", marginBottom: "4px" }}>اضغط لتحديد الدرجة (0 إلى {selectedProject.max_score}):</label>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))",
                    gap: "6px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    padding: "2px"
                  }}>
                    {getQuickGrades(selectedProject.max_score).map(score => (
                      <button
                        key={score}
                        onClick={() => handleQuickGradeSelect(score)}
                        style={{
                          width: "100%",
                          margin: 0,
                          padding: 0,
                          height: "38px",
                          background: activeScannedStudent.score === score ? "#4CAF50" : "#222",
                          color: activeScannedStudent.score === score ? "#000" : "#fff",
                          border: activeScannedStudent.score === score ? "2px solid #fff" : "1px solid #4CAF50",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: "bold",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SCANNED BATCH LIST */}
            {scannedStudents.length > 0 && !activeScannedStudent && (
              <div style={{ marginTop: "12px", flexGrow: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ color: "#FF9800", fontWeight: "bold", fontSize: "13px" }}>📋 المسجلين بالجلسة ({scannedStudents.length})</span>
                  <button onClick={handleBatchSaveEvaluations} disabled={savingBatch} style={{ width: "auto", margin: 0, background: "#4CAF50", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>
                    {savingBatch ? "جاري الحفظ..." : `💾 حفظ الكل (${scannedStudents.length})`}
                  </button>
                </div>

                <div style={{ flexGrow: 1, overflowY: "auto", maxHeight: "200px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {scannedStudents.map((s, idx) => (
                    <div key={idx} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: "6px", padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "#fff", fontWeight: "bold", fontSize: "12px" }}>{s.student.full_name}</div>
                        <div style={{ color: "#888", fontSize: "10px" }}>كود: {s.student.student_code} • س: {s.student.section}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ background: "#4CAF50", color: "#000", fontWeight: "bold", padding: "3px 6px", borderRadius: "5px", fontSize: "12px" }}>{s.score ?? 0}</span>
                        <button onClick={() => handleRemoveScannedStudent(idx)} style={{ width: "auto", margin: 0, background: "none", border: "none", color: "#f44336", fontSize: "14px", cursor: "pointer", padding: "0 4px" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PROJECT STATS MODAL */}
      {statsProject && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#1e1e1e", width: "95%", maxWidth: "550px", maxHeight: "90vh", display: "flex", flexDirection: "column", borderRadius: "15px", border: "1px solid #2196F3", direction: "rtl", padding: "16px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "10px", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, color: "#2196F3", fontSize: "16px" }}>📊 إحصائيات مشروع: {statsProject.name}</h3>
              <button onClick={() => { setStatsProject(null); setStatsData(null); }} style={{ width: "auto", margin: 0, background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>

            {loadingStatsModal ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#aaa" }}>جاري تحميل الإحصائيات...</div>
            ) : statsData ? (
              <div style={{ overflowY: "auto", flexGrow: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px", textAlign: "center" }}>
                  <div style={{ background: "#121212", border: "1px solid #333", borderRadius: "8px", padding: "8px" }}>
                    <div style={{ color: "#888", fontSize: "10px" }}>المطلوب منهم</div>
                    <div style={{ color: "#90caf9", fontSize: "18px", fontWeight: "bold" }}>{statsData.submitted.length + statsData.missing.length}</div>
                  </div>
                  <div style={{ background: "#121212", border: "1px solid #4CAF50", borderRadius: "8px", padding: "8px" }}>
                    <div style={{ color: "#888", fontSize: "10px" }}>قاموا بالرفع ✅</div>
                    <div style={{ color: "#4CAF50", fontSize: "18px", fontWeight: "bold" }}>{statsData.submitted.length}</div>
                  </div>
                  <div style={{ background: "#121212", border: "1px solid #f44336", borderRadius: "8px", padding: "8px" }}>
                    <div style={{ color: "#888", fontSize: "10px" }}>متأخرين ❌</div>
                    <div style={{ color: "#f44336", fontSize: "18px", fontWeight: "bold" }}>{statsData.missing.length}</div>
                  </div>
                </div>

                {statsData.missing.length > 0 && (
                  <button 
                    onClick={() => exportMissingStudentsPdf(statsProject, statsData.missing)}
                    style={{ width: "100%", margin: "0 0 12px 0", background: "#e53935", color: "#fff", border: "none", padding: "10px", borderRadius: "8px", fontWeight: "bold", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    🖨️ طباعة / تصدير كشف المتأخرين (PDF)
                  </button>
                )}

                <h4 style={{ color: "#f44336", margin: "8px 0 6px 0", fontSize: "13px" }}>قائمة الطلاب المتأخرين ({statsData.missing.length}):</h4>
                <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {statsData.missing.map((s, idx) => (
                    <div key={idx} style={{ background: "#121212", border: "1px solid #333", borderRadius: "6px", padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                      <div>
                        <span style={{ color: "#fff", fontWeight: "bold" }}>{idx + 1}. {s.full_name}</span>
                        <span style={{ color: "#888", fontSize: "10px", marginRight: "6px" }}>كود: {s.student_code} • س: {s.section}</span>
                      </div>
                      <span style={{ color: "#f44336", fontSize: "10px", fontWeight: "bold" }}>لم يرفع</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* IMAGE ZOOM MODAL (WITH SAFE POPSTATE / BACK BUTTON) */}
      {zoomImage && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.95)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <button onClick={closeZoomImage} style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: "20px", width: "40px", height: "40px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: 0, padding: 0 }}>✕</button>
          <img src={zoomImage} alt="Zoomed Artwork" style={{ maxWidth: "95%", maxHeight: "85%", objectFit: "contain", borderRadius: "8px" }} />
          <div style={{ color: "#aaa", fontSize: "12px", marginTop: "10px" }}>اضغط (✕) أو زر الرجوع بالهاتف للعودة للتقييم</div>
        </div>
      )}

      {/* ADD PROJECT MODAL */}
      {showAddProjectModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#1e1e1e", width: "90%", maxWidth: "350px", padding: "16px", borderRadius: "12px", border: "1px solid #333", direction: "rtl" }}>
            <h3 style={{ color: "#FF9800", marginTop: 0, fontSize: "16px" }}>➕ إضافة مشروع جديد</h3>
            
            <label style={{ display: "block", color: "#aaa", fontSize: "11px", marginBottom: "4px", textAlign: "right" }}>اسم المشروع:</label>
            <input 
              type="text" 
              placeholder="مثال: لوحة الطبيعة الصامتة" 
              value={newProjectName} 
              onChange={e => setNewProjectName(e.target.value)}
              style={{ width: "100%", padding: "10px", background: "#121212", border: "1px solid #444", borderRadius: "6px", color: "#fff", marginBottom: "12px", textAlign: "right" }}
            />
            
            <label style={{ display: "block", color: "#aaa", fontSize: "11px", marginBottom: "4px", textAlign: "right" }}>الدرجة القصوى للمشروع:</label>
            <input 
              type="number" 
              inputMode="decimal"
              placeholder="50" 
              value={newProjectMaxScore} 
              onChange={e => setNewProjectMaxScore(e.target.value)}
              style={{ width: "100%", padding: "10px", background: "#121212", border: "1px solid #444", borderRadius: "6px", color: "#fff", marginBottom: "16px", textAlign: "center", fontSize: "16px" }}
            />

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={saveNewProject} style={{ flex: 1, margin: 0, background: "#4CAF50", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px" }}>حفظ المشروع</button>
              <button onClick={() => setShowAddProjectModal(false)} style={{ flex: 1, margin: 0, background: "transparent", color: "#fff", border: "1px solid #555", padding: "10px", borderRadius: "6px", fontSize: "13px" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* EASTER EGG MODAL */}
      {showEasterEgg && easterEggData && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 999, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px", borderBottom: "2px solid #0f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0a0a0a" }}>
            <h1 style={{ color: "#0f0", margin: 0, fontFamily: "monospace", fontSize: "18px" }}>// CLASSIFIED_REPORT</h1>
            <button onClick={() => setShowEasterEgg(false)} style={{ width: "auto", margin: 0, background: "none", border: "none", color: "#0f0", fontSize: "22px", cursor: "pointer" }}>✖</button>
          </div>
          <div style={{ position: "relative", flexGrow: 1, overflowY: "auto", padding: "16px", direction: "rtl", color: "#0f0", fontFamily: "monospace" }}>
            <div style={{ border: "1px dashed #0f0", padding: "12px", marginBottom: "16px" }}>
              <div style={{ opacity: 0.7 }}>[TARGET_IDENTIFIED]</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: "8px" }}>{easterEggData.student.full_name}</div>
              <div>ID_CODE: {easterEggData.student.student_code}</div>
              <div>SECTION: {easterEggData.student.section}</div>
            </div>
            <div style={{ border: "1px dashed #0f0", padding: "12px", marginBottom: "16px" }}>
              <div style={{ opacity: 0.7 }}>[ATTENDANCE_METRICS]</div>
              <div style={{ fontSize: "24px", margin: "8px 0" }}>{easterEggData.attendanceCount} Weeks Present</div>
            </div>
            <div style={{ border: "1px dashed #0f0", padding: "12px" }}>
              <div style={{ opacity: 0.7, marginBottom: "12px" }}>[EVALUATION_RECORDS]</div>
              {easterEggData.evaluations.map((ev: any) => (
                <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(0,255,0,0.2)", padding: "8px 0" }}>
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
          <div style={{ background: "#1e1e1e", width: "90%", maxWidth: "350px", padding: "16px", borderRadius: "12px", border: "1px solid #2196F3", direction: "rtl", textAlign: "center" }}>
            <h3 style={{ color: "#2196F3", marginTop: 0, fontSize: "16px" }}>⚙️ إدارة المشروع</h3>
            
            <input 
              type="text" 
              value={editProjectName} 
              onChange={e => setEditProjectName(e.target.value)}
              style={{ width: "100%", padding: "10px", background: "#121212", border: "1px solid #444", borderRadius: "6px", color: "#fff", marginBottom: "12px", textAlign: "right" }}
            />
            
            <label style={{ display: "block", color: "#aaa", fontSize: "11px", marginBottom: "4px", textAlign: "right" }}>الدرجة القصوى للمشروع:</label>
            <input 
              type="number" 
              inputMode="decimal"
              value={editProjectMaxScore} 
              onChange={e => setEditProjectMaxScore(e.target.value)}
              style={{ width: "100%", padding: "10px", background: "#121212", border: "1px solid #444", borderRadius: "6px", color: "#fff", marginBottom: "16px", textAlign: "center", fontSize: "16px" }}
            />

            <div style={{ background: "#2a2a2a", borderRadius: "8px", padding: "10px", marginBottom: "16px", textAlign: "right" }}>
              <button 
                onClick={() => setShowTelegramSettings(!showTelegramSettings)}
                style={{ width: "100%", background: "none", border: "none", color: "#2196F3", fontWeight: "bold", fontSize: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: 0 }}
              >
                <span>✈️ إعدادات التليجرام للطالب</span>
                <span>{showTelegramSettings ? "▲" : "▼"}</span>
              </button>
              
              {showTelegramSettings && (
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "13px", cursor: "pointer" }}>
                    <input type="checkbox" checked={editProjectIsActive} onChange={e => setEditProjectIsActive(e.target.checked)} />
                    تفعيل استقبال المشروع عبر البوت
                  </label>
                  
                  {editProjectIsActive && (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div>
                          <label style={{ display: "block", color: "#aaa", fontSize: "11px", marginBottom: "4px" }}>من تاريخ:</label>
                          <input type="datetime-local" value={editProjectStartDate} onChange={e => setEditProjectStartDate(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px", background: "#121212", border: "1px solid #444", borderRadius: "4px", color: "#fff", fontSize: "12px", fontFamily: "inherit" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", color: "#aaa", fontSize: "11px", marginBottom: "4px" }}>إلى تاريخ:</label>
                          <input type="datetime-local" value={editProjectEndDate} onChange={e => setEditProjectEndDate(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px", background: "#121212", border: "1px solid #444", borderRadius: "4px", color: "#fff", fontSize: "12px", fontFamily: "inherit" }} />
                        </div>
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "13px", cursor: "pointer", marginTop: "4px" }}>
                        <input type="checkbox" checked={editProjectShowScore} onChange={e => setEditProjectShowScore(e.target.checked)} />
                        عرض وإرسال الدرجة للطالب فور تقييمه
                      </label>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                        <label style={{ color: "#aaa", fontSize: "12px" }}>وضع الكاميرا:</label>
                        <select 
                          value={editProjectCameraMode} 
                          onChange={(e: any) => setEditProjectCameraMode(e.target.value)}
                          style={{ padding: "6px", background: "#121212", border: "1px solid #444", borderRadius: "4px", color: "#fff", fontSize: "12px" }}
                        >
                          <option value="2d">مسطح (2D)</option>
                          <option value="3d">مجسم (3D)</option>
                        </select>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                        <label style={{ color: "#aaa", fontSize: "12px" }}>عدد الصور المطلوبة:</label>
                        <select 
                          value={editProjectRequiredPhotos} 
                          onChange={(e: any) => setEditProjectRequiredPhotos(Number(e.target.value))}
                          style={{ padding: "6px", background: "#121212", border: "1px solid #444", borderRadius: "4px", color: "#fff", fontSize: "12px" }}
                        >
                          <option value={1}>صورة واحدة</option>
                          <option value={2}>صورتان</option>
                          <option value={3}>3 صور</option>
                        </select>
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ffeb3b", fontSize: "13px", cursor: "pointer", marginTop: "4px", borderTop: "1px solid #444", paddingTop: "8px" }}>
                        <input type="checkbox" checked={sendBroadcastOnSave} onChange={e => setSendBroadcastOnSave(e.target.checked)} />
                        إرسال إشعار فوري للطلاب بفتح المشروع
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button onClick={updateProject} style={{ width: "100%", margin: 0, background: "#2196F3", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px" }}>حفظ التعديلات</button>
              <button onClick={() => { if(confirm("هل أنت متأكد من نقل هذا المشروع للأرشيف؟ لن يظهر في القائمة بعد الآن.")) archiveProject(); }} style={{ width: "100%", margin: 0, background: "#F44336", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", fontWeight: "bold", fontSize: "13px" }}>أرشفة المشروع</button>
              <button onClick={() => setShowManageProjectModal(false)} style={{ width: "100%", margin: 0, background: "transparent", color: "#fff", border: "1px solid #555", padding: "10px", borderRadius: "6px", fontSize: "13px" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
