"use client";

async function fetchAllSupabaseRows(fetchPage: (from: number, to: number) => any) {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const res = await fetchPage(from, from + pageSize - 1);
    const data = (res as any)?.data;
    if ((res as any)?.error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

import { useEffect, useState, use, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Image as ImageIcon,
  Maximize2,
  Palette,
  Plus,
  Printer,
  Repeat,
  Save,
  Settings,
  Smartphone,
  Star,
  Tag,
  Trash2,
  Users,
  X,
  XCircle
} from "lucide-react";
import { supabase } from "@/lib/core/supabase";
import { addToQueue, getLocalCache, setLocalCache } from "@/lib/admin/syncEngine";
const QRScanner = dynamic(() => import("@/components/scanner/QRScanner"), { ssr: false, loading: () => <div style={{padding: "20px", textAlign: "center"}}>جاري تحميل الكاميرا...</div> });
import { extractStudentCode, getStudentCodeVariants, buildStudentCodeFilter, normalizeAcademicYear } from "@/lib/students/codeHelper";
import { playScanClickSound, playScanErrorSound, playScanAlreadyEvaluatedSound } from "@/lib/courses/audioHelper";
import { getStudentTag, setStudentTag } from "@/lib/students/studentTagsHelper";



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
  portal_enabled?: boolean;
  start_date?: string;
  end_date?: string;
  submission_deadline?: string;
  show_score?: boolean;
  camera_mode?: '2d' | '3d';
  required_photos?: number;
  multi_stage_enabled?: boolean;
  stage1_title?: string;
  stage1_deadline?: string;
  stage2_title?: string;
  stage2_deadline?: string;
};

export default function EvaluationsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  
  const initialEvalCache = typeof window !== 'undefined'
    ? getLocalCache(`cache_evaluations_${resolvedParams.id}`)
    : null;

  const fallbackEvalCourse = !initialEvalCache?.course && typeof window !== 'undefined'
    ? (() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("cached_courses_")) {
              const list = JSON.parse(localStorage.getItem(k) || "[]");
              const found = list.find((c: any) => c.id === resolvedParams.id);
              if (found) return found;
            }
          }
        } catch(e) {}
        return null;
      })()
    : null;

  const currentEvalCourse = initialEvalCache?.course || fallbackEvalCourse;

  const [course, setCourse] = useState<any>(() => currentEvalCourse);
  const [projects, setProjects] = useState<Project[]>(() => {
    if (initialEvalCache?.projects && initialEvalCache.projects.length > 0) return initialEvalCache.projects;
    const p = (currentEvalCourse?.custom_week_names as any)?.__projects__ || [];
    return p.filter((x: any) => !x.is_archived);
  });
  const [systemTerms, setSystemTerms] = useState<any>(() => initialEvalCache?.systemTerms || getLocalCache("cached_system_settings") || null);
  const [totalCourseStudents, setTotalCourseStudents] = useState<number>(() => initialEvalCache?.totalCourseStudents || 0);
  const [projectStats, setProjectStats] = useState<any>(() => initialEvalCache?.projectStats || {});
  const [projectStatsBySection, setProjectStatsBySection] = useState<Record<string, Record<string, number>>>(() => initialEvalCache?.projectStatsBySection || {});
  const [studentsCountBySection, setStudentsCountBySection] = useState<Record<string, number>>(() => initialEvalCache?.studentsCountBySection || {});
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("ALL");
  const [statsModalTab, setStatsModalTab] = useState<'submitted' | 'missing'>('submitted');
  const [statsModalSectionFilter, setStatsModalSectionFilter] = useState<string>("ALL");
  const [statsSearchQuery, setStatsSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(() => !currentEvalCourse);

  useEffect(() => {
    const cached = getLocalCache(`cache_evaluations_${resolvedParams.id}`);
    if (cached) {
      if (cached.course) setCourse(cached.course);
      if (cached.projects) setProjects(cached.projects);
      if (cached.totalCourseStudents) setTotalCourseStudents(cached.totalCourseStudents);
      if (cached.projectStats) setProjectStats(cached.projectStats);
      if (cached.projectStatsBySection) setProjectStatsBySection(cached.projectStatsBySection);
      if (cached.studentsCountBySection) setStudentsCountBySection(cached.studentsCountBySection);
      setLoading(false); // Instant render 0ms!
    }
  }, [resolvedParams.id]);


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

  // Selected project state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // View states
  const [view, setView] = useState<'PROJECTS' | 'EVAL_MENU' | 'MANUAL' | 'CAMERA'>('PROJECTS');
  
  // Modals
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectMaxScore, setNewProjectMaxScore] = useState("50");
  const [newProjectPortalEnabled, setNewProjectPortalEnabled] = useState(true);
  const [newProjectCameraMode, setNewProjectCameraMode] = useState<'2d'|'3d'>('2d');
  const [newProjectRequiredPhotos, setNewProjectRequiredPhotos] = useState<number>(1);
  const [newProjectDeadline, setNewProjectDeadline] = useState("");
  const [newProjectMultiStage, setNewProjectMultiStage] = useState(false);
  const [newProjectStage1Title, setNewProjectStage1Title] = useState("مرحلة التجهيز والتحضير");
  const [newProjectStage1Deadline, setNewProjectStage1Deadline] = useState("");
  const [newProjectStage2Title, setNewProjectStage2Title] = useState("العمل النهائي المكتمل");
  const [newProjectStage2Deadline, setNewProjectStage2Deadline] = useState("");

  const [showManageProjectModal, setShowManageProjectModal] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectMaxScore, setEditProjectMaxScore] = useState("");
  const [editProjectPortalEnabled, setEditProjectPortalEnabled] = useState(true);
  const [editProjectDeadline, setEditProjectDeadline] = useState("");
  const [editProjectCameraMode, setEditProjectCameraMode] = useState<'2d'|'3d'>('2d');
  const [editProjectRequiredPhotos, setEditProjectRequiredPhotos] = useState<number>(1);
  const [editProjectMultiStage, setEditProjectMultiStage] = useState(false);
  const [editProjectStage1Title, setEditProjectStage1Title] = useState("مرحلة التجهيز والتحضير");
  const [editProjectStage1Deadline, setEditProjectStage1Deadline] = useState("");
  const [editProjectStage2Title, setEditProjectStage2Title] = useState("العمل النهائي المكتمل");
  const [editProjectStage2Deadline, setEditProjectStage2Deadline] = useState("");
  const [showTelegramSettings, setShowTelegramSettings] = useState(true);

  const [longPressProject, setLongPressProject] = useState<Project | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [scannerStatusText, setScannerStatusText] = useState<string>("");
  const [cameraScoreInput, setCameraScoreInput] = useState<string>("");
  const [savingActiveStudent, setSavingActiveStudent] = useState(false);
  const isProcessingScanRef = useRef(false);

  useEffect(() => {
    return () => {
      isProcessingScanRef.current = false;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    };
  }, []);

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
  const [taggingStudent, setTaggingStudent] = useState<any | null>(null);

  // Manual specific states
  const [targetStudent, setTargetStudent] = useState<any>(null);
  const [manualScore, setManualScore] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [searchingManual, setSearchingManual] = useState(false);
  const [noPhotoWarning, setNoPhotoWarning] = useState<any>(null);

  // Easter Egg
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [easterEggData, setEasterEggData] = useState<any>(null);

  useEffect(() => {
    fetchCourse();
  }, [resolvedParams.id]);

  const fetchCourse = async () => {
    if (!course) setLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OFFLINE_TIMEOUT")), 8000)
      );

      const { data } = await Promise.race([
        supabase.from("courses").select("*").eq("id", resolvedParams.id).single(),
        timeoutPromise
      ]) as any;

      if (data) {
        setCourse(data);
        const customNames = data.custom_week_names || {};
        const loadedProjects = customNames.__projects__ || [];
        setProjects(loadedProjects);
        await fetchStats(data, loadedProjects);
      }
    } catch (e) {
      console.log("Offline mode active: using cached evaluations data");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (courseData: any, currentProjects: any[] = projects) => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OFFLINE_TIMEOUT")), 10000)
      );

      const [studentsData, evalsData] = await Promise.race([
        Promise.all([
          fetchAllSupabaseRows((from, to) => {
            let q = supabase
              .from("students")
              .select("id, section, is_active, academic_year")
              .eq("academic_year", courseData.academic_year)
              .eq("is_active", true);
            if (courseData.sections && Array.isArray(courseData.sections) && courseData.sections.length > 0) {
              q = q.in("section", courseData.sections);
            }
            return q.range(from, to);
          }),
          fetchAllSupabaseRows((from, to) =>
            supabase.from("evaluations").select("student_id, project_name, score").eq("course_id", courseData.id).range(from, to)
          )
        ]),
        timeoutPromise
      ]) as any;

      let combinedStudents = [...(studentsData || [])];
      if (courseData.makeup_students && courseData.makeup_students.length > 0) {
        const { data: makeup } = await supabase
          .from("students")
          .select("id, section, is_active, academic_year")
          .in("id", courseData.makeup_students)
          .eq("is_active", true);
        if (makeup) {
          const existingIds = new Set(combinedStudents.map((s: any) => s.id));
          makeup.forEach((m: any) => {
            if (!existingIds.has(m.id)) combinedStudents.push(m);
          });
        }
      }

      const excluded = courseData.excluded_students || [];
      const activeStudents = combinedStudents.filter((s: any) => {
        if (s.is_active === false) return false;
        if (excluded.includes(s.id)) return false;
        if (courseData.sections && Array.isArray(courseData.sections) && courseData.sections.length > 0) {
          return courseData.sections.includes(String(s.section));
        }
        return true;
      });

      const studentSecMap = new Map<string, string>();
      const countBySec: Record<string, number> = {};
      activeStudents.forEach((s: any) => {
        const sec = String(s.section || 'عام');
        studentSecMap.set(s.id, sec);
        countBySec[sec] = (countBySec[sec] || 0) + 1;
      });

      setTotalCourseStudents(activeStudents.length);
      setStudentsCountBySection(countBySec);

      const statsOverall: Record<string, number> = {};
      const statsBySec: Record<string, Record<string, number>> = {};
      (evalsData || []).forEach((ev: any) => {
        if (ev.score !== null && ev.score !== undefined && !isNaN(Number(ev.score))) {
          statsOverall[ev.project_name] = (statsOverall[ev.project_name] || 0) + 1;
          const sec = studentSecMap.get(ev.student_id);
          if (sec) {
            if (!statsBySec[ev.project_name]) statsBySec[ev.project_name] = {};
            statsBySec[ev.project_name][sec] = (statsBySec[ev.project_name][sec] || 0) + 1;
          }
        }
      });
      setProjectStats(statsOverall);
      setProjectStatsBySection(statsBySec);

      // Save to local cache
      setLocalCache(`cache_evaluations_${courseData.id}`, {
        course: courseData,
        projects: currentProjects,
        totalCourseStudents: activeStudents.length,
        projectStats: statsOverall,
        projectStatsBySection: statsBySec,
        studentsCountBySection: countBySec
      });
    } catch (e) {}
  };

  const getTodayLocalDateStr = (d = new Date()) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getSuggestedDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      name: newProjectName.trim(),
      max_score: maxScoreNum,
      portal_enabled: newProjectPortalEnabled,
      is_active: newProjectPortalEnabled,
      submission_deadline: newProjectDeadline || undefined,
      end_date: newProjectDeadline || undefined,
      camera_mode: newProjectCameraMode,
      required_photos: newProjectRequiredPhotos,
      multi_stage_enabled: newProjectMultiStage,
      stage1_title: newProjectMultiStage ? (newProjectStage1Title || "مرحلة التجهيز والتحضير") : undefined,
      stage1_deadline: newProjectMultiStage ? (newProjectStage1Deadline || undefined) : undefined,
      stage2_title: newProjectMultiStage ? (newProjectStage2Title || "العمل النهائي المكتمل") : undefined,
      stage2_deadline: newProjectMultiStage ? (newProjectStage2Deadline || undefined) : undefined,
    };

    const updatedProjects = [...projects, newProject];
    const updatedCustomWeekNames = {
      ...(course.custom_week_names || {}),
      __projects__: updatedProjects
    };

    await supabase.from("courses").update({ custom_week_names: updatedCustomWeekNames }).eq("id", course.id);
    try {
      fetch('/api/push/notify-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: course.id,
          project_name: newProject.name,
          max_score: newProject.max_score
        })
      }).catch(() => {});
    } catch (_) {}
    
    setProjects(updatedProjects);
    setCourse({ ...course, custom_week_names: updatedCustomWeekNames });
    
    if (view === 'CAMERA' || view === 'MANUAL') {
      setSelectedProject(newProject);
    }

    setShowAddProjectModal(false);
    setNewProjectName("");
    setNewProjectMaxScore("50");
    setNewProjectPortalEnabled(true);
    setNewProjectCameraMode('2d');
    setNewProjectRequiredPhotos(1);
    setNewProjectDeadline("");
    setNewProjectMultiStage(false);
    setNewProjectStage1Title("مرحلة التجهيز والتحضير");
    setNewProjectStage1Deadline("");
    setNewProjectStage2Title("العمل النهائي المكتمل");
    setNewProjectStage2Deadline("");
  };

  const handleProjectTouchStart = (proj: Project) => {
    longPressTriggered.current = false;
    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setLongPressProject(proj);
      setEditProjectName(proj.name);
      setEditProjectMaxScore(proj.max_score.toString());
      setEditProjectPortalEnabled(proj.portal_enabled ?? proj.is_active ?? true);
      setEditProjectDeadline(proj.submission_deadline || proj.end_date || "");
      setEditProjectCameraMode(proj.camera_mode ?? '2d');
      setEditProjectRequiredPhotos(proj.required_photos ?? 1);
      setEditProjectMultiStage(proj.multi_stage_enabled ?? false);
      setEditProjectStage1Title(proj.stage1_title || "مرحلة التجهيز والتحضير");
      setEditProjectStage1Deadline(proj.stage1_deadline || "");
      setEditProjectStage2Title(proj.stage2_title || "العمل النهائي المكتمل");
      setEditProjectStage2Deadline(proj.stage2_deadline || "");
      setShowTelegramSettings(true);
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
        name: editProjectName.trim(), 
        max_score: maxScoreNum,
        portal_enabled: editProjectPortalEnabled,
        is_active: editProjectPortalEnabled,
        submission_deadline: editProjectDeadline || undefined,
        end_date: editProjectDeadline || undefined,
        camera_mode: editProjectCameraMode,
        required_photos: editProjectRequiredPhotos,
        multi_stage_enabled: editProjectMultiStage,
        stage1_title: editProjectMultiStage ? (editProjectStage1Title || "مرحلة التجهيز والتحضير") : undefined,
        stage1_deadline: editProjectMultiStage ? (editProjectStage1Deadline || undefined) : undefined,
        stage2_title: editProjectMultiStage ? (editProjectStage2Title || "العمل النهائي المكتمل") : undefined,
        stage2_deadline: editProjectMultiStage ? (editProjectStage2Deadline || undefined) : undefined,
      } : p
    );

    const updatedCustomWeekNames = {
      ...(course?.custom_week_names || {}),
      __projects__: updatedProjects
    };

    await supabase.from("courses").update({ custom_week_names: updatedCustomWeekNames }).eq("id", course!.id);

    const oldName = longPressProject.name;
    const newName = editProjectName.trim();
    if (oldName && newName && oldName !== newName) {
      try {
        await supabase.from("evaluations").update({ project_name: newName }).eq("course_id", course!.id).eq("project_name", oldName);
        await supabase.from("student_submissions").update({ project_name: newName }).eq("course_id", course!.id).eq("project_name", oldName);
      } catch (err) {
        console.error("Error cascading project rename to evaluations:", err);
      }
    }
    
    setProjects(updatedProjects);
    if (course) setCourse({ ...course, custom_week_names: updatedCustomWeekNames });

    setShowManageProjectModal(false);
  };

  const archiveProject = async () => {
    if (!longPressProject) return;
    const updatedProjects = projects.map(p => 
      p.id === longPressProject.id ? { ...p, is_archived: true, is_active: false, portal_enabled: false } : p
    );
    const updatedCustomWeekNames = { ...(course.custom_week_names || {}), __projects__: updatedProjects };
    await supabase.from("courses").update({ custom_week_names: updatedCustomWeekNames }).eq("id", course.id);
    setProjects(updatedProjects);
    setCourse({ ...course, custom_week_names: updatedCustomWeekNames });
    setShowManageProjectModal(false);
  };

  const deleteProjectPermanently = async () => {
    if (!longPressProject) return;
    if (!confirm(`هل أنت متأكد من حذف مشروع "${longPressProject.name}" نهائياً؟ سيتم حذفه من كافة القوائم والبوابات.`)) return;
    const updatedProjects = projects.filter(p => p.id !== longPressProject.id);
    const updatedCustomWeekNames = { ...(course.custom_week_names || {}), __projects__: updatedProjects };
    await supabase.from("courses").update({ custom_week_names: updatedCustomWeekNames }).eq("id", course.id);
    setProjects(updatedProjects);
    setCourse({ ...course, custom_week_names: updatedCustomWeekNames });

    try {
      await supabase.from("student_submissions").delete().eq("course_id", course.id).eq("project_name", longPressProject.name);
      await supabase.from("evaluations").delete().eq("course_id", course.id).eq("project_name", longPressProject.name);
    } catch (e) {}

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
    setStatsModalTab('submitted');
    setStatsModalSectionFilter(selectedSectionFilter);
    setStatsSearchQuery("");

    try {
      const [allStudents, evals] = await Promise.all([
        fetchAllSupabaseRows((from, to) => {
          let q = supabase
            .from("students")
            .select("id, full_name, student_code, section, academic_year, is_active")
            .eq("academic_year", course.academic_year)
            .eq("is_active", true);
          if (course.sections && Array.isArray(course.sections) && course.sections.length > 0) {
            q = q.in("section", course.sections);
          }
          return q.range(from, to);
        }),
        fetchAllSupabaseRows((from, to) =>
          supabase
            .from("evaluations")
            .select("id, student_id, score, photo_url, created_at")
            .eq("course_id", course.id)
            .eq("project_name", proj.name)
            .range(from, to)
        )
      ]);

      const excluded = course.excluded_students || [];
      let eligible = (allStudents || []).filter((s: any) => {
        if (s.is_active === false) return false;
        if (excluded.includes(s.id)) return false;
        if (course.sections && Array.isArray(course.sections) && course.sections.length > 0) {
          return course.sections.includes(String(s.section));
        }
        return true;
      });

      if (course.makeup_students && course.makeup_students.length > 0) {
        const { data: makeup } = await supabase
          .from("students")
          .select("id, full_name, student_code, section, academic_year, is_active")
          .in("id", course.makeup_students)
          .eq("is_active", true);
        if (makeup) {
          const eligibleIds = new Set(eligible.map(s => s.id));
          makeup.forEach((m: any) => {
            if (!eligibleIds.has(m.id) && !excluded.includes(m.id) && m.is_active !== false) eligible.push(m);
          });
        }
      }

      const submittedMap = new Map((evals || []).map((ev: any) => [ev.student_id, ev]));
      const submittedList: any[] = [];
      const missingList: any[] = [];

      eligible.forEach((s: any) => {
        if (submittedMap.has(s.id)) {
          submittedList.push({ ...s, eval: submittedMap.get(s.id) });
        } else {
          missingList.push(s);
        }
      });

      submittedList.sort((a, b) => (a.section || '').localeCompare(b.section || '', 'ar', { numeric: true }) || a.full_name.localeCompare(b.full_name, 'ar'));
      missingList.sort((a, b) => (a.section || '').localeCompare(b.section || '', 'ar', { numeric: true }) || a.full_name.localeCompare(b.full_name, 'ar'));

      setStatsData({ submitted: submittedList, missing: missingList });
    } catch (err) {
      console.error("Error loading project stats:", err);
    } finally {
      setLoadingStatsModal(false);
    }
  };

  const exportEvaluatedStudentsPdf = async (proj: Project, submittedList: any[]) => {
    const tableRows = submittedList.map((s, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-align: right; font-weight: bold;">${s.full_name}</td>
        <td>${s.student_code}</td>
        <td>${s.section || 'عام'}</td>
        <td>${s.academic_year || course.academic_year}</td>
        <td style="font-weight: bold; color: #2e7d32;">${s.eval?.score ?? '-'} / ${proj.max_score}</td>
        <td style="font-size: 11px;">${s.eval?.created_at ? new Date(s.eval.created_at).toLocaleDateString('ar-EG') : '-'}</td>
      </tr>
    `).join("");

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>اسم الطالب</th>
            <th>كود الطالب</th>
            <th>الشعبة / السكشن</th>
            <th>الفرقة</th>
            <th>الدرجة المرصودة</th>
            <th>تاريخ التقييم</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    (await import("@/lib/courses/downloadPdf")).downloadPdf(
      "evaluated_students.pdf",
      course.name,
      `تقرير الطلاب المقيمين في مشروع (${proj.name})`,
      `إجمالي المقيمين: ${submittedList.length} طالب - الدرجة العظمى: ${proj.max_score} - تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`,
      tableHtml,
      `أستاذ المقرر: ${course.instructor_name || "...................."}`
    );
  };

  const exportMissingStudentsPdf = async (proj: Project, missingList: any[]) => {
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

    (await import("@/lib/courses/downloadPdf")).downloadPdf(
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

  const vibrateSuccess = () => { 
    playScanClickSound();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100); 
  };
  const vibrateDuplicate = () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([70, 40, 70]); };
  const vibrateHeavyError = () => { 
    playScanErrorSound();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([250, 70, 250, 70, 400]); 
  };
  const vibrateError = vibrateHeavyError;

  const getAttendanceCount = async (studentId: string) => {
    const { data } = await supabase.from("attendance").select("id").eq("course_id", course.id).eq("student_id", studentId);
    return data ? data.length : 0;
  };

  const handleCrossCourseMakeup = async (code: string, preFetchedStudent?: any) => {
    let globalStudent = preFetchedStudent;
    if (!globalStudent) {
      const variants = getStudentCodeVariants(code);
      const filter = buildStudentCodeFilter(variants);

      try {
        const { data } = await supabase
          .from("students")
          .select("*")
          .or(filter)
          .limit(1)
          .maybeSingle();
        globalStudent = data;
      } catch (e) {}

      // Fallback to server API if client-side query blocked by RLS / session
      if (!globalStudent) {
        try {
          const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(code)}`);
          if (res.ok) {
            const lData = await res.json();
            if (lData.student) globalStudent = lData.student;
          }
        } catch (e) {}
      }
    }
    
    if (!globalStudent) {
      vibrateHeavyError();
      setScannerStatus('error');
      setScannerStatusText(`كود غير مسجل في أي فرقة: (${code})`);
      await new Promise(r => setTimeout(r, 100));
      alert(`لم يتم العثور على طالب بهذا الكود في أي فرقة!\nالكود المدخل: ${code}`);
      return null;
    }

    // Heavy rough vibration for student from another cohort + show student info
    vibrateHeavyError();
    setScannerStatus('error');
    setScannerStatusText(`طالب مقيد بفرقة أخرى: ${globalStudent.full_name} (${globalStudent.academic_year} - سكشن ${globalStudent.section})`);

    await new Promise(r => setTimeout(r, 100));
    const confirmAdd = window.confirm(`بيانات الطالب:\n• الاسم: ${globalStudent.full_name}\n• الفرقة: ${globalStudent.academic_year}\n• السكشن: ${globalStudent.section}\n• الكود: ${globalStudent.student_code || code}\n\nالطالب غير مدرج في قوائم هذا المقرر (${course?.name || ''}).\nهل تود ضمه كطالب تخلفات / مستمع الآن؟`);
    
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
    const variants = getStudentCodeVariants(code);
    const filter = buildStudentCodeFilter(variants);

    let student: any = null;
    try {
      const { data } = await supabase.from("students")
        .select("*")
        .or(filter)
        .limit(1)
        .maybeSingle();
      student = data;
    } catch (e) {}

    // Fallback to server API if client-side query blocked by RLS / session
    if (!student) {
      try {
        const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(code)}`);
        if (res.ok) {
          const lData = await res.json();
          if (lData.student) student = lData.student;
        }
      } catch (e) {}
    }

    if (!student) {
      vibrateHeavyError();
      setScannerStatus('error');
      setScannerStatusText(`كود غير مسجل في أي فرقة: (${code})`);
      alert(`لم يتم العثور على طالب بهذا الكود في أي فرقة!\nالكود المدخل: ${code}`);
      return null;
    }

    // مطابقة مرنة للفرقة الدراسية تتسامح مع مختلف التنسيقات (الفرقة الأولى vs الاولي)
    const isSameYear = normalizeAcademicYear(student.academic_year) === normalizeAcademicYear(course.academic_year);
    const inMakeup = course.makeup_students && course.makeup_students.includes(student.id);

    if (isSameYear || inMakeup) {
      return student;
    }

    // إذا كان الطالب مقيداً بفرقة دراسية أخرى تماماً
    return await handleCrossCourseMakeup(code, student);
  };

  // --- SCANNER LOGIC ---
  const startScanner = () => {
    setScannedStudents([]);
    setActiveScannedStudent(null);
    setView('CAMERA');
  };

  const cancelScanner = () => {
    isProcessingScanRef.current = false;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
    setScannedStudents([]);
    setActiveScannedStudent(null);
    setView('EVAL_MENU');
  };

  const handleScannerScan = async (codeResult: string) => {
    if (activeScannedStudent || isProcessingScanRef.current || scannerStatus !== 'idle') return;
    isProcessingScanRef.current = true;

    const cleanCode = extractStudentCode(codeResult) || codeResult.trim();
    if (!cleanCode) {
      setScannerStatus('error');
      setScannerStatusText("كود غير صالح");
      vibrateHeavyError();
      setTimeout(() => {
        setScannerStatus('idle');
        setScannerStatusText("");
        isProcessingScanRef.current = false;
      }, 800);
      return;
    }

    // Duplicate scan: two rapid vibrations
    const codeVariants = getStudentCodeVariants(cleanCode);
    if (scannedStudents.some(s => codeVariants.includes(s.student?.student_code) || codeVariants.includes(s.student?.id))) {
      setScannerStatus('error');
      setScannerStatusText("طالب مكرر تم رصده مسبقاً");
      vibrateDuplicate();
      setTimeout(() => {
        setScannerStatus('idle');
        setScannerStatusText("");
        isProcessingScanRef.current = false;
      }, 800);
      return;
    }

    try {
      const student = await checkStudentLocalOrGlobal(cleanCode);
      if (student) {
        const attCount = await getAttendanceCount(student.id);
        
        let { data: ex }: { data: any } = await supabase.from("evaluations")
          .select("id, score, photo_url, created_at").eq("course_id", course.id).eq("student_id", student.id).eq("project_name", selectedProject?.name).maybeSingle();

        // فحص تسليمات بوابة الطلاب لجلب الصور ومراحل العمل
        const { data: sub } = await supabase.from("student_submissions")
          .select("images, created_at, score")
          .eq("course_id", course.id)
          .eq("student_code", student.student_code)
          .eq("project_name", selectedProject?.name)
          .maybeSingle();

        const subImages = Array.isArray(sub?.images) ? sub.images : [];
        const primaryUrl = ex?.photo_url || subImages[0]?.url || (typeof subImages[0] === 'string' ? subImages[0] : null);

        if (primaryUrl) {
          if (!ex) {
            ex = { id: null, score: sub?.score, photo_url: primaryUrl, created_at: sub?.created_at, images: subImages };
          } else {
            ex.photo_url = primaryUrl;
            ex.images = subImages.length > 0 ? subImages : (ex.photo_url ? [{ url: ex.photo_url }] : []);
          }
        }

        const existingScore = (ex && ex.score !== null && !isNaN(Number(ex.score)) && Number(ex.score) > 0) ? Number(ex.score) : null;
        const isAlreadyEvaluated = existingScore !== null;

        const studentWithData = {
          student,
          attCount,
          score: existingScore,
          evalRecord: ex,
          isExisting: isAlreadyEvaluated
        };

        if (isAlreadyEvaluated) {
          playScanAlreadyEvaluatedSound();
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([120, 60, 120]);
          setScannerStatus('success');
          setScannerStatusText(`تم تقييم الطالب مسبقاً (${existingScore} من ${selectedProject?.max_score})`);
        } else {
          setScannerStatus('success');
          setScannerStatusText(`تم الرصد: ${student.full_name}`);
          vibrateSuccess();
        }

        setTimeout(() => {
          setScannerStatus('idle');
          setScannerStatusText("");
          isProcessingScanRef.current = false;
          
          if (isAlreadyEvaluated) {
            // للطالب المقيّم مسبقاً: فتح شباك الدرجات فوراً مع تظليل درجته السابقة دون إيقافه بتحذير الصورة
            setActiveScannedStudent(studentWithData);
            setCameraScoreInput(existingScore.toString());
            setTimeout(() => document.getElementById("cameraGradeInput")?.focus(), 150);
          } else if (!ex?.photo_url) {
            setNoPhotoWarning({
              student,
              attCount,
              ex,
              mode: 'CAMERA',
              studentWithData
            });
          } else {
            setActiveScannedStudent(studentWithData);
            setCameraScoreInput("");
            setTimeout(() => document.getElementById("cameraGradeInput")?.focus(), 150);
          }
        }, 500);
      } else {
        setScannerStatus('error');
        setScannerStatusText("طالب غير مسجل في هذا المقرر");
        vibrateHeavyError();
        setTimeout(() => {
          setScannerStatus('idle');
          setScannerStatusText("");
          isProcessingScanRef.current = false;
        }, 800);
      }
    } catch (err) {
      setScannerStatus('error');
      setScannerStatusText("خطأ في قراءة بيانات الطالب");
      vibrateHeavyError();
      setTimeout(() => {
        setScannerStatus('idle');
        setScannerStatusText("");
        isProcessingScanRef.current = false;
      }, 800);
    }
  };

  const handleQuickGradeSelect = (score: number) => {
    if (!activeScannedStudent) return;
    vibrateSuccess();
    setCameraScoreInput(score.toString());
  };

  const handleSaveCameraScannedStudent = async () => {
    if (!activeScannedStudent || !selectedProject) return;
    if (cameraScoreInput === "" || isNaN(Number(cameraScoreInput))) {
      vibrateError();
      alert("يرجى كتابة أو اختيار درجة صحيحة.");
      return;
    }

    const scoreNum = Number(cameraScoreInput);
    if (scoreNum < 0 || scoreNum > selectedProject.max_score) {
      vibrateError();
      alert(`الدرجة المسموحة يجب أن تكون بين 0 و ${selectedProject.max_score}`);
      return;
    }

    setSavingActiveStudent(true);
    try {
      const student = activeScannedStudent.student;
      
      // 1. Save evaluation to DB
      await supabase.from("evaluations").upsert({
        course_id: course.id,
        student_id: student.id,
        project_name: selectedProject.name,
        score: scoreNum,
        teacher_id: course.teacher_id,
        created_at: new Date().toISOString()
      }, { onConflict: 'course_id,student_id,project_name' });
      try {
        fetch('/api/push/notify-evaluation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: student.id,
            course_id: course.id,
            project_name: selectedProject.name,
            score: scoreNum
          })
        }).catch(() => {});
      } catch (_) {}

      // 2. Mark attendance if checked
      if (markAttendanceWithEval) {
        const today = getTodayLocalDateStr();
        const { data: existingAtt } = await supabase.from("attendance")
          .select("id, status")
          .eq("course_id", course.id)
          .eq("student_id", student.id)
          .eq("date", today)
          .maybeSingle();

        if (existingAtt) {
          if (existingAtt.status !== "حاضر") {
            await supabase.from("attendance").update({ status: "حاضر", created_at: new Date().toISOString() }).eq("id", existingAtt.id);
          }
        } else {
          await supabase.from("attendance").insert({
            course_id: course.id,
            student_id: student.id,
            date: today,
            status: "حاضر",
            teacher_id: course.teacher_id
          });
        }
      }

      // 3. Send Telegram Notification
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetch('/api/bot/notify_eval', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({
            studentId: student.id,
            projectName: selectedProject.name,
            score: scoreNum,
            projectShowScore: selectedProject.show_score
          })
        }).catch(() => {});
      });

      vibrateSuccess();
      
      // Update session history list
      const updatedItem = { ...activeScannedStudent, score: scoreNum };
      setScannedStudents(prev => [updatedItem, ...prev.filter(s => s.student?.id !== student.id)]);
      
      // Reset active student and resume scanner
      setActiveScannedStudent(null);
      setCameraScoreInput("");
      isProcessingScanRef.current = false;
      fetchStats(course);
    } catch (err: any) {
      console.error(err);
      vibrateError();
      alert("حدث خطأ أثناء حفظ التقييم: " + (err.message || err));
    } finally {
      setSavingActiveStudent(false);
    }
  };

  const handleCancelActiveStudent = () => {
    setActiveScannedStudent(null);
    setCameraScoreInput("");
    isProcessingScanRef.current = false;
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
      // LOW-7 FIX: Clamp score between 0 and max_score
      const rawScore = s.score !== null ? Number(s.score) : 0;
      const validScore = Math.min(Math.max(isNaN(rawScore) ? 0 : rawScore, 0), selectedProject.max_score);

      const { data: existing } = await supabase.from("evaluations").select("id, score").eq("course_id", course.id).eq("student_id", s.student.id).eq("project_name", selectedProject.name).maybeSingle();
      if (existing) {
        if (existing.score !== validScore) { await supabase.from("evaluations").update({ score: validScore, created_at: new Date().toISOString() }).eq("id", existing.id); }
      } else {
        await supabase.from("evaluations").insert({
          course_id: course.id,
          student_id: s.student.id,
          project_name: selectedProject.name,
          score: validScore,
          max_score: selectedProject.max_score,
          teacher_id: course.teacher_id
        });
      }
      try {
        fetch('/api/push/notify-evaluation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: s.student.id,
            course_id: course.id,
            project_name: selectedProject.name,
            score: validScore
          })
        }).catch(() => {});
      } catch (_) {}
    }

    if (markAttendanceWithEval) {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
      let { data: ex }: { data: any } = await supabase.from("evaluations")
        .select("id, score, photo_url, created_at").eq("course_id", course.id).eq("student_id", student.id).eq("project_name", selectedProject?.name).maybeSingle();

      // فحص تسليمات بوابة الطلاب لجلب الصور ومراحل العمل
      const { data: sub } = await supabase.from("student_submissions")
        .select("images, created_at, score")
        .eq("course_id", course.id)
        .eq("student_code", student.student_code)
        .eq("project_name", selectedProject?.name)
        .maybeSingle();

      const subImages = Array.isArray(sub?.images) ? sub.images : [];
      const primaryUrl = ex?.photo_url || subImages[0]?.url || (typeof subImages[0] === 'string' ? subImages[0] : null);

      if (primaryUrl) {
        if (!ex) {
          ex = { id: null, score: sub?.score, photo_url: primaryUrl, created_at: sub?.created_at, images: subImages };
        } else {
          ex.photo_url = primaryUrl;
          ex.images = subImages.length > 0 ? subImages : (ex.photo_url ? [{ url: ex.photo_url }] : []);
        }
      }

      vibrateSuccess();
      const attCount = await getAttendanceCount(student.id);

      if (!ex?.photo_url) {
        setNoPhotoWarning({
          student,
          attCount,
          ex,
          mode: 'MANUAL'
        });
        setSearchingManual(false);
        return;
      }

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
    try {
      fetch('/api/push/notify-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: targetStudent.id,
          course_id: course.id,
          project_name: selectedProject.name,
          score: scoreNum
        })
      }).catch(() => {});
    } catch (_) {}

    // Send Telegram Notification
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch('/api/bot/notify_eval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          studentId: targetStudent.id,
          projectName: selectedProject.name,
          score: scoreNum,
          projectShowScore: selectedProject.show_score
        })
      });
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

  // --- CANCEL / DELETE ARTWORK & RESET FOR RETAKE ---
  const cancelArtwork = async (evalId?: string, studentToCancel?: any) => {
    const student = studentToCancel || targetStudent || activeScannedStudent?.student;
    if (!student || !selectedProject) {
      alert("تعذر تحديد بيانات الطالب أو المشروع لإلغاء العمل.");
      return;
    }

    if (!confirm(`هل أنت متأكد من إلغاء وحذف عمل الطالب (${student.full_name})؟\nسيتم حذف الصورة وتصفير الدرجة نهائياً، وسيتمكن الطالب من فتح الكاميرا في بوابته وإعادة تصوير لوحته مجدداً.`)) return;

    try {
      // 1. استدعاء API إعادة التصوير وحذف التسليم من السحابة وقواعد البيانات
      const res = await fetch("/api/instructor/allow-retake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructor_id: course?.teacher_id,
          student_code: student.student_code,
          course_id: course.id,
          project_name: selectedProject.name
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل إلغاء العمل");
      }

      // 2. تحديث جدول evaluations محلياً وتصفير الدرجة لـ null
      if (evalId) {
        await supabase.from("evaluations").update({ photo_url: null, ai_status: null, score: null }).eq("id", evalId);
      } else if (student.id) {
        await supabase.from("evaluations").update({ photo_url: null, ai_status: null, score: null })
          .eq("student_id", student.id)
          .eq("course_id", course.id)
          .eq("project_name", selectedProject.name);
      }

      alert("✅ تم إلغاء العمل وحذفه بالكامل بنجاح!\nيمكن للطالب الآن فتح الكاميرا في بوابته وإعادة تصوير العمل.");

      setManualScore("");
      if (targetStudent && targetStudent.id === student.id) {
        setTargetStudent({ ...targetStudent, evalRecord: null });
      }
      if (activeScannedStudent && activeScannedStudent.student.id === student.id) {
        setActiveScannedStudent({ ...activeScannedStudent, evalRecord: null, score: null });
      }
      fetchStats(course);
    } catch (e: any) {
      alert("خطأ أثناء إلغاء العمل: " + e.message);
    }
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

  if (loading && !course) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--background)" }}><div className="loader-circle"></div></div>;

  return (
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", direction: "rtl" }}>
        <button
          type="button"
          className="hide-on-mobile btn-compact"
          onClick={() => {
            if (view === 'CAMERA') cancelScanner();
            else if (view === 'MANUAL') { setView('EVAL_MENU'); setTargetStudent(null); setSearchInput(""); }
            else if (view === 'EVAL_MENU') setView('PROJECTS');
            else router.push(`/course/${course?.id}`);
          }}
          style={{
            width: "auto",
            padding: "6px 12px",
            margin: 0,
            background: "var(--surface-hover)",
            border: "1px solid var(--border-light)",
            borderRadius: "8px",
            color: "var(--text)",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <ArrowRight size={15} strokeWidth={1.5} />
          <span>عودة</span>
        </button>
        <h2 style={{ margin: 0, color: "var(--warning-ink)", fontSize: "16px", fontWeight: 600 }}>بوابة التقييم</h2>
        <div style={{ width: "60px" }}></div>
      </div>

      <div style={{ padding: "16px", direction: "rtl", flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* PROJECTS LIST VIEW */}
        {view === 'PROJECTS' && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", gap: "10px" }}>
              <h3 style={{ color: "var(--text)", margin: 0, fontSize: "16px", fontWeight: 600 }}>المشاريع المتاحة للتقييم</h3>
              <button
                type="button"
                onClick={() => setShowAddProjectModal(true)}
                style={{ width: "auto", margin: 0, background: "var(--success)", color: "#ffffff", border: "1px solid var(--success)", padding: "8px 14px", borderRadius: "8px", fontWeight: 500, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
              >
                <Plus size={15} strokeWidth={1.5} />
                <span>إضافة مشروع</span>
              </button>
            </div>

            {/* Section Filter Dropdown */}
            {course?.sections && course.sections.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", background: "var(--surface)", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--warning-ink)", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <Filter size={13} strokeWidth={1.5} />
                  <span>تصفية بالسكشن:</span>
                </span>
                <select
                  value={selectedSectionFilter}
                  onChange={(e) => setSelectedSectionFilter(e.target.value)}
                  className="tabular-nums"
                  style={{ flex: 1, padding: "7px 10px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", fontSize: "12px", fontWeight: 500, outline: "none", cursor: "pointer", margin: 0 }}
                >
                  <option value="ALL">جميع السكاشن (إجمالي المقرر: {totalCourseStudents} طالب)</option>
                  {course.sections.map((sec: string) => (
                    <option key={sec} value={sec}>
                      سكشن {sec} ({studentsCountBySection[sec] || 0} طالب)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {projects.filter(p => !p.is_archived).length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 20px", color: "var(--text-secondary)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border-light)", fontSize: "13px", lineHeight: 1.6 }}>
                لا توجد مشاريع مضافة حتى الآن.<br/>اضغط على «إضافة مشروع» للبدء.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
                {projects.filter(p => !p.is_archived).map(proj => {
                  const isSecFiltered = selectedSectionFilter !== "ALL";
                  const effectiveTotal = isSecFiltered ? (studentsCountBySection[selectedSectionFilter] || 0) : totalCourseStudents;
                  const graded = isSecFiltered
                    ? ((projectStatsBySection[proj.name] && projectStatsBySection[proj.name][selectedSectionFilter]) || 0)
                    : (projectStats[proj.name] || 0);
                  const ungraded = Math.max(0, effectiveTotal - graded);

                  return (
                    <div
                      key={proj.id}
                      onClick={() => handleSelectProject(proj)}
                      onTouchStart={() => handleProjectTouchStart(proj)}
                      onTouchEnd={handleProjectTouchEnd}
                      onMouseDown={() => handleProjectTouchStart(proj)}
                      onMouseUp={handleProjectTouchEnd}
                      onMouseLeave={handleProjectTouchEnd}
                      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none", userSelect: "none", background: "var(--surface)", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}
                    >
                      <div style={{ flex: 1, pointerEvents: "none", minWidth: 0 }}>
                        <div className="tabular-nums" style={{ color: "var(--accent-ink)", fontWeight: 600, fontSize: "15px", marginBottom: "6px" }}>
                          {proj.name} <span style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 400 }}>({proj.max_score} درجة)</span>
                        </div>
                        <div className="tabular-nums" style={{ display: "flex", gap: "12px", fontSize: "11px", flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ color: "var(--success-ink)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={12} strokeWidth={1.5} />
                            <span>مقيّم: {graded}</span>
                          </span>
                          <span style={{ color: "var(--error-ink)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={12} strokeWidth={1.5} />
                            <span>متبقي: {ungraded}</span>
                          </span>
                          <span style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Users size={12} strokeWidth={1.5} />
                            <span>الإجمالي: {effectiveTotal} {isSecFiltered ? `(سكشن ${selectedSectionFilter})` : ''}</span>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => openProjectStats(proj, e)}
                          title="إحصائية المشروع وتصدير كشوف المقيمين والمتأخرين PDF"
                          style={{ width: "auto", margin: 0, background: "rgba(56, 189, 248, 0.12)", color: "var(--accent-ink)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: "8px", padding: "6px 10px", fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                        >
                          <BarChart3 size={14} strokeWidth={1.5} />
                          <span>إحصائية</span>
                        </button>
                        <ChevronLeft size={18} strokeWidth={1.5} color="var(--text-muted)" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* EVALUATION MENU */}
        {view === 'EVAL_MENU' && selectedProject && (() => {
          const isSecFiltered = selectedSectionFilter !== "ALL";
          const effectiveTotal = isSecFiltered ? (studentsCountBySection[selectedSectionFilter] || 0) : totalCourseStudents;
          const graded = isSecFiltered
            ? ((projectStatsBySection[selectedProject.name] && projectStatsBySection[selectedProject.name][selectedSectionFilter]) || 0)
            : (projectStats[selectedProject.name] || 0);
          const ungraded = Math.max(0, effectiveTotal - graded);

          return (
            <div style={{ textAlign: "center", marginTop: "8px" }}>
              <div style={{ background: "var(--surface)", padding: "16px", borderRadius: "12px", marginBottom: "20px", border: "1px solid rgba(16, 185, 129, 0.35)" }}>
                <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "4px" }}>المشروع المحدد</div>
                <div className="tabular-nums" style={{ color: "var(--success-ink)", fontWeight: 600, fontSize: "18px", marginBottom: "8px", textAlign: "center" }}>
                  {selectedProject.name} <span style={{ color: "var(--text-muted)", fontSize: "13px", fontWeight: 400 }}>({selectedProject.max_score} درجة)</span>
                </div>
                {isSecFiltered && (
                  <div style={{ color: "var(--warning-ink)", fontSize: "12px", marginBottom: "10px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Filter size={13} strokeWidth={1.5} />
                    <span>إحصائيات سكشن {selectedSectionFilter}</span>
                  </div>
                )}

                <div className="tabular-nums" style={{ display: "flex", justifyContent: "space-around", background: "var(--bg-deep)", padding: "12px", borderRadius: "8px", fontSize: "11px", border: "1px solid var(--border)" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "var(--success-ink)", fontSize: "18px", fontWeight: 600 }}>{graded}</div>
                    <div style={{ color: "var(--text-secondary)", marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={12} strokeWidth={1.5} color="var(--success-ink)" />
                      <span>مقيّم</span>
                    </div>
                  </div>
                  <div style={{ width: "1px", background: "var(--border)" }}></div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "var(--error-ink)", fontSize: "18px", fontWeight: 600 }}>{ungraded}</div>
                    <div style={{ color: "var(--text-secondary)", marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} strokeWidth={1.5} color="var(--error-ink)" />
                      <span>متبقي</span>
                    </div>
                  </div>
                  <div style={{ width: "1px", background: "var(--border)" }}></div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "var(--accent-ink)", fontSize: "18px", fontWeight: 600 }}>{effectiveTotal}</div>
                    <div style={{ color: "var(--text-secondary)", marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Users size={12} strokeWidth={1.5} color="var(--accent-ink)" />
                      <span>الإجمالي</span>
                    </div>
                  </div>
                </div>
              </div>

              <h3 style={{ color: "var(--warning-ink)", marginBottom: "16px", fontSize: "15px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Star size={16} strokeWidth={1.5} />
                <span>اختر طريقة التقييم</span>
              </h3>
              <button
                type="button"
                onClick={startScanner}
                style={{ width: "100%", margin: "0 0 10px 0", background: "var(--success)", color: "#ffffff", padding: "14px", borderRadius: "10px", fontSize: "15px", fontWeight: 500, border: "1px solid var(--success)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer" }}
              >
                <Smartphone size={18} strokeWidth={1.5} />
                <span>التقييم الذكي (بالكاميرا والمطابقة)</span>
              </button>
              <button
                type="button"
                onClick={() => setView('MANUAL')}
                style={{ width: "100%", margin: 0, background: "var(--primary)", color: "#ffffff", padding: "14px", borderRadius: "10px", fontSize: "15px", fontWeight: 500, border: "1px solid var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer" }}
              >
                <FileText size={18} strokeWidth={1.5} />
                <span>التقييم اليدوي ومراجعة اللوحات</span>
              </button>
            </div>
          );
        })()}

        {/* MANUAL EVALUATION VIEW */}
        {view === 'MANUAL' && (
          <div style={{ background: "var(--surface)", padding: "14px", borderRadius: "12px", border: "1px solid var(--border)", flexGrow: 1, display: "flex", flexDirection: "column" }}>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ color: "var(--text-secondary)", fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 500 }}>المشروع الحالي:</label>
              <select
                value={selectedProject?.id || ""}
                onChange={e => {
                  if (e.target.value === "ADD_NEW") setShowAddProjectModal(true);
                  else {
                    const p = projects.find(x => x.id === e.target.value);
                    if (p) setSelectedProject(p);
                  }
                }}
                style={{ width: "100%", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", fontSize: "13px", outline: "none", margin: 0 }}
              >
                {projects.filter(p => !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.name} (Max {p.max_score})</option>)}
                <option value="ADD_NEW" style={{ color: "var(--success-ink)" }}>+ إضافة مشروع جديد...</option>
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
                className="tabular-nums"
                style={{ flex: 1, padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", fontSize: "15px", textAlign: "center", outline: "none", margin: 0 }}
              />
              <button
                type="button"
                onClick={handleManualSearch}
                disabled={searchingManual}
                style={{ width: "auto", margin: 0, background: "var(--primary)", color: "#ffffff", border: "1px solid var(--primary)", padding: "0 18px", borderRadius: "8px", fontWeight: 500, fontSize: "13px", cursor: "pointer" }}
              >
                {searchingManual ? "..." : "بحث"}
              </button>
            </div>

            {targetStudent && selectedProject && (
              <div style={{ background: "var(--bg-deep)", padding: "14px", borderRadius: "12px", border: "1px solid var(--success)", animation: "slideUp 0.2s var(--ease-out)" }}>

                {/* Student Full Info Header */}
                <div style={{ position: "relative", marginBottom: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                  <button
                    type="button"
                    onClick={() => { setTargetStudent(null); setSearchInput(""); }}
                    className="btn-compact"
                    title="إغلاق بطاقة الطالب"
                    style={{
                      position: "absolute",
                      top: "0",
                      left: "0",
                      width: "28px",
                      height: "28px",
                      padding: "0",
                      margin: "0",
                      background: "rgba(239, 68, 68, 0.14)",
                      color: "var(--error-ink)",
                      border: "1px solid rgba(239, 68, 68, 0.35)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 5
                    }}
                  >
                    <X size={15} strokeWidth={1.5} />
                  </button>

                  <div style={{ paddingLeft: "36px" }}>
                    <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "15px", marginBottom: "6px", lineHeight: "1.35" }}>{targetStudent.full_name}</div>
                    <div className="tabular-nums" style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: "rgba(56, 189, 248, 0.14)", color: "var(--accent-ink)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px", fontWeight: 500 }}>كود: {targetStudent.student_code}</span>
                      <span style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px" }}>س: {targetStudent.section}</span>
                      <span style={{ background: "rgba(245, 158, 11, 0.14)", color: "var(--warning-ink)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px", fontWeight: 500 }}>حضور: {targetStudent.attCount}</span>
                      {targetStudent.evalRecord?.score > 0 && (
                        <span style={{ background: "var(--success)", color: "#ffffff", borderRadius: "6px", padding: "2px 7px", fontSize: "11px", fontWeight: 600 }}>رُصد: {targetStudent.evalRecord.score}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* BOT UPLOAD STATUS & ARTWORK PREVIEW */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", marginBottom: "12px" }}>
                  {targetStudent.evalRecord?.photo_url ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "4px" }}>
                        <span style={{ color: "var(--success-ink)", fontSize: "12px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <CheckCircle2 size={14} strokeWidth={1.5} />
                          <span>تم رفع العمل على نظام فنية</span>
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={12} strokeWidth={1.5} />
                          <span>{formatRelativeTimeArabic(targetStudent.evalRecord.created_at)}</span>
                        </span>
                      </div>

                      {(() => {
                        const imgs = (targetStudent.evalRecord?.images && targetStudent.evalRecord.images.length > 0)
                          ? targetStudent.evalRecord.images
                          : [{ url: targetStudent.evalRecord.photo_url }];
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: imgs.length === 1 ? "1fr" : "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                            {imgs.map((imgItem: any, imgIdx: number) => {
                              const u = typeof imgItem === 'string' ? imgItem : (imgItem?.url || '');
                              if (!u) return null;
                              const isStage2 = imgItem?.stage === 'stage2' || (selectedProject?.multi_stage_enabled && imgIdx === 1);
                              const stageTitle = selectedProject?.multi_stage_enabled
                                ? (isStage2 ? (selectedProject.stage2_title || 'العمل النهائي') : (selectedProject.stage1_title || 'مرحلة التحضير'))
                                : (imgs.length > 1 ? `صورة #${imgIdx + 1}` : 'معاينة العمل');
                              return (
                                <div
                                  key={imgIdx}
                                  onClick={() => openZoomImage(u)}
                                  style={{ position: "relative", width: "100%", height: "160px", background: "#000000", borderRadius: "8px", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}
                                >
                                  <img src={u} alt={stageTitle} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                                  <div style={{ position: "absolute", top: "6px", right: "6px", background: isStage2 ? "rgba(16, 185, 129, 0.9)" : "rgba(37, 99, 235, 0.9)", color: "#ffffff", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 500 }}>
                                    {stageTitle}
                                  </div>
                                  <div style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(0, 0, 0, 0.8)", color: "#ffffff", padding: "3px 6px", borderRadius: "4px", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <Maximize2 size={10} strokeWidth={1.5} />
                                    <span>تكبير</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => cancelArtwork(targetStudent.evalRecord?.id, targetStudent)}
                          style={{ width: "auto", margin: 0, background: "rgba(239, 68, 68, 0.14)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.35)", padding: "7px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, cursor: "pointer", flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                          <span>إلغاء واعتماد إعادة التصوير</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            window.open(`/instructor?search=${targetStudent.student_code}`, "_blank");
                          }}
                          style={{ width: "auto", margin: 0, background: "rgba(37, 99, 235, 0.14)", color: "var(--accent-ink)", border: "1px solid rgba(56, 189, 248, 0.35)", padding: "7px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                        >
                          <Eye size={13} strokeWidth={1.5} />
                          <span>فحص في البوابة</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "8px 0", color: "var(--text-secondary)", fontSize: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%" }}>
                      <Clock size={14} strokeWidth={1.5} color="var(--text-muted)" />
                      <span>لم يقم الطالب برفع صورة لهذا المشروع عبر بوابة الطلاب بعد.</span>
                    </div>
                  )}
                </div>

                {/* 0 TO MAX_SCORE QUICK GRADE GRID */}
                <div style={{ marginBottom: "12px" }}>
                  <label className="tabular-nums" style={{ display: "block", color: "var(--text-secondary)", fontSize: "11px", marginBottom: "6px" }}>اضغط لتحديد الدرجة (0 إلى {selectedProject.max_score}):</label>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))",
                    gap: "6px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    padding: "2px"
                  }}>
                    {getQuickGrades(selectedProject.max_score).map(score => {
                      const isSelected = manualScore === score.toString();
                      return (
                        <button
                          type="button"
                          key={score}
                          onClick={() => setManualScore(score.toString())}
                          className="tabular-nums"
                          style={{
                            width: "100%",
                            margin: 0,
                            padding: 0,
                            height: "38px",
                            background: isSelected ? "var(--success)" : "var(--surface)",
                            color: isSelected ? "#ffffff" : "var(--text)",
                            border: isSelected ? "1px solid var(--success)" : "1px solid var(--border-light)",
                            borderRadius: "8px",
                            fontSize: "14px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grade Input & Save */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "var(--surface)", padding: "8px 12px", borderRadius: "8px", marginBottom: "12px", border: "1px solid var(--border)" }}>
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
                    className="tabular-nums"
                    style={{ flex: 1, padding: "8px", background: "var(--bg-deep)", border: "1.5px solid var(--success)", borderRadius: "6px", color: "var(--text)", fontSize: "17px", textAlign: "center", outline: "none", fontWeight: 600, margin: 0 }}
                  />
                  <span className="tabular-nums" style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>من {selectedProject.max_score}</span>
                </div>

                <button
                  type="button"
                  onClick={saveManualEvaluation}
                  disabled={savingManual}
                  style={{ width: "100%", margin: 0, background: "var(--success)", color: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid var(--success)", fontSize: "15px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <Save size={16} strokeWidth={1.5} />
                  <span>{savingManual ? "جاري الحفظ..." : "حفظ التقييم والانتقال للبحث"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* CAMERA SCANNER VIEW */}
        {view === 'CAMERA' && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", padding: "10px 12px", borderRadius: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={15} strokeWidth={1.5} color="var(--success-ink)" />
                <span>إضافة حضور مع التقييم</span>
              </span>
              <label style={{ position: "relative", display: "inline-block", width: "42px", height: "22px" }}>
                <input type="checkbox" checked={markAttendanceWithEval} onChange={e => setMarkAttendanceWithEval(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: markAttendanceWithEval ? "var(--success)" : "var(--border-light)", borderRadius: "22px", transition: "0.2s var(--ease-out)" }}>
                  <span style={{ position: "absolute", content: '""', height: "16px", width: "16px", left: "3px", bottom: "3px", backgroundColor: "#ffffff", borderRadius: "50%", transition: "0.2s var(--ease-out)", transform: markAttendanceWithEval ? "translateX(20px)" : "none" }}></span>
                </span>
              </label>
            </div>

            <select value={selectedProject?.id || ""} onChange={e => {
                if (e.target.value === "ADD_NEW") setShowAddProjectModal(true);
                else {
                  const p = projects.find(x => x.id === e.target.value);
                  if (p) setSelectedProject(p);
                }
              }} style={{ width: "100%", padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", marginBottom: "8px", fontSize: "13px", outline: "none", margin: "0 0 8px 0" }}>
                {projects.filter(p => !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.name} (Max {p.max_score})</option>)}
                <option value="ADD_NEW" style={{ color: "var(--success-ink)" }}>+ إضافة مشروع جديد...</option>
            </select>

            {/* CAMERA SECTION - ONLY SHOW WHEN NOT GRADING */}
            {!activeScannedStudent && (
              <div style={{ background: "var(--bg-deep)", borderRadius: "12px", border: "1px solid var(--border)", position: "relative", padding: "8px", flexShrink: 0, marginBottom: "8px" }}>
                <QRScanner
                  onScan={(result) => { if (result) handleScannerScan(result); }}
                  isBusy={isProcessingScanRef.current || !!activeScannedStudent || scannerStatus !== 'idle'}
                  status={scannerStatus}
                  statusText={scannerStatusText}
                  height="240px"
                  onClose={cancelScanner}
                />
              </div>
            )}

            {/* EXPANDED GRADE PANEL FOR SCANNED STUDENT */}
            {activeScannedStudent && selectedProject && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--success)", padding: "14px", borderRadius: "12px", marginTop: "6px", animation: "slideUp 0.2s var(--ease-out)" }}>

                {/* تنبيه إذا كان الطالب مقيماً مسبقاً */}
                {activeScannedStudent.isExisting && (
                  <div className="tabular-nums" style={{ background: "rgba(245, 158, 11, 0.14)", border: "1px solid rgba(245, 158, 11, 0.35)", color: "var(--warning-ink)", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <AlertTriangle size={14} strokeWidth={1.5} />
                      <span>تم تقييم هذا الطالب مسبقاً بدرجة ({activeScannedStudent.score} من {selectedProject.max_score}).</span>
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text)" }}>اختر درجة جديدة للتعديل</span>
                  </div>
                )}

                {/* Student Info Header */}
                <div style={{ position: "relative", marginBottom: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                  <button
                    type="button"
                    onClick={handleCancelActiveStudent}
                    className="btn-compact"
                    title="إلغاء الطالب الحالي"
                    style={{
                      position: "absolute",
                      top: "0",
                      left: "0",
                      width: "28px",
                      height: "28px",
                      padding: "0",
                      margin: "0",
                      background: "rgba(239, 68, 68, 0.14)",
                      color: "var(--error-ink)",
                      border: "1px solid rgba(239, 68, 68, 0.35)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 5
                    }}
                  >
                    <X size={15} strokeWidth={1.5} />
                  </button>

                  <div style={{ paddingLeft: "36px" }}>
                    <div style={{ color: "var(--success-ink)", fontWeight: 600, fontSize: "15px", marginBottom: "4px", lineHeight: "1.35" }}>{activeScannedStudent.student.full_name}</div>
                    <div className="tabular-nums" style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: "rgba(56, 189, 248, 0.14)", color: "var(--accent-ink)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px", fontWeight: 500 }}>كود: {activeScannedStudent.student.student_code}</span>
                      <span style={{ background: "var(--bg-deep)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px" }}>س: {activeScannedStudent.student.section}</span>
                      <span style={{ background: "rgba(245, 158, 11, 0.14)", color: "var(--warning-ink)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px", fontWeight: 500 }}>حضور: {activeScannedStudent.attCount}</span>
                      <span style={{ background: "var(--bg-deep)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px" }}>Max: {selectedProject.max_score}</span>

                      {(activeScannedStudent.student.isMakeup || course?.makeup_students?.includes(activeScannedStudent.student.id) || activeScannedStudent.student.section === "تخلفات") && (
                        <span style={{ background: "rgba(244, 63, 94, 0.16)", color: "#fda4af", border: "1px solid rgba(244, 63, 94, 0.35)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Repeat size={11} strokeWidth={1.5} />
                          <span>طالب تخلفات</span>
                        </span>
                      )}
                      {getStudentTag(activeScannedStudent.student, course?.teacher_id) === "distinguished" && (
                        <span style={{ background: "rgba(245, 158, 11, 0.16)", color: "var(--warning-ink)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Star size={11} strokeWidth={1.5} />
                          <span>تذكير: طالب متميز</span>
                        </span>
                      )}
                      {getStudentTag(activeScannedStudent.student, course?.teacher_id) === "uncommitted" && (
                        <span style={{ background: "rgba(239, 68, 68, 0.16)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "6px", padding: "2px 7px", fontSize: "11px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <AlertTriangle size={11} strokeWidth={1.5} />
                          <span>تنبيه: طالب غير ملتزم</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* BOT UPLOAD STATUS & ARTWORK PREVIEW */}
                <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                  {activeScannedStudent.evalRecord?.photo_url ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
                        <div>
                          <div style={{ color: "var(--success-ink)", fontSize: "12px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                            <CheckCircle2 size={14} strokeWidth={1.5} />
                            <span>تم رفع العمل على نظام فنية</span>
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={11} strokeWidth={1.5} />
                            <span>{formatRelativeTimeArabic(activeScannedStudent.evalRecord.created_at)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => cancelArtwork(activeScannedStudent.evalRecord?.id, activeScannedStudent.student)}
                          style={{ width: "auto", margin: 0, background: "rgba(239, 68, 68, 0.14)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.35)", padding: "5px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <Trash2 size={12} strokeWidth={1.5} />
                          <span>إعادة تصوير</span>
                        </button>
                      </div>

                      {(() => {
                        const imgs = (activeScannedStudent.evalRecord?.images && activeScannedStudent.evalRecord.images.length > 0)
                          ? activeScannedStudent.evalRecord.images
                          : [{ url: activeScannedStudent.evalRecord.photo_url }];
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: imgs.length === 1 ? "1fr" : "repeat(auto-fit, minmax(110px, 1fr))", gap: "6px" }}>
                            {imgs.map((imgItem: any, imgIdx: number) => {
                              const u = typeof imgItem === 'string' ? imgItem : (imgItem?.url || '');
                              if (!u) return null;
                              const isStage2 = imgItem?.stage === 'stage2' || (selectedProject?.multi_stage_enabled && imgIdx === 1);
                              const stageTitle = selectedProject?.multi_stage_enabled
                                ? (isStage2 ? (selectedProject.stage2_title || 'العمل النهائي') : (selectedProject.stage1_title || 'مرحلة التحضير'))
                                : (imgs.length > 1 ? `صورة #${imgIdx + 1}` : 'معاينة');
                              return (
                                <div
                                  key={imgIdx}
                                  onClick={() => openZoomImage(u)}
                                  style={{ position: "relative", width: "100%", height: "110px", background: "#000000", borderRadius: "6px", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}
                                >
                                  <img src={u} alt={stageTitle} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                                  <div style={{ position: "absolute", top: "4px", right: "4px", background: isStage2 ? "rgba(16, 185, 129, 0.9)" : "rgba(37, 99, 235, 0.9)", color: "#ffffff", padding: "1px 5px", borderRadius: "4px", fontSize: "9px", fontWeight: 500 }}>
                                    {stageTitle}
                                  </div>
                                  <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(0, 0, 0, 0.8)", color: "#ffffff", padding: "2px 5px", borderRadius: "4px", fontSize: "9px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <Maximize2 size={9} strokeWidth={1.5} />
                                    <span>تكبير</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-secondary)", fontSize: "11px", textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", width: "100%" }}>
                      <Clock size={13} strokeWidth={1.5} color="var(--text-muted)" />
                      <span>لم يقم الطالب برفع صورة لهذا المشروع بعد.</span>
                    </div>
                  )}
                </div>

                {/* QUICK GRADE GRID & MANUAL INPUT */}
                <div style={{ marginBottom: "6px" }}>
                  <label className="tabular-nums" style={{ display: "block", color: "var(--text-secondary)", fontSize: "11px", marginBottom: "6px" }}>
                    اختر الدرجة السريعة (0 إلى {selectedProject.max_score}):
                  </label>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))",
                    gap: "6px",
                    maxHeight: "130px",
                    overflowY: "auto",
                    padding: "2px",
                    marginBottom: "10px"
                  }}>
                    {getQuickGrades(selectedProject.max_score).map(score => {
                      const isSelected = cameraScoreInput === score.toString() || (cameraScoreInput === "" && activeScannedStudent.score === score);
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleQuickGradeSelect(score)}
                          className="tabular-nums"
                          style={{
                            width: "100%",
                            margin: 0,
                            padding: 0,
                            height: "38px",
                            background: isSelected ? "var(--success)" : "var(--bg-deep)",
                            color: isSelected ? "#ffffff" : "var(--text)",
                            border: isSelected ? "1px solid var(--success)" : "1px solid var(--border-light)",
                            borderRadius: "8px",
                            fontSize: "14px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.15s var(--ease-out), border-color 0.15s var(--ease-out)"
                          }}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>

                  {/* MANUAL GRADE INPUT & SAVE BUTTON */}
                  <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--success-ink)", fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>
                      <Edit3 size={13} strokeWidth={1.5} />
                      <span>كتابة الدرجة يدوياً وحفظ التقييم:</span>
                    </label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                      <input
                        id="cameraGradeInput"
                        type="number"
                        min="0"
                        max={selectedProject.max_score}
                        step="any"
                        value={cameraScoreInput}
                        onChange={(e) => setCameraScoreInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveCameraScannedStudent();
                          }
                        }}
                        placeholder={`0 - ${selectedProject.max_score}`}
                        className="tabular-nums"
                        style={{
                          flex: "1",
                          padding: "10px 12px",
                          background: "var(--surface)",
                          border: "1.5px solid var(--success)",
                          borderRadius: "8px",
                          color: "var(--text)",
                          fontSize: "16px",
                          fontWeight: 600,
                          textAlign: "center",
                          outline: "none",
                          margin: 0
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveCameraScannedStudent}
                        disabled={savingActiveStudent || cameraScoreInput === ""}
                        style={{
                          width: "auto",
                          margin: 0,
                          padding: "10px 16px",
                          background: (savingActiveStudent || cameraScoreInput === "")
                            ? "var(--surface-hover)"
                            : "var(--success)",
                          color: (savingActiveStudent || cameraScoreInput === "") ? "var(--text-muted)" : "#ffffff",
                          border: (savingActiveStudent || cameraScoreInput === "") ? "1px solid var(--border-light)" : "1px solid var(--success)",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 500,
                          cursor: (savingActiveStudent || cameraScoreInput === "") ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          whiteSpace: "nowrap"
                        }}
                      >
                        <Save size={15} strokeWidth={1.5} />
                        <span>{savingActiveStudent ? "جاري الحفظ..." : "حفظ ومتابعة المسح"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCANNED BATCH LIST */}
            {scannedStudents.length > 0 && !activeScannedStudent && (
              <div style={{ marginTop: "12px", flexGrow: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span className="tabular-nums" style={{ color: "var(--warning-ink)", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <ClipboardList size={15} strokeWidth={1.5} />
                    <span>المسجلين بالجلسة ({scannedStudents.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleBatchSaveEvaluations}
                    disabled={savingBatch}
                    className="tabular-nums"
                    style={{ width: "auto", margin: 0, background: "var(--success)", color: "#ffffff", border: "1px solid var(--success)", padding: "6px 12px", borderRadius: "6px", fontWeight: 500, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Save size={14} strokeWidth={1.5} />
                    <span>{savingBatch ? "جاري الحفظ..." : `حفظ الكل (${scannedStudents.length})`}</span>
                  </button>
                </div>

                <div style={{ flexGrow: 1, overflowY: "auto", maxHeight: "200px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {scannedStudents.map((s, idx) => {
                    const isMakeup = s.student.isMakeup || course?.makeup_students?.includes(s.student.id) || s.student.section === "تخلفات";
                    const sTag = getStudentTag(s.student, course?.teacher_id);
                    return (
                      <div
                        key={idx}
                        onClick={() => setTaggingStudent(s.student)}
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        title="انقر لتصنيف الطالب (متميز / غير ملتزم)"
                      >
                        <div>
                          <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span>{s.student.full_name}</span>
                            {isMakeup && (
                              <span style={{ background: "rgba(244, 63, 94, 0.14)", color: "#fda4af", border: "1px solid rgba(244, 63, 94, 0.3)", fontSize: "10px", padding: "1px 5px", borderRadius: "4px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                <Repeat size={10} strokeWidth={1.5} />
                                <span>تخلفات</span>
                              </span>
                            )}
                            {sTag === "distinguished" && (
                              <span style={{ background: "rgba(245, 158, 11, 0.14)", color: "var(--warning-ink)", border: "1px solid rgba(245, 158, 11, 0.3)", fontSize: "10px", padding: "1px 5px", borderRadius: "4px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                <Star size={10} strokeWidth={1.5} />
                                <span>متميز</span>
                              </span>
                            )}
                            {sTag === "uncommitted" && (
                              <span style={{ background: "rgba(239, 68, 68, 0.14)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "10px", padding: "1px 5px", borderRadius: "4px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                <AlertTriangle size={10} strokeWidth={1.5} />
                                <span>غير ملتزم</span>
                              </span>
                            )}
                          </div>
                          <div className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "11px" }}>كود: {s.student.student_code} • س: {s.student.section}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="tabular-nums" style={{ background: "var(--success)", color: "#ffffff", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", fontSize: "12px" }}>{s.score ?? 0}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveScannedStudent(idx); }} style={{ width: "auto", margin: 0, background: "none", border: "none", color: "var(--error-ink)", cursor: "pointer", padding: "2px 4px", display: "inline-flex", alignItems: "center" }}>
                            <X size={14} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUICK STUDENT TAGGING MODAL */}
      {taggingStudent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.72)", zIndex: 2000, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }} onClick={() => setTaggingStudent(null)}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "340px", borderRadius: "16px", padding: "20px", textAlign: "center", border: "1px solid var(--border-light)", direction: "rtl", boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "var(--text)", margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>{taggingStudent.full_name}</h3>
            <p className="tabular-nums" style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 14px 0" }}>كود: {taggingStudent.student_code}</p>

            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Tag size={13} strokeWidth={1.5} color="var(--accent-ink)" />
              <span>تصنيف الطالب (مرئي لك فقط)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <button
                type="button"
                onClick={async () => {
                  await setStudentTag(taggingStudent, 'distinguished', course?.teacher_id);
                  setTaggingStudent(null);
                }}
                style={{ background: getStudentTag(taggingStudent, course?.teacher_id) === 'distinguished' ? "rgba(245, 158, 11, 0.25)" : "var(--bg-deep)", color: "var(--warning-ink)", border: "1px solid rgba(245, 158, 11, 0.4)", padding: "10px 6px", borderRadius: "8px", fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", margin: 0 }}
              >
                <Star size={13} strokeWidth={1.5} />
                <span>طالب متميز</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await setStudentTag(taggingStudent, 'uncommitted', course?.teacher_id);
                  setTaggingStudent(null);
                }}
                style={{ background: getStudentTag(taggingStudent, course?.teacher_id) === 'uncommitted' ? "rgba(239, 68, 68, 0.22)" : "var(--bg-deep)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.4)", padding: "10px 6px", borderRadius: "8px", fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", margin: 0 }}
              >
                <AlertTriangle size={13} strokeWidth={1.5} />
                <span>غير ملتزم</span>
              </button>
            </div>
            {getStudentTag(taggingStudent, course?.teacher_id) && (
              <button
                type="button"
                onClick={async () => {
                  await setStudentTag(taggingStudent, null, course?.teacher_id);
                  setTaggingStudent(null);
                }}
                style={{ background: "transparent", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", padding: "8px", borderRadius: "8px", fontSize: "11px", width: "100%", cursor: "pointer", marginBottom: "10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              >
                <X size={12} strokeWidth={1.5} />
                <span>إزالة علامة التصنيف</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setTaggingStudent(null)}
              style={{ background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", padding: "10px", borderRadius: "8px", width: "100%", cursor: "pointer", fontSize: "13px", fontWeight: 500, margin: 0 }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* PROJECT STATS MODAL */}
      {statsProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.78)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: "12px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "600px", maxHeight: "92vh", display: "flex", flexDirection: "column", borderRadius: "16px", border: "1px solid var(--border-light)", direction: "rtl", padding: "18px", boxSizing: "border-box" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, color: "var(--accent-ink)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                  <BarChart3 size={18} strokeWidth={1.5} />
                  <span>إحصائيات: {statsProject.name}</span>
                </h3>
                <div className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "3px" }}>الدرجة العظمى: {statsProject.max_score} درجة</div>
              </div>
              <button
                type="button"
                onClick={() => { setStatsProject(null); setStatsData(null); }}
                className="btn-compact"
                title="إغلاق"
                style={{ width: "30px", height: "30px", padding: 0, margin: 0, background: "var(--surface-hover)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {loadingStatsModal ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)", fontSize: "13px" }}>جاري تحميل إحصائيات المشروع والطلاب...</div>
            ) : statsData ? (() => {
              const filteredSubmitted = statsData.submitted.filter(s => {
                if (statsModalSectionFilter !== "ALL" && String(s.section) !== statsModalSectionFilter) return false;
                if (statsSearchQuery.trim()) {
                  const q = statsSearchQuery.trim().toLowerCase();
                  return (s.full_name && s.full_name.toLowerCase().includes(q)) || (s.student_code && s.student_code.includes(q));
                }
                return true;
              });

              const filteredMissing = statsData.missing.filter(s => {
                if (statsModalSectionFilter !== "ALL" && String(s.section) !== statsModalSectionFilter) return false;
                if (statsSearchQuery.trim()) {
                  const q = statsSearchQuery.trim().toLowerCase();
                  return (s.full_name && s.full_name.toLowerCase().includes(q)) || (s.student_code && s.student_code.includes(q));
                }
                return true;
              });

              const totalInFilter = statsModalSectionFilter === "ALL"
                ? (statsData.submitted.length + statsData.missing.length)
                : ((studentsCountBySection[statsModalSectionFilter] || 0) || (filteredSubmitted.length + filteredMissing.length));

              return (
                <div style={{ overflowY: "auto", flexGrow: 1, display: "flex", flexDirection: "column" }}>

                  {/* Section & Search Controls */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    {course?.sections && course.sections.length > 1 && (
                      <select
                        value={statsModalSectionFilter}
                        onChange={(e) => setStatsModalSectionFilter(e.target.value)}
                        className="tabular-nums"
                        style={{ flex: 1, padding: "8px 10px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", fontSize: "12px", outline: "none", margin: 0 }}
                      >
                        <option value="ALL">جميع السكاشن ({statsData.submitted.length + statsData.missing.length})</option>
                        {course.sections.map((sec: string) => (
                          <option key={sec} value={sec}>
                            سكشن {sec} ({studentsCountBySection[sec] || 0} طالب)
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      placeholder="بحث بالاسم أو الكود..."
                      value={statsSearchQuery}
                      onChange={(e) => setStatsSearchQuery(e.target.value)}
                      style={{ flex: 1, padding: "8px 10px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", fontSize: "12px", outline: "none", margin: 0 }}
                    />
                  </div>

                  {/* Counts Overview */}
                  <div className="tabular-nums" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px", textAlign: "center" }}>
                    <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 8px" }}>
                      <div style={{ color: "var(--text-secondary)", fontSize: "10px" }}>المطلوب منهم</div>
                      <div style={{ color: "var(--accent-ink)", fontSize: "18px", fontWeight: 600, marginTop: "2px" }}>{totalInFilter}</div>
                    </div>
                    <div
                      onClick={() => setStatsModalTab('submitted')}
                      style={{ background: statsModalTab === 'submitted' ? "rgba(16, 185, 129, 0.14)" : "var(--bg-deep)", border: `1px solid ${statsModalTab === 'submitted' ? 'var(--success)' : 'rgba(16, 185, 129, 0.3)'}`, borderRadius: "8px", padding: "10px 8px", cursor: "pointer" }}
                    >
                      <div style={{ color: "var(--success-ink)", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={11} strokeWidth={1.5} />
                        <span>تم تقييمهم</span>
                      </div>
                      <div style={{ color: "var(--success-ink)", fontSize: "18px", fontWeight: 600, marginTop: "2px" }}>{filteredSubmitted.length}</div>
                    </div>
                    <div
                      onClick={() => setStatsModalTab('missing')}
                      style={{ background: statsModalTab === 'missing' ? "rgba(239, 68, 68, 0.14)" : "var(--bg-deep)", border: `1px solid ${statsModalTab === 'missing' ? 'var(--error)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: "8px", padding: "10px 8px", cursor: "pointer" }}
                    >
                      <div style={{ color: "var(--error-ink)", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <XCircle size={11} strokeWidth={1.5} />
                        <span>متأخرين</span>
                      </div>
                      <div style={{ color: "var(--error-ink)", fontSize: "18px", fontWeight: 600, marginTop: "2px" }}>{filteredMissing.length}</div>
                    </div>
                  </div>

                  {/* Tabs Selector */}
                  <div className="tabular-nums" style={{ display: "flex", gap: "6px", marginBottom: "10px", background: "var(--bg-deep)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    <button
                      type="button"
                      onClick={() => setStatsModalTab('submitted')}
                      style={{ flex: 1, padding: "8px", background: statsModalTab === 'submitted' ? "var(--success)" : "transparent", color: statsModalTab === 'submitted' ? "#ffffff" : "var(--text-secondary)", border: "none", borderRadius: "6px", fontWeight: 500, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", margin: 0 }}
                    >
                      <CheckCircle2 size={13} strokeWidth={1.5} />
                      <span>قائمة المقيمين ({filteredSubmitted.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatsModalTab('missing')}
                      style={{ flex: 1, padding: "8px", background: statsModalTab === 'missing' ? "var(--error)" : "transparent", color: statsModalTab === 'missing' ? "#ffffff" : "var(--text-secondary)", border: "none", borderRadius: "6px", fontWeight: 500, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", margin: 0 }}
                    >
                      <XCircle size={13} strokeWidth={1.5} />
                      <span>قائمة المتأخرين ({filteredMissing.length})</span>
                    </button>
                  </div>

                  {/* Export PDF Button */}
                  {statsModalTab === 'submitted' && filteredSubmitted.length > 0 && (
                    <button
                      type="button"
                      onClick={() => exportEvaluatedStudentsPdf(statsProject, filteredSubmitted)}
                      style={{ width: "100%", margin: "0 0 10px 0", background: "var(--success)", color: "#ffffff", border: "1px solid var(--success)", padding: "9px", borderRadius: "8px", fontWeight: 500, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <Printer size={14} strokeWidth={1.5} />
                      <span>طباعة / تصدير كشف المقيمين (PDF)</span>
                    </button>
                  )}
                  {statsModalTab === 'missing' && filteredMissing.length > 0 && (
                    <button
                      type="button"
                      onClick={() => exportMissingStudentsPdf(statsProject, filteredMissing)}
                      style={{ width: "100%", margin: "0 0 10px 0", background: "var(--error)", color: "#ffffff", border: "1px solid var(--error)", padding: "9px", borderRadius: "8px", fontWeight: 500, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <Printer size={14} strokeWidth={1.5} />
                      <span>طباعة / تصدير كشف المتأخرين (PDF)</span>
                    </button>
                  )}

                  {/* Student List Render */}
                  <div className="tabular-nums" style={{ flexGrow: 1, maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {statsModalTab === 'submitted' ? (
                      filteredSubmitted.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>لا يوجد طلاب مقيمين مطابقين للشروط الحالية.</div>
                      ) : (
                        filteredSubmitted.map((s, idx) => (
                          <div key={s.id || idx} style={{ background: "var(--bg-deep)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "8px", padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                            <div>
                              <span style={{ color: "var(--text)", fontWeight: 600 }}>{idx + 1}. {s.full_name}</span>
                              <span style={{ color: "var(--text-muted)", fontSize: "10px", marginRight: "6px" }}>كود: {s.student_code} • س: {s.section || 'عام'}</span>
                            </div>
                            <div style={{ textAlign: "left", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ color: "var(--success-ink)", fontWeight: 600, fontSize: "13px" }}>{s.eval?.score ?? '-'} / {statsProject.max_score}</span>
                              {s.eval?.photo_url && (
                                <button
                                  type="button"
                                  onClick={() => openZoomImage(s.eval.photo_url)}
                                  title="عرض الصورة"
                                  style={{ width: "auto", margin: 0, padding: "4px 6px", background: "var(--surface)", color: "var(--accent-ink)", border: "1px solid var(--border-light)", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                                >
                                  <ImageIcon size={12} strokeWidth={1.5} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      filteredMissing.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>لا يوجد طلاب متأخرين مطابقين للشروط الحالية.</div>
                      ) : (
                        filteredMissing.map((s, idx) => (
                          <div key={s.id || idx} style={{ background: "var(--bg-deep)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "8px", padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                            <div>
                              <span style={{ color: "var(--text)", fontWeight: 600 }}>{idx + 1}. {s.full_name}</span>
                              <span style={{ color: "var(--text-muted)", fontSize: "10px", marginRight: "6px" }}>كود: {s.student_code} • س: {s.section || 'عام'}</span>
                            </div>
                            <span style={{ color: "var(--error-ink)", fontSize: "11px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <XCircle size={12} strokeWidth={1.5} />
                              <span>لم يرفع</span>
                            </span>
                          </div>
                        ))
                      )
                    )}
                  </div>

                </div>
              );
            })() : null}
          </div>
        </div>
      )}

      {/* IMAGE ZOOM MODAL (WITH SAFE POPSTATE / BACK BUTTON) */}
      {zoomImage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.94)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <button
            type="button"
            onClick={closeZoomImage}
            title="إغلاق"
            style={{ position: "absolute", top: "16px", right: "16px", background: "var(--surface)", border: "1px solid var(--border-light)", color: "var(--text)", width: "38px", height: "38px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: 0, padding: 0 }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
          <img src={zoomImage} alt="Zoomed Artwork" style={{ maxWidth: "95%", maxHeight: "85%", objectFit: "contain", borderRadius: "8px" }} />
          <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "10px" }}>اضغط على زر الإغلاق أو زر الرجوع بالهاتف للعودة للتقييم</div>
        </div>
      )}

      {/* ADD PROJECT MODAL */}
      {showAddProjectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.78)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", padding: "20px", borderRadius: "16px", border: "1px solid var(--border-light)", direction: "rtl", boxSizing: "border-box" }}>
            <h3 style={{ color: "var(--warning-ink)", margin: "0 0 14px 0", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Plus size={18} strokeWidth={1.5} />
              <span>إضافة وتخصيص مشروع جديد</span>
            </h3>

            <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "5px", textAlign: "right" }}>اسم المشروع:</label>
            <input
              type="text"
              placeholder="مثال: لوحة الطبيعة الصامتة"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", marginBottom: "12px", textAlign: "right", fontSize: "14px", outline: "none" }}
            />

            <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "5px", textAlign: "right" }}>الدرجة القصوى للمشروع:</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="50"
              value={newProjectMaxScore}
              onChange={e => setNewProjectMaxScore(e.target.value)}
              className="tabular-nums"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", marginBottom: "14px", textAlign: "center", fontSize: "16px", fontWeight: 600, outline: "none" }}
            />

            {/* إعدادات بوابة الطلاب والرفع */}
            <div style={{ background: "var(--bg-deep)", borderRadius: "12px", padding: "12px", marginBottom: "16px", border: "1px solid var(--border)" }}>
              <div style={{ color: "var(--accent-ink)", fontWeight: 600, fontSize: "13px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <GraduationCap size={15} strokeWidth={1.5} />
                <span>إعدادات الرفع عبر بوابة الطلاب</span>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text)", fontSize: "13px", cursor: "pointer", marginBottom: "10px" }}>
                <input
                  type="checkbox"
                  checked={newProjectPortalEnabled}
                  onChange={e => setNewProjectPortalEnabled(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--accent-ink)" }}
                />
                <span style={{ fontWeight: 500 }}>تفعيل استقبال صور المشروع عبر بوابة الطلاب</span>
              </label>

              {newProjectPortalEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px dashed var(--border-light)", paddingTop: "10px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "11px", marginBottom: "4px" }}>نمط الصور المطلوبة:</label>
                      <select
                        value={newProjectRequiredPhotos}
                        onChange={(e: any) => setNewProjectRequiredPhotos(Number(e.target.value))}
                        style={{ width: "100%", padding: "8px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text)", fontSize: "12px", margin: 0 }}
                      >
                        <option value={1}>صورة واحدة</option>
                        <option value={2}>صورتان</option>
                        <option value={3}>3 صور</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "11px", marginBottom: "4px" }}>وضع الكاميرا:</label>
                      <select
                        value={newProjectCameraMode}
                        onChange={(e: any) => setNewProjectCameraMode(e.target.value)}
                        style={{ width: "100%", padding: "8px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text)", fontSize: "12px", margin: 0 }}
                      >
                        <option value="2d">لوحة مسطحة (2D)</option>
                        <option value="3d">عمل مجسم (3D)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ color: "var(--text-secondary)", fontSize: "11px" }}>آخر موعد لرفع الصور (المهلة):</label>
                      <button
                        type="button"
                        onClick={() => setNewProjectDeadline(getSuggestedDeadline())}
                        style={{ background: "rgba(56, 189, 248, 0.14)", color: "var(--accent-ink)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "4px", padding: "2px 6px", fontSize: "10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", margin: 0 }}
                      >
                        <Clock size={10} strokeWidth={1.5} />
                        <span>قبل التقييم (بعد 6 أيام)</span>
                      </button>
                    </div>
                    <input
                      type="datetime-local"
                      value={newProjectDeadline}
                      onChange={e => setNewProjectDeadline(e.target.value)}
                      className="tabular-nums"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", margin: 0 }}
                    />
                  </div>

                  {/* خيار العمل متعدد المراحل */}
                  <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "8px", padding: "10px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--warning-ink)", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={newProjectMultiStage}
                        onChange={e => setNewProjectMultiStage(e.target.checked)}
                        style={{ width: "16px", height: "16px", accentColor: "var(--warning)" }}
                      />
                      <Palette size={14} strokeWidth={1.5} />
                      <span>تقسيم الرفع لمرحلتين (مرحلة تحضير + عمل نهائي)</span>
                    </label>

                    {newProjectMultiStage && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                        <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--accent-ink)", fontSize: "11px", fontWeight: 600 }}>المرحلة 1 (التحضير والتجهيز):</span>
                          <input
                            type="text"
                            placeholder="عنوان المرحلة 1"
                            value={newProjectStage1Title}
                            onChange={e => setNewProjectStage1Title(e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "4px", color: "var(--text)", fontSize: "11px", marginTop: "4px", marginBottom: "4px" }}
                          />
                          <label style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>آخر موعد للمرحلة 1:</label>
                          <input
                            type="datetime-local"
                            value={newProjectStage1Deadline}
                            onChange={e => setNewProjectStage1Deadline(e.target.value)}
                            className="tabular-nums"
                            style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "4px", color: "var(--text)", fontSize: "11px", margin: 0 }}
                          />
                        </div>

                        <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--success-ink)", fontSize: "11px", fontWeight: 600 }}>المرحلة 2 (الإنهاء والعمل المكتمل):</span>
                          <input
                            type="text"
                            placeholder="عنوان المرحلة 2"
                            value={newProjectStage2Title}
                            onChange={e => setNewProjectStage2Title(e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "4px", color: "var(--text)", fontSize: "11px", marginTop: "4px", marginBottom: "4px" }}
                          />
                          <label style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>آخر موعد للمرحلة 2:</label>
                          <input
                            type="datetime-local"
                            value={newProjectStage2Deadline}
                            onChange={e => setNewProjectStage2Deadline(e.target.value)}
                            className="tabular-nums"
                            style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "4px", color: "var(--text)", fontSize: "11px", margin: 0 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={saveNewProject} style={{ flex: 1, margin: 0, background: "var(--success)", color: "#ffffff", border: "1px solid var(--success)", padding: "11px", borderRadius: "8px", fontWeight: 500, fontSize: "13px", cursor: "pointer" }}>حفظ المشروع</button>
              <button type="button" onClick={() => setShowAddProjectModal(false)} style={{ flex: 1, margin: 0, background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", padding: "11px", borderRadius: "8px", fontWeight: 500, fontSize: "13px", cursor: "pointer" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* EASTER EGG MODAL */}
      {showEasterEgg && easterEggData && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 999, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px", borderBottom: "2px solid #0f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0a0a0a" }}>
            <h1 style={{ color: "#0f0", margin: 0, fontFamily: "monospace", fontSize: "18px" }}>// CLASSIFIED_REPORT</h1>
            <button type="button" onClick={() => setShowEasterEgg(false)} style={{ width: "auto", margin: 0, background: "none", border: "none", color: "#0f0", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
          <div style={{ position: "relative", flexGrow: 1, overflowY: "auto", padding: "16px", direction: "rtl", color: "#0f0", fontFamily: "monospace" }}>
            <div style={{ border: "1px dashed #0f0", padding: "12px", marginBottom: "16px" }}>
              <div style={{ opacity: 0.7 }}>[TARGET_IDENTIFIED]</div>
              <div style={{ fontSize: "18px", fontWeight: 600, marginTop: "8px" }}>{easterEggData.student.full_name}</div>
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
                  <span>{ev.project_name}</span><span style={{ fontWeight: 600 }}>{ev.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MANAGE PROJECT MODAL */}
      {showManageProjectModal && longPressProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.78)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", padding: "20px", borderRadius: "16px", border: "1px solid var(--border-light)", direction: "rtl", textAlign: "right", boxSizing: "border-box" }}>
            <h3 style={{ color: "var(--accent-ink)", margin: "0 0 14px 0", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Settings size={18} strokeWidth={1.5} />
              <span>تعديل وإدارة إعدادات المشروع</span>
            </h3>

            <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "5px" }}>اسم المشروع:</label>
            <input
              type="text"
              value={editProjectName}
              onChange={e => setEditProjectName(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", marginBottom: "12px", textAlign: "right", fontSize: "14px", outline: "none" }}
            />

            <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500, marginBottom: "5px" }}>الدرجة القصوى للمشروع:</label>
            <input
              type="number"
              inputMode="decimal"
              value={editProjectMaxScore}
              onChange={e => setEditProjectMaxScore(e.target.value)}
              className="tabular-nums"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", marginBottom: "14px", textAlign: "center", fontSize: "16px", fontWeight: 600, outline: "none" }}
            />

            {/* إعدادات بوابة الطلاب والرفع */}
            <div style={{ background: "var(--bg-deep)", borderRadius: "12px", padding: "12px", marginBottom: "16px", border: "1px solid var(--border)" }}>
              <div style={{ color: "var(--accent-ink)", fontWeight: 600, fontSize: "13px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <GraduationCap size={15} strokeWidth={1.5} />
                <span>إعدادات الرفع عبر بوابة الطلاب</span>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text)", fontSize: "13px", cursor: "pointer", marginBottom: "10px" }}>
                <input
                  type="checkbox"
                  checked={editProjectPortalEnabled}
                  onChange={e => setEditProjectPortalEnabled(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--accent-ink)" }}
                />
                <span style={{ fontWeight: 500 }}>تفعيل استقبال صور المشروع عبر بوابة الطلاب</span>
              </label>

              {editProjectPortalEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px dashed var(--border-light)", paddingTop: "10px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "11px", marginBottom: "4px" }}>نمط الصور المطلوبة:</label>
                      <select
                        value={editProjectRequiredPhotos}
                        onChange={(e: any) => setEditProjectRequiredPhotos(Number(e.target.value))}
                        style={{ width: "100%", padding: "8px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text)", fontSize: "12px", margin: 0 }}
                      >
                        <option value={1}>صورة واحدة</option>
                        <option value={2}>صورتان</option>
                        <option value={3}>3 صور</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", color: "var(--text-secondary)", fontSize: "11px", marginBottom: "4px" }}>وضع الكاميرا:</label>
                      <select
                        value={editProjectCameraMode}
                        onChange={(e: any) => setEditProjectCameraMode(e.target.value)}
                        style={{ width: "100%", padding: "8px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text)", fontSize: "12px", margin: 0 }}
                      >
                        <option value="2d">لوحة مسطحة (2D)</option>
                        <option value="3d">عمل مجسم (3D)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ color: "var(--text-secondary)", fontSize: "11px" }}>آخر موعد لرفع الصور (المهلة):</label>
                      <button
                        type="button"
                        onClick={() => setEditProjectDeadline(getSuggestedDeadline())}
                        style={{ background: "rgba(56, 189, 248, 0.14)", color: "var(--accent-ink)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "4px", padding: "2px 6px", fontSize: "10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", margin: 0 }}
                      >
                        <Clock size={10} strokeWidth={1.5} />
                        <span>قبل التقييم (بعد 6 أيام)</span>
                      </button>
                    </div>
                    <input
                      type="datetime-local"
                      value={editProjectDeadline}
                      onChange={e => setEditProjectDeadline(e.target.value)}
                      className="tabular-nums"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", margin: 0 }}
                    />
                  </div>

                  {/* خيار العمل متعدد المراحل */}
                  <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "8px", padding: "10px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--warning-ink)", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={editProjectMultiStage}
                        onChange={e => setEditProjectMultiStage(e.target.checked)}
                        style={{ width: "16px", height: "16px", accentColor: "var(--warning)" }}
                      />
                      <Palette size={14} strokeWidth={1.5} />
                      <span>تقسيم الرفع لمرحلتين (مرحلة تحضير + عمل نهائي)</span>
                    </label>

                    {editProjectMultiStage && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                        <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--accent-ink)", fontSize: "11px", fontWeight: 600 }}>المرحلة 1 (التحضير والتجهيز):</span>
                          <input
                            type="text"
                            placeholder="عنوان المرحلة 1"
                            value={editProjectStage1Title}
                            onChange={e => setEditProjectStage1Title(e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "4px", color: "var(--text)", fontSize: "11px", marginTop: "4px", marginBottom: "4px" }}
                          />
                          <label style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>آخر موعد للمرحلة 1:</label>
                          <input
                            type="datetime-local"
                            value={editProjectStage1Deadline}
                            onChange={e => setEditProjectStage1Deadline(e.target.value)}
                            className="tabular-nums"
                            style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "4px", color: "var(--text)", fontSize: "11px", margin: 0 }}
                          />
                        </div>

                        <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--success-ink)", fontSize: "11px", fontWeight: 600 }}>المرحلة 2 (الإنهاء والعمل المكتمل):</span>
                          <input
                            type="text"
                            placeholder="عنوان المرحلة 2"
                            value={editProjectStage2Title}
                            onChange={e => setEditProjectStage2Title(e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "4px", color: "var(--text)", fontSize: "11px", marginTop: "4px", marginBottom: "4px" }}
                          />
                          <label style={{ display: "block", color: "var(--text-muted)", fontSize: "10px" }}>آخر موعد للمرحلة 2:</label>
                          <input
                            type="datetime-local"
                            value={editProjectStage2Deadline}
                            onChange={e => setEditProjectStage2Deadline(e.target.value)}
                            className="tabular-nums"
                            style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "4px", color: "var(--text)", fontSize: "11px", margin: 0 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button type="button" onClick={updateProject} style={{ width: "100%", margin: 0, background: "var(--primary)", color: "#ffffff", border: "1px solid var(--primary)", padding: "11px", borderRadius: "8px", fontWeight: 500, fontSize: "13px", cursor: "pointer" }}>حفظ التعديلات</button>
              <button type="button" onClick={() => { if(confirm("هل أنت متأكد من نقل هذا المشروع للأرشيف؟ لن يظهر في القائمة بعد الآن.")) archiveProject(); }} style={{ width: "100%", margin: 0, background: "rgba(245, 158, 11, 0.14)", color: "var(--warning-ink)", border: "1px solid rgba(245, 158, 11, 0.35)", padding: "10px", borderRadius: "8px", fontWeight: 500, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <Archive size={14} strokeWidth={1.5} />
                <span>نقل المشروع للأرشيف</span>
              </button>
              <button type="button" onClick={deleteProjectPermanently} style={{ width: "100%", margin: 0, background: "rgba(239, 68, 68, 0.14)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.35)", padding: "10px", borderRadius: "8px", fontWeight: 500, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <Trash2 size={14} strokeWidth={1.5} />
                <span>حذف المشروع نهائياً</span>
              </button>
              <button type="button" onClick={() => setShowManageProjectModal(false)} style={{ width: "100%", margin: 0, background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", padding: "10px", borderRadius: "8px", fontWeight: 500, fontSize: "12px", cursor: "pointer" }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* No Photo Warning Modal */}
      {noPhotoWarning && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0, 0, 0, 0.78)", zIndex: 99999, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"
        }}>
          <div style={{ maxWidth: "380px", width: "100%", textAlign: "center", border: "1px solid rgba(239, 68, 68, 0.45)", padding: "24px", borderRadius: "16px", background: "var(--surface)", direction: "rtl", boxSizing: "border-box" }}>
            <div style={{
              width: "52px",
              height: "52px",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--error-ink)",
              marginBottom: "12px"
            }}>
              <Camera size={24} strokeWidth={1.5} />
            </div>
            <h3 style={{ color: "var(--error-ink)", fontSize: "16px", fontWeight: 600, margin: "0 0 10px 0" }}>
              لم يقم الطالب برفع صورة المشروع
            </h3>
            <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", marginBottom: "14px", textAlign: "right" }}>
              <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "14px" }}>{noPhotoWarning.student.full_name}</div>
              <div className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "12px", marginTop: "4px" }}>
                كود: {noPhotoWarning.student.student_code} • سكشن: {noPhotoWarning.student.section}
              </div>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px", margin: "0 0 18px 0", lineHeight: 1.6 }}>
              لم يتم العثور على أي صورة مسجلة أو مرفوعة لهذا المشروع من قِبل الطالب حتى الآن. هل ترغب في المتابعة ورصد الدرجة يدوياً؟
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  const data = noPhotoWarning;
                  setNoPhotoWarning(null);
                  if (data.mode === 'CAMERA') {
                    setActiveScannedStudent(data.studentWithData);
                  } else {
                    setTargetStudent({ ...data.student, attCount: data.attCount, evalRecord: data.ex });
                    setManualScore(data.ex && data.ex.score && data.ex.score > 0 ? data.ex.score.toString() : "");
                    setTimeout(() => document.getElementById("manualGradeInput")?.focus(), 100);
                  }
                }}
                style={{ flex: 1, padding: "11px", background: "var(--warning)", color: "#ffffff", border: "1px solid var(--warning)", borderRadius: "8px", fontWeight: 500, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", margin: 0 }}
              >
                <AlertTriangle size={14} strokeWidth={1.5} />
                <span>تقييم على أي حال</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoPhotoWarning(null);
                  setTargetStudent(null);
                  setActiveScannedStudent(null);
                  setSearchInput("");
                }}
                style={{ flex: 1, padding: "11px", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: "8px", fontWeight: 500, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", margin: 0 }}
              >
                <X size={14} strokeWidth={1.5} />
                <span>إلغاء</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
