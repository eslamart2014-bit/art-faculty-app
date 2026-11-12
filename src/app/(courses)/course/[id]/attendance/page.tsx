"use client";

import { useEffect, useState, use, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  FileText,
  FolderOpen,
  Megaphone,
  Menu,
  Plus,
  Repeat,
  Settings,
  Sparkles,
  Star,
  Tag,
  Trash2,
  X
} from "lucide-react";
import { supabase } from "@/lib/core/supabase";
import { addToQueue, getLocalCache, setLocalCache } from "@/lib/admin/syncEngine";
import { getCurrentWeekRange } from "@/lib/core/dateHelpers";
const QRScanner = dynamic(() => import("@/components/scanner/QRScanner"), { ssr: false, loading: () => <div style={{padding: "20px", textAlign: "center"}}>جاري تحميل الكاميرا...</div> });

import { extractStudentCode, getStudentCodeVariants, buildStudentCodeFilter, normalizeAcademicYear } from "@/lib/students/codeHelper";
import { playScanClickSound, playScanErrorSound, playScanAlreadyAttendedSound, initScannerAudio } from "@/lib/courses/audioHelper";
import { getStudentTag, setStudentTag } from "@/lib/students/studentTagsHelper";
import { formatInstructorTitle } from "@/lib/courses/academicHelper";

const getWeekRangeFromKey = (key: string) => {
  const start = new Date(key);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getTodayLocalDateStr = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getEffectiveSaveDate = (weekKey: string) => {
  const todayStr = getTodayLocalDateStr();
  const { start, end } = getWeekRangeFromKey(weekKey);
  const startStr = getTodayLocalDateStr(start);
  const endStr = getTodayLocalDateStr(end);
  if (todayStr >= startStr && todayStr <= endStr) {
    return todayStr;
  }
  return weekKey;
};

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  
  // 1. Direct attendance cache read (0ms)
  const initialAttCache = typeof window !== 'undefined'
    ? getLocalCache(`cache_attendance_${resolvedParams.id}`)
    : null;

  // 2. Fallback: Lookup course in cached_courses
  const fallbackCourse = !initialAttCache?.course && typeof window !== 'undefined'
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

  const currentCourse = initialAttCache?.course || fallbackCourse;

  // 3. Fallback: Lookup students for this academic year from local store
  const fallbackStudents = !initialAttCache?.students && currentCourse && typeof window !== 'undefined'
    ? (() => {
        try {
          const yearStudents = getLocalCache(`cached_students_${currentCourse.academic_year}`) || [];
          if (currentCourse.course_type === 'sections' && Array.isArray(currentCourse.sections) && currentCourse.sections.length > 0) {
            return yearStudents.filter((s: any) => currentCourse.sections.includes(s.section));
          }
          return yearStudents;
        } catch(e) {}
        return [];
      })()
    : [];

  const initialStudents = (initialAttCache?.students && initialAttCache.students.length > 0)
    ? initialAttCache.students
    : fallbackStudents;

  const [course, setCourse] = useState<any>(() => currentCourse);
  const [systemTerms, setSystemTerms] = useState<any>(() => initialAttCache?.systemTerms || getLocalCache("cached_system_settings") || null);
  const [students, setStudents] = useState<any[]>(() => initialStudents);
  const [makeupStudents, setMakeupStudents] = useState<any[]>(() => initialAttCache?.makeupStudents || []);
  const [attendance, setAttendance] = useState<any[]>(() => initialAttCache?.attendance || []);
  const [instructorName, setInstructorName] = useState<string>(() => initialAttCache?.instructorName || "........................");
  
  // Selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => {
    if (initialAttCache?.attendance) {
      return new Set<string>(
        (initialAttCache.attendance as any[])
          .filter((a: any) => a.status === "حاضر")
          .map((a: any) => String(a.student_id))
      );
    }
    return new Set<string>();
  });
  
  const [selectedSection, setSelectedSection] = useState<string>(() => {
    if (currentCourse?.course_type === 'lectures') return 'محاضرات';
    if (currentCourse?.sections && currentCourse.sections.length > 0) return currentCourse.sections[0];
    return '';
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const isCamera = new URLSearchParams(window.location.search).get("mode") === "camera";
      if (isCamera) return false;
      return !currentCourse;
    }
    return true;
  });

  useEffect(() => {
    const cached = getLocalCache(`cache_attendance_${resolvedParams.id}`);
    if (cached) {
      if (cached.course) setCourse(cached.course);
      if (cached.systemTerms) setSystemTerms(cached.systemTerms);
      if (cached.students) setStudents(cached.students);
      if (cached.makeupStudents) setMakeupStudents(cached.makeupStudents);
      if (cached.instructorName) setInstructorName(cached.instructorName);
      if (cached.allAttendances) setAllAttendances(cached.allAttendances);
      if (cached.attendance) {
        setAttendance(cached.attendance);
        const presentIds = new Set<string>(
          (cached.attendance as any[])
            .filter((a: any) => a.status === "حاضر")
            .map((a: any) => String(a.student_id))
        );
        setSelectedStudentIds(presentIds);
      }
      if (cached.totalWeeksCount) setTotalWeeksCount(cached.totalWeeksCount);
      setLoading(false);
    }
  }, [resolvedParams.id]);

  // Auto-open camera scanner if navigated from camera shortcut (?mode=camera)
  useEffect(() => {
    if (searchParams.get("mode") === "camera") {
      setShowCameraScanner(true);
    }
  }, [searchParams]);


  // Camera handled by QRScanner component

  const [saving, setSaving] = useState(false);

  // Modals state
  const [longPressStudent, setLongPressStudent] = useState<any>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetSection, setTargetSection] = useState("");
  
  // Settings Modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [absenceLimit, setAbsenceLimit] = useState("3");

  // Week Picker state
  const [showWeeksModal, setShowWeeksModal] = useState(false);
  const [renameWeekKey, setRenameWeekKey] = useState<string | null>(null);
  const [showWeekRenameModal, setShowWeekRenameModal] = useState(false);
  const [customWeekName, setCustomWeekName] = useState("");

  // Scanner & Makeup specific state - instant open if ?mode=camera
  const [showCameraScanner, setShowCameraScanner] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get("mode") === "camera";
    }
    return false;
  });
  const [scannedStudents, setScannedStudents] = useState<any[]>([]);
  const [latestScannedStudentId, setLatestScannedStudentId] = useState<string | null>(null);
  const scannedListRef = useRef<HTMLDivElement>(null);
  const [savingBatch, setSavingBatch] = useState(false);

  const [showMakeupModal, setShowMakeupModal] = useState(false);
  const [makeupInputCode, setMakeupInputCode] = useState("");
  const [makeupCameraActive, setMakeupCameraActive] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [scannerStatusText, setScannerStatusText] = useState<string>("");
  const isProcessingScanRef = useRef(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      isProcessingScanRef.current = false;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    };
  }, []);

  const { startOfWeek, endOfWeek } = getCurrentWeekRange();
  const currentWeekKey = startOfWeek.toISOString().split('T')[0];
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(currentWeekKey);

  const [allAttendances, setAllAttendances] = useState<any[]>([]);
  const [totalWeeksCount, setTotalWeeksCount] = useState(0);

  const generateWeeks = () => {
    const arabicNumbers = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"];
    
    let termStartDateStr: string | null = null;
    const courseCreatedAt = course?.created_at ? new Date(course.created_at) : new Date();

    if (systemTerms) {
      const t2s = systemTerms.term2_start;
      const t1s = systemTerms.term1_start;
      
      if (t2s && (courseCreatedAt >= new Date(t2s + "T00:00:00") || new Date() >= new Date(t2s + "T00:00:00"))) {
        termStartDateStr = t2s;
      } else if (t1s) {
        termStartDateStr = t1s;
      }
    }

    let startRefDate: Date;
    if (termStartDateStr) {
      const [y, m, d] = termStartDateStr.split('-').map(Number);
      startRefDate = new Date(y, m - 1, d, 0, 0, 0);
    } else {
      startRefDate = course?.created_at ? new Date(course.created_at) : new Date();
    }

    const dayOfWeek = startRefDate.getDay();
    const daysToSubtract = (dayOfWeek + 1) % 7; 
    const termStart = new Date(startRefDate);
    termStart.setDate(startRefDate.getDate() - daysToSubtract);
    termStart.setHours(0, 0, 0, 0);

    const { startOfWeek: currentWeekStart } = getCurrentWeekRange();
    
    const weeksList: any[] = [];
    let current = new Date(termStart);
    let index = 0;
    
    if (current > currentWeekStart) {
      const key = current.toISOString().split('T')[0];
      const end = new Date(current);
      end.setDate(current.getDate() + 6);
      const startStr = current.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
      const endStr = end.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
      weeksList.push({
        key,
        defaultName: "الأسبوع الأول",
        subtitle: `من ${startStr} إلى ${endStr}`,
      });
      return weeksList;
    }
    
    while (current <= currentWeekStart) {
      const key = current.toISOString().split('T')[0];
      
      const end = new Date(current);
      end.setDate(current.getDate() + 6);
      
      const startStr = current.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
      const endStr = end.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
      
      const defaultName = `الأسبوع ${arabicNumbers[index] || (index + 1)}`;
      
      weeksList.push({
        key,
        defaultName,
        subtitle: `من ${startStr} إلى ${endStr}`,
      });
      
      current.setDate(current.getDate() + 7);
      index++;
    }
    
    return weeksList.reverse();
  };


  useEffect(() => {
    if (course) {
      const weeks = generateWeeks();
      if (weeks.length > 0 && !weeks.some(w => w.key === selectedWeekKey)) {
        setSelectedWeekKey(weeks[0].key);
      }
    }
  }, [course, systemTerms]);

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id, selectedWeekKey]);

  
  useEffect(() => {
    const handleRefresh = () => fetchData();
    window.addEventListener('refreshData', handleRefresh);
    return () => window.removeEventListener('refreshData', handleRefresh);
  }, [course, selectedWeekKey]);
  const fetchData = async () => {
    // Silent background fetch — NEVER block screen with a loading spinner if course exists
    if (!course && !currentCourse) setLoading(true);
    
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OFFLINE_TIMEOUT")), 2500)
      );

      const [courseRes, termsData] = await Promise.race([
        Promise.all([
          supabase.from("courses").select("*").eq("id", resolvedParams.id).single(),
          fetch("/api/public/settings", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        ]),
        timeoutPromise
      ]) as any;
      const courseData = courseRes.data;
      if (termsData) {
        setSystemTerms(termsData);
      }

      if (courseData) {
        setCourse(courseData);

        const { start: wStart, end: wEnd } = getWeekRangeFromKey(selectedWeekKey);
        const wStartStr = getTodayLocalDateStr(wStart);
        const wEndStr = getTodayLocalDateStr(wEnd);

        const studentsPromise = supabase
          .from("students")
          .select("id, full_name, student_code, academic_year, section, is_active")
          .eq("academic_year", courseData.academic_year)
          .eq("is_active", true);

        const makeupPromise = (courseData.makeup_students && courseData.makeup_students.length > 0)
          ? supabase.from("students").select("id, full_name, student_code, academic_year, section, is_active").in("id", courseData.makeup_students).eq("is_active", true)
          : Promise.resolve({ data: [] });

        const allAttPromise = supabase
          .from("attendance")
          .select("student_id, date")
          .eq("course_id", resolvedParams.id);

        const currentAttPromise = supabase
          .from("attendance")
          .select("id, student_id, date, status, course_id")
          .eq("course_id", resolvedParams.id)
          .gte("date", wStartStr)
          .lte("date", wEndStr);

        const userPromise = supabase.auth.getUser();

        const [studentsRes, makeupRes, allAttRes, attRes, userRes] = await Promise.race([
          Promise.all([
            studentsPromise,
            makeupPromise,
            allAttPromise,
            currentAttPromise,
            userPromise
          ]),
          timeoutPromise
        ]) as any;

        const loadedStudents = (studentsRes.data || []).filter((s: any) => s.is_active !== false);
        setStudents(loadedStudents);

        const loadedMakeup = (makeupRes.data || []).filter((s: any) => s.is_active !== false);
        if (courseData.makeup_students && courseData.makeup_students.length > 0) {
          setMakeupStudents(loadedMakeup);
        }

        let instName = instructorName;
        if (userRes.data?.user) {
          const { data: profile } = await supabase.from("profiles").select("full_name, degree, role").eq("id", userRes.data.user.id).single();
          if (profile && profile.full_name) {
            instName = formatInstructorTitle(profile);
            setInstructorName(instName);
          }
        }

        const loadedAllAtt = allAttRes.data || [];
        setAllAttendances(loadedAllAtt);

        const distinctWeekStarts = new Set();
        loadedAllAtt.forEach((a: any) => {
           const d = new Date(a.date);
           const dayOfWeek = d.getDay();
           const daysToSubtract = (dayOfWeek + 1) % 7; 
           const start = new Date(d);
           start.setDate(d.getDate() - daysToSubtract);
           distinctWeekStarts.add(start.toISOString().split('T')[0]);
        });
        const countWeeks = distinctWeekStarts.size;
        setTotalWeeksCount(countWeeks);

        const loadedAtt = attRes.data || [];
        setAttendance(loadedAtt);
        const presentIds = new Set<string>(
          (loadedAtt as any[])
            .filter((a: any) => a.status === "حاضر")
            .map((a: any) => String(a.student_id))
        );
        setSelectedStudentIds(presentIds);

        // Update local persistent cache for instant offline access
        setLocalCache(`cache_attendance_${resolvedParams.id}`, {
          course: courseData,
          systemTerms: termsData,
          students: loadedStudents,
          makeupStudents: loadedMakeup,
          instructorName: instName,
          allAttendances: loadedAllAtt,
          attendance: loadedAtt,
          totalWeeksCount: countWeeks
        });
      }
    } catch (err) {
      console.log("Offline mode active: using cached attendance data");
    } finally {
      setLoading(false);
    }
  };

  const getWeekDisplayName = (key = selectedWeekKey) => {
    if (course?.custom_week_names && course.custom_week_names[key]) {
      return course.custom_week_names[key];
    }
    const weeks = generateWeeks();
    const w = weeks.find(x => x.key === key);
    return w ? w.defaultName : "أسبوع مجهول";
  };

  const handleSaveWeekName = async () => {
    if (!renameWeekKey) return;
    const updatedNames = { ...(course.custom_week_names || {}), [renameWeekKey]: customWeekName };
    await supabase.from("courses").update({ custom_week_names: updatedNames }).eq("id", course.id);
    setCourse({ ...course, custom_week_names: updatedNames });
    setShowWeekRenameModal(false);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStudentIds(newSet);
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const saveDate = getEffectiveSaveDate(selectedWeekKey);
      const displayIds = getDisplayStudents().map(s => s.id);
      const toDeleteIds = displayIds.filter(id => 
        !selectedStudentIds.has(id) && 
        attendance.some(a => a.student_id === id && a.status === "حاضر")
      );
      const toInsertIds = displayIds.filter(id => 
        selectedStudentIds.has(id) && 
        !attendance.some(a => a.student_id === id && a.status === "حاضر")
      );

      // 1. Instant Optimistic UI update! (0ms!)
      const updatedAttendance = attendance
        .filter(a => !toDeleteIds.includes(a.student_id))
        .concat(toInsertIds.map(id => ({
          id: "temp_" + id + "_" + Date.now(),
          course_id: course.id,
          student_id: id,
          date: saveDate,
          status: "حاضر",
          teacher_id: course.teacher_id
        })));
      
      setAttendance(updatedAttendance);
      vibrateSuccess();

      // Update local cache immediately
      const cached = getLocalCache(`cache_attendance_${course.id}`);
      if (cached) {
        cached.attendance = updatedAttendance;
        setLocalCache(`cache_attendance_${course.id}`, cached);
      }

      // 2. Background Sync
      if (!navigator.onLine) {
        addToQueue('BULK_ATTENDANCE', { course_id: course.id, date: saveDate, presentIds: toInsertIds, absentIds: toDeleteIds, teacher_id: course.teacher_id });
        return;
      }

      try {
        if (toDeleteIds.length > 0) {
          const recordsToDelete = attendance.filter(a => toDeleteIds.includes(a.student_id));
          if (recordsToDelete.length > 0) {
            await supabase.from("attendance").delete().in("id", recordsToDelete.map(r => r.id));
            try {
              fetch('/api/push/notify-attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  student_ids: toDeleteIds,
                  course_id: course.id,
                  date: saveDate,
                  action: 'cancelled'
                })
              }).catch(() => {});
            } catch (_) {}
          }
        }
        if (toInsertIds.length > 0) {
          const inserts = toInsertIds.map(id => ({
            course_id: course.id,
            student_id: id,
            date: saveDate,
            status: "حاضر",
            teacher_id: course.teacher_id
          }));
          await supabase.from("attendance").insert(inserts);
          try {
            fetch('/api/push/notify-attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ student_ids: toInsertIds, course_id: course.id, date: saveDate })
            }).catch(() => {});
          } catch (_) {}
        }
      } catch (err) {
        addToQueue('BULK_ATTENDANCE', { course_id: course.id, date: saveDate, presentIds: toInsertIds, absentIds: toDeleteIds, teacher_id: course.teacher_id });
      }
    } finally {
      setSaving(false);
    }
  };

  // --- CROSS-COURSE MAKEUP LOGIC ---
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

    // Heavy rough vibration for student from another cohort + display full details
    vibrateHeavyError();
    setScannerStatus('error');
    setScannerStatusText(`طالب مقيد بفرقة أخرى: ${globalStudent.full_name} (${globalStudent.academic_year} - سكشن ${globalStudent.section})`);
    
    await new Promise(r => setTimeout(r, 100));
    const confirmAdd = window.confirm(`بيانات الطالب:\n• الاسم: ${globalStudent.full_name}\n• الفرقة: ${globalStudent.academic_year}\n• السكشن: ${globalStudent.section}\n• الكود: ${globalStudent.student_code || code}\n\nالطالب غير مدرج في قوائم هذا المقرر (${course?.name || ''}).\nهل تود ضمه كطالب تخلفات / مستمع الآن؟`);
    
    if (confirmAdd) {
      const updatedMakeup = [...(course.makeup_students || []), globalStudent.id];
      await supabase.from("courses").update({ makeup_students: updatedMakeup }).eq("id", course.id);
      
      // Update local state without full reload to save time
      setCourse({ ...course, makeup_students: updatedMakeup });
      setMakeupStudents([...makeupStudents, globalStudent]);
      
      vibrateSuccess();
      return globalStudent;
    }
    return null;
  };

  const checkStudentLocalOrGlobal = async (code: string) => {
    const isMakeup = course.makeup_students && course.makeup_students.length > 0;
    const variants = getStudentCodeVariants(code);
    const filter = buildStudentCodeFilter(variants);
    
    // First, find the student globally by code variants
    let student: any = null;
    try {
      const { data } = await supabase
        .from("students")
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

    const inMakeup = isMakeup && course.makeup_students.includes(student.id);
    const isSameYear = normalizeAcademicYear(student.academic_year) === normalizeAcademicYear(course.academic_year);
    const inCourseSections = (!course.sections || course.sections.length === 0 || course.sections.includes(student.section)) && isSameYear;

    if (inMakeup || inCourseSections) {
      return student;
    }

    // If not in the course naturally or via makeup, trigger makeup prompt with full details
    return await handleCrossCourseMakeup(code, student);
  };


  // --- CAMERA LOGIC: Exact requested haptic patterns & tactile audio ---
  // 1. First-time valid scan: single vibration (100ms) with tactile click sound
  const vibrateSuccess = () => { 
    playScanClickSound();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100); 
  };
  // 2. Duplicate scan: two rapid vibrations
  const vibrateDuplicate = () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([70, 40, 70]); };
  // 2.5. Already attended this week: distinct chime & vibration
  const vibrateAlreadyAttended = () => { 
    playScanAlreadyAttendedSound();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([120, 60, 120]); 
  };
  // 3. Heavy error vibration (wrong code / different cohort / invalid)
  const vibrateHeavyError = () => { 
    playScanErrorSound();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([250, 70, 250, 70, 400]); 
  };

  const handleCameraScan = async (decodedText: string) => {
    if (!decodedText || !showCameraScanner || isProcessingScanRef.current || scannerStatus !== 'idle') return;

    isProcessingScanRef.current = true;

    const cleanCode = extractStudentCode(decodedText) || decodedText.trim();
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

    try {
      const student = await checkStudentLocalOrGlobal(cleanCode);
      if (student) {
        // فحص ما إذا كان الطالب تم تحضيره مسبقاً هذا الأسبوع
        const isAlreadyInDb = attendance.some(a => String(a.student_id) === String(student.id) && a.status === 'حاضر');
        const isAlreadySelected = selectedStudentIds.has(student.id);
        const isAlreadyInSession = scannedStudents.some(s => s.id === student.id || s.student_code === student.student_code);

        if (isAlreadyInDb || isAlreadySelected || isAlreadyInSession) {
          setScannerStatus('error');
          setScannerStatusText(`تم تحضير الطالب هذا الأسبوع مسبقاً (${student.full_name})`);
          vibrateAlreadyAttended();
          setTimeout(() => {
            setScannerStatus('idle');
            setScannerStatusText("");
            isProcessingScanRef.current = false;
          }, 1200);
          return;
        }

        // إذا لم يكن مسجلاً، يُضاف لقائمة الحضور فوراً
        setScannedStudents(prev => [student, ...prev]);
        setLatestScannedStudentId(student.id);
        setScannerStatus('success');
        setScannerStatusText(`تم الرصد: ${student.full_name}`);
        vibrateSuccess();

        // التمرير التلقائي السلس لأعلى القائمة لضمان رؤية الطالب فوراً بدون سكرول
        setTimeout(() => {
          if (scannedListRef.current) {
            scannedListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 50);

        setTimeout(() => {
          setScannerStatus('idle');
          setScannerStatusText("");
          isProcessingScanRef.current = false;
        }, 800);
      } else {
        setScannerStatus('error');
        setScannerStatusText("طالب غير مسجل في المقرر");
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

  const startCameraScanner = () => {
    initScannerAudio();
    setShowCameraScanner(true);
  };

  const closeCameraScanner = () => {
    isProcessingScanRef.current = false;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
    setShowCameraScanner(false);
    setScannedStudents([]);
    setLatestScannedStudentId(null);
    if (searchParams.get("mode") === "camera") {
      router.push("/");
    }
  };

  const saveBatchCameraAttendance = async () => {
    if (scannedStudents.length === 0) return;
    const saveDate = getEffectiveSaveDate(selectedWeekKey);
    
    // 1. Instant Optimistic UI (0ms!)
    const newAtt = [...attendance];
    for (const s of scannedStudents) {
      const existing = newAtt.find(a => a.student_id === s.id && a.date === saveDate);
      if (existing) {
        existing.status = "حاضر";
      } else {
        newAtt.push({
          id: "temp_" + s.id + "_" + Date.now(),
          course_id: course.id,
          student_id: s.id,
          date: saveDate,
          status: "حاضر",
          teacher_id: course.teacher_id
        });
      }
    }
    setAttendance(newAtt);
    
    const newSelected = new Set(selectedStudentIds);
    scannedStudents.forEach(s => newSelected.add(s.id));
    setSelectedStudentIds(newSelected);

    // Save to local cache
    const cached = getLocalCache(`cache_attendance_${course.id}`);
    if (cached) {
      cached.attendance = newAtt;
      setLocalCache(`cache_attendance_${course.id}`, cached);
    }

    vibrateSuccess();
    closeCameraScanner();
    setSavingBatch(false);

    // 2. Background Sync
    if (!navigator.onLine) {
      addToQueue('CAMERA_ATTENDANCE', { course_id: course.id, date: saveDate, students: scannedStudents, teacher_id: course.teacher_id });
      return;
    }

    try {
      for (const s of scannedStudents) {
        await supabase.from("attendance").upsert({
          course_id: course.id,
          student_id: s.id,
          date: saveDate,
          status: "حاضر",
          teacher_id: course.teacher_id
        }, { onConflict: 'course_id,student_id,date' });
      }
      try {
        fetch('/api/push/notify-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_ids: scannedStudents.map((s: any) => s.id),
            course_id: course.id,
            date: saveDate
          })
        }).catch(() => {});
      } catch (_) {}
    } catch (err) {
      addToQueue('CAMERA_ATTENDANCE', { course_id: course.id, date: saveDate, students: scannedStudents, teacher_id: course.teacher_id });
    }
  };
  // --------------------

  // Long press logic
  const handleWeekTouchStart = (key: string, defaultName: string) => {
    pressTimer.current = setTimeout(() => {
      setRenameWeekKey(key);
      setCustomWeekName(course?.custom_week_names?.[key] || defaultName);
      setShowWeekRenameModal(true);
      setShowWeeksModal(false);
    }, 600); // 600ms long press
  };

  const handleTouchStart = (student: any) => {
    pressTimer.current = setTimeout(() => {
      setLongPressStudent(student);
    }, 600); // 600ms long press
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleRemoveStudentFromCourse = async () => {
    if (!confirm("هل أنت متأكد من إخفاء هذا الطالب من مقررك نهائياً؟")) return;
    
    // Add to archives
    await supabase.from("archives").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      item_type: "student",
      description: `إخفاء الطالب: ${longPressStudent.full_name} من المقرر`,
      original_data: { course_id: course.id, student_id: longPressStudent.id }
    });

    const updatedExcluded = [...(course.excluded_students || []), longPressStudent.id];
    await supabase.from("courses").update({ excluded_students: updatedExcluded }).eq("id", course.id);
    setCourse({ ...course, excluded_students: updatedExcluded });
    setLongPressStudent(null);
  };

  const handleMoveToSectionClick = () => {
    if (course.course_type === "lectures") {
      alert("هذا المقرر بنظام المحاضرات (فرقة كاملة)، لا يوجد سكاشن لنقل الطالب إليها.");
      return;
    }
    setTargetSection(course.sections[0] || "");
    setShowMoveModal(true);
  };

  const handleConfirmMove = async () => {
    if (!targetSection) return;
    const overrides = { ...(course.student_section_overrides || {}), [longPressStudent.id]: targetSection };
    await supabase.from("courses").update({ student_section_overrides: overrides }).eq("id", course.id);
    setCourse({ ...course, student_section_overrides: overrides });
    setLongPressStudent(null);
    setShowMoveModal(false);
  };

  const handleCancelAttendancePast = async () => {
    const record = attendance.find(a => a.student_id === longPressStudent.id);
    if (record) {
      await supabase.from("attendance").delete().eq("id", record.id);
      try {
        fetch('/api/push/notify-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_ids: [longPressStudent.id],
            course_id: course.id,
            date: record.date,
            action: 'cancelled'
          })
        }).catch(() => {});
      } catch (_) {}
      setAttendance(attendance.filter(a => a.id !== record.id));
      
      const newSet = new Set(selectedStudentIds);
      newSet.delete(longPressStudent.id);
      setSelectedStudentIds(newSet);
      alert("تم إلغاء غياب الطالب بنجاح.");
    } else {
      alert("الطالب غير مسجل كحاضر في هذا الأسبوع لكي يتم إلغاؤه.");
    }
    setLongPressStudent(null);
  };

  const handleAddMakeupStudentSubmit = async (code: string) => {
    if (!code) return;
    if (makeupStudents.some(s => s.student_code === code)) {
      alert("هذا الطالب مضاف بالفعل في قائمة التخلفات.");
      return;
    }

    setSaving(true);
    const { data: student, error } = await supabase.from("students").select("*").eq("student_code", code.trim()).single();

    if (error || !student) {
      alert("لم يتم العثور على طالب بهذا الكود في قاعدة البيانات.");
      setSaving(false);
      return;
    }

    const confirmed = window.confirm(`بيانات الطالب:\nالاسم: ${student.full_name}\nالفرقة: ${student.academic_year}\nالسكشن: ${student.section || 'عام'}\n\nهل أنت متأكد من إضافة هذا الطالب كـ (تخلفات) لهذا المقرر؟`);
    if (!confirmed) {
      setSaving(false);
      return;
    }

    const updatedMakeup = [...(course.makeup_students || []), student.id];
    await supabase.from("courses").update({ makeup_students: updatedMakeup }).eq("id", course.id);
    setCourse({ ...course, makeup_students: updatedMakeup });
    setMakeupStudents([...makeupStudents, student]);
    alert(`تمت إضافة الطالب ${student.full_name} إلى التخلفات بنجاح.`);
    setShowMakeupModal(false);
    setMakeupInputCode("");
    setSaving(false);
    
    if (makeupCameraActive) {
      setMakeupCameraActive(false);
    }
  };

  const handleMakeupScan = (decodedText: string) => {
    if (!decodedText || !makeupCameraActive) return;
    vibrateSuccess();
    setMakeupCameraActive(false);
    const cleanCode = extractStudentCode(decodedText);
    setMakeupInputCode(cleanCode);
    handleAddMakeupStudentSubmit(cleanCode);
  };

  const startMakeupCamera = () => {
    setMakeupCameraActive(true);
  };

  const getDisplayStudents = () => {
    let list: any[] = [];
    const overrides = course?.student_section_overrides || {};
    const excluded = course?.excluded_students || [];

    const activeStudents = students.filter(s => !excluded.includes(s.id));
    const activeMakeup = makeupStudents.filter(s => !excluded.includes(s.id));

    if (!selectedSection) return [];

    if (selectedSection === "تخلفات") {
      const overriddenToHere = activeStudents.filter(s => overrides[s.id] === "تخلفات");
      const nativeMakeup = activeMakeup.filter(s => !overrides[s.id] || overrides[s.id] === "تخلفات");
      list = [...nativeMakeup.map(s => ({ ...s, isMakeup: true })), ...overriddenToHere];
    } else if (course?.course_type === "lectures") {
      list = activeStudents;
    } else {
      const nativeHere = activeStudents.filter(s => s.section === selectedSection && !overrides[s.id]);
      const overriddenToHere = activeStudents.filter(s => overrides[s.id] === selectedSection);
      const makeupHere = activeMakeup.filter(s => overrides[s.id] === selectedSection).map(s => ({ ...s, isMakeup: true }));
      list = [...nativeHere, ...overriddenToHere, ...makeupHere];
    }
    
    return list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
  };

  const getWarningsList = () => {
    const limit = Number(absenceLimit);
    if (isNaN(limit)) return [];
    
    const excluded = course?.excluded_students || [];
    const activeStudents = students.filter(s => !excluded.includes(s.id));
    const activeMakeup = makeupStudents.filter(s => !excluded.includes(s.id));
    const allStds = [...activeStudents, ...activeMakeup.map(s => ({ ...s, isMakeup: true }))];

    const warnings: any[] = [];
    allStds.forEach(s => {
      const presences = allAttendances.filter(a => a.student_id === s.id).length;
      const absences = totalWeeksCount - presences;
      if (absences >= limit) {
        warnings.push({ ...s, absences, presences });
      }
    });
    return warnings.sort((a, b) => b.absences - a.absences || a.full_name.localeCompare(b.full_name, 'ar'));
  };

  const handlePrintWarnings = async () => {
    const warnings = getWarningsList();
    const limit = Number(absenceLimit);
    if (warnings.length === 0) {
      alert("ممتاز! لا يوجد أي طلاب تجاوزوا حد الغياب المحدد حتى الآن.");
      return;
    }

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">م</th>
            <th>اسم الطالب</th>
            <th style="width: 100px;">القسم/الفرقة</th>
            <th style="width: 100px;">السكشن</th>
            <th style="width: 100px;">مرات الغياب</th>
          </tr>
        </thead>
        <tbody>
          ${warnings.map((w, index) => `
            <tr>
              <td>${index + 1}</td>
              <td style="text-align: right; padding-right: 15px;">${w.full_name} ${w.isMakeup ? '(تخلفات)' : ''}</td>
              <td>${w.department || '-'}</td>
              <td>${w.isMakeup ? 'تخلفات' : w.section || '-'}</td>
              <td><strong>${w.absences}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    await (await import("@/lib/courses/downloadPdf")).downloadPdf(
      "warnings.pdf",
      course?.name || "",
      "إنذار تجاوز نسبة الغياب",
      `إنذار أولي لتجاوز نسبة الغياب (${limit} مرات فأكثر) من إجمالي ${totalWeeksCount} أسابيع فعلية.`,
      tableHtml,
      instructorName
    );
  };

  const handleSendTelegramWarnings = async () => {
    const warnings = getWarningsList();
    if (warnings.length === 0) {
      alert("لا يوجد متجاوزين لإرسال إنذارات لهم.");
      return;
    }
    const limit = Number(absenceLimit);
    
    if (!window.confirm(`سيتم إرسال إنذار فوري عبر التليجرام لعدد (${warnings.length}) طلاب متجاوزين.\nمتابعة؟`)) return;
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/bot/notify_warning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ warnings, courseName: course.name, limit })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`تم إرسال الإنذار بنجاح إلى ${data.count} طلاب لديهم حسابات تليجرام مربوطة.`);
      } else {
        alert("خطأ: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("فشل الإرسال.");
    }
    setSaving(false);
  };

  if (loading && !course && !showCameraScanner) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column", background: "var(--background)" }}>
        <div className="loader-circle"></div>
        <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "12px" }}>جاري التحميل...</div>
      </div>
    );
  }

  const displayStudents = getDisplayStudents();

  let pendingChangesCount = 0;
  displayStudents.forEach(s => {
    const isSelected = selectedStudentIds.has(s.id);
    const isInDb = attendance.some(a => a.student_id === s.id && a.status === "حاضر");
    if (isSelected !== isInDb) {
      pendingChangesCount++;
    }
  });

  return (
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: "var(--background)", position: "relative" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", direction: "rtl" }}>
        <button
          type="button"
          className="hide-on-mobile btn-compact"
          onClick={() => {
            if (searchParams.get("mode") === "camera") {
              router.push("/");
            } else {
              router.push(`/course/${course.id}`);
            }
          }}
          style={{
            background: "var(--surface-hover)",
            border: "1px solid var(--border-light)",
            color: "var(--text)",
            padding: "6px 12px",
            borderRadius: "8px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 500,
            margin: 0
          }}
        >
          <ArrowRight size={15} strokeWidth={1.5} />
          <span>عودة</span>
        </button>
        <h2 style={{ margin: 0, color: "var(--success-ink)", fontSize: "16px", fontWeight: 600 }}>تسجيل الحضور</h2>
        <button
          type="button"
          className="btn-compact"
          onClick={() => setShowSettingsModal(true)}
          title="إعدادات المقرر"
          style={{
            width: "34px",
            height: "34px",
            padding: 0,
            background: "var(--surface-hover)",
            border: "1px solid var(--border-light)",
            borderRadius: "8px",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            margin: 0
          }}
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "8px", padding: "12px 16px", direction: "rtl" }}>

        <button
          type="button"
          onClick={() => setShowWeeksModal(true)}
          style={{
            flex: 1,
            background: "var(--surface)",
            border: "1px solid var(--border-light)",
            color: selectedWeekKey === currentWeekKey ? "var(--success-ink)" : "var(--warning-ink)",
            padding: "10px 8px",
            borderRadius: "8px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            fontWeight: 500,
            cursor: "pointer",
            margin: 0
          }}
        >
          <Calendar size={15} strokeWidth={1.5} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getWeekDisplayName()}</span>
        </button>

        <button
          type="button"
          onClick={startCameraScanner}
          style={{
            flex: 1,
            background: "var(--primary)",
            border: "1px solid var(--primary)",
            color: "#ffffff",
            padding: "10px 8px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            cursor: "pointer",
            margin: 0
          }}
        >
          <Camera size={15} strokeWidth={1.5} />
          <span>كاميرا</span>
        </button>

        <button
          type="button"
          onClick={() => setShowMakeupModal(true)}
          disabled={saving}
          style={{
            flex: 1,
            background: "rgba(225, 29, 72, 0.14)",
            border: "1px solid rgba(244, 63, 94, 0.35)",
            color: "#fda4af",
            padding: "10px 8px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            cursor: saving ? "not-allowed" : "pointer",
            margin: 0
          }}
        >
          <Plus size={15} strokeWidth={1.5} />
          <span>تخلفات</span>
        </button>

      </div>

      {/* Section Selector */}
      <div style={{ padding: "0 16px", direction: "rtl", marginBottom: "10px" }}>
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          style={{ width: "100%", padding: "11px 12px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "8px", color: selectedSection ? "var(--text)" : "var(--text-muted)", fontSize: "14px", outline: "none", margin: 0 }}
        >
          <option value="" disabled>الرجاء اختيار السكشن لعرض الطلاب...</option>
          {course?.course_type === "lectures" ? (
            <option value="محاضرات">محاضرات (الفرقة كاملة)</option>
          ) : (
            [...(course?.sections || [])].sort((a: string, b: string) => a.localeCompare(b, undefined, {numeric: true})).map((sec: string) => (
              <option key={sec} value={sec}>سكشن {sec}</option>
            ))
          )}
          {makeupStudents.length > 0 && (
            <option value="تخلفات">سكشن التخلفات</option>
          )}
        </select>
        <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px", paddingRight: "4px" }}>
          إجمالي الطلاب: <span style={{ color: "var(--accent-ink)", fontWeight: 600 }}>{displayStudents.length}</span> طالباً
        </div>
      </div>

      {/* Students List */}
      <div style={{ flexGrow: 1, overflowY: "auto", direction: "rtl", paddingBottom: "84px" }}>
        {!selectedSection ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", fontSize: "13px", lineHeight: 1.6 }}>
            <FolderOpen size={40} strokeWidth={1.5} color="var(--text-muted)" />
            <span>لم يتم اختيار سكشن.<br/>اختر سكشن من القائمة بالأعلى لعرض الطلاب وبدء التحضير.</span>
          </div>
        ) : displayStudents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: "13px" }}>لا يوجد طلاب في هذا القسم.</div>
        ) : (
          displayStudents.map((student) => {
            const isSelected = selectedStudentIds.has(student.id);
            const isExcused = attendance.some(a => a.student_id === student.id && a.status === 'غياب بعذر');

            let bg = "var(--surface)";
            let borderColor = "transparent";
            if (isSelected) {
              bg = "rgba(16, 185, 129, 0.12)";
              borderColor = "var(--success)";
            } else if (isExcused) {
              bg = "rgba(239, 68, 68, 0.1)";
              borderColor = "var(--error)";
            }

            return (
              <div
                key={student.id}
                onClick={() => {
                  if (isExcused) {
                    alert("هذا الطالب مسجل غياب بعذر، للإلغاء استخدم الضغط المطول ثم (إلغاء العذر).");
                    return;
                  }
                  toggleSelection(student.id);
                }}
                onTouchStart={() => handleTouchStart(student)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(student)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  background: bg,
                  borderBottom: "1px solid var(--border)",
                  borderRight: `4px solid ${borderColor}`,
                  cursor: "pointer",
                  transition: "background 0.15s var(--ease-out)"
                }}
              >
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span>{student.full_name}</span>
                    {(student.isMakeup || course?.makeup_students?.includes(student.id) || student.section === "تخلفات") && (
                      <span style={{ background: "rgba(244, 63, 94, 0.14)", color: "#fda4af", border: "1px solid rgba(244, 63, 94, 0.3)", fontSize: "10.5px", padding: "1px 6px", borderRadius: "6px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Repeat size={11} strokeWidth={1.5} />
                        <span>تخلفات</span>
                      </span>
                    )}
                    {getStudentTag(student, course?.teacher_id) === "distinguished" && (
                      <span style={{ background: "rgba(245, 158, 11, 0.14)", color: "var(--warning-ink)", border: "1px solid rgba(245, 158, 11, 0.3)", fontSize: "10.5px", padding: "1px 6px", borderRadius: "6px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Star size={11} strokeWidth={1.5} />
                        <span>متميز</span>
                      </span>
                    )}
                    {getStudentTag(student, course?.teacher_id) === "uncommitted" && (
                      <span style={{ background: "rgba(239, 68, 68, 0.14)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "10.5px", padding: "1px 6px", borderRadius: "6px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <AlertTriangle size={11} strokeWidth={1.5} />
                        <span>غير ملتزم</span>
                      </span>
                    )}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: "12px", color: isSelected ? "var(--success-ink)" : "var(--text-secondary)", marginTop: "4px" }}>
                    كود: {student.student_code}
                  </div>
                </div>
                {isSelected && <Check size={18} strokeWidth={2} color="var(--success-ink)" />}
                {isExcused && (
                  <div style={{ color: "var(--error-ink)", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                    <FileText size={16} strokeWidth={1.5} />
                    <span style={{ fontSize: "10px", fontWeight: 500 }}>بعذر</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Save Button */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "var(--background)", borderTop: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={handleSaveAttendance}
          disabled={saving || pendingChangesCount === 0}
          className="tabular-nums"
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: "10px",
            background: pendingChangesCount > 0 ? "var(--success)" : "var(--surface)",
            color: pendingChangesCount > 0 ? "#ffffff" : "var(--text-muted)",
            fontWeight: 500,
            fontSize: "15px",
            border: pendingChangesCount > 0 ? "1px solid var(--success)" : "1px solid var(--border-light)",
            cursor: pendingChangesCount > 0 && !saving ? "pointer" : "not-allowed",
            transition: "background 0.15s var(--ease-out)",
            margin: 0
          }}
        >
          {saving ? "جاري الحفظ..." : `تأكيد وحفظ التعديلات (${pendingChangesCount})`}
        </button>
      </div>

      {/* Long Press Modal */}
      {longPressStudent && (() => {
        const isExcused = attendance.some(a => a.student_id === longPressStudent.id && a.status === 'غياب بعذر');
        return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.72)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "340px", borderRadius: "16px", padding: "20px", textAlign: "center", border: "1px solid var(--border-light)", direction: "rtl", boxSizing: "border-box" }}>
            <h3 style={{ color: "var(--text)", margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>{longPressStudent.full_name}</h3>
            <p className="tabular-nums" style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 14px 0" }}>كود: {longPressStudent.student_code}</p>

            {/* تصنيف وتمييز الطالب */}
            <div style={{ background: "var(--bg-deep)", padding: "12px", borderRadius: "12px", marginBottom: "14px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Tag size={12} strokeWidth={1.5} color="var(--accent-ink)" />
                <span>تصنيف الطالب (مرئي لك فقط)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: getStudentTag(longPressStudent, course?.teacher_id) ? "8px" : "0" }}>
                <button
                  type="button"
                  onClick={async () => {
                    await setStudentTag(longPressStudent, 'distinguished', course?.teacher_id);
                    vibrateSuccess();
                    setLongPressStudent(null);
                    fetchData();
                  }}
                  style={{
                    background: getStudentTag(longPressStudent, course?.teacher_id) === 'distinguished' ? "rgba(245, 158, 11, 0.25)" : "var(--surface)",
                    color: "var(--warning-ink)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    padding: "8px 6px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    margin: 0
                  }}
                >
                  <Star size={13} strokeWidth={1.5} />
                  <span>طالب متميز</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await setStudentTag(longPressStudent, 'uncommitted', course?.teacher_id);
                    vibrateHeavyError();
                    setLongPressStudent(null);
                    fetchData();
                  }}
                  style={{
                    background: getStudentTag(longPressStudent, course?.teacher_id) === 'uncommitted' ? "rgba(239, 68, 68, 0.22)" : "var(--surface)",
                    color: "var(--error-ink)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    padding: "8px 6px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    margin: 0
                  }}
                >
                  <AlertTriangle size={13} strokeWidth={1.5} />
                  <span>غير ملتزم</span>
                </button>
              </div>
              {getStudentTag(longPressStudent, course?.teacher_id) && (
                <button
                  type="button"
                  onClick={async () => {
                    await setStudentTag(longPressStudent, null, course?.teacher_id);
                    setLongPressStudent(null);
                    fetchData();
                  }}
                  style={{ background: "transparent", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", padding: "6px", borderRadius: "6px", fontSize: "11px", width: "100%", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px", margin: 0 }}
                >
                  <X size={12} strokeWidth={1.5} />
                  <span>إزالة علامة التصنيف</span>
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {isExcused ? (
                <button
                  type="button"
                  onClick={handleCancelAttendancePast}
                  style={{ background: "var(--error)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid var(--error)", color: "#ffffff", fontSize: "14px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", margin: 0 }}
                >
                  <X size={15} strokeWidth={1.5} />
                  <span>إلغاء العذر</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancelAttendancePast}
                    style={{ background: "rgba(245, 158, 11, 0.14)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.35)", color: "var(--warning-ink)", fontSize: "14px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", margin: 0 }}
                  >
                    <X size={15} strokeWidth={1.5} />
                    <span>إلغاء حضور هذا الأسبوع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const excuse = window.prompt("أدخل سبب الغياب (مثال: مرضي، رياضي...):");
                      if (excuse !== null) {
                        const inserts = [{
                          course_id: course.id,
                          student_id: longPressStudent.id,
                          date: getEffectiveSaveDate(selectedWeekKey),
                          status: "غياب بعذر",
                          note: excuse,
                          teacher_id: course.teacher_id
                        }];
                        supabase.from("attendance").upsert(inserts, { onConflict: 'course_id,student_id,date' }).then(() => {
                          fetchData();
                        });
                        setLongPressStudent(null);
                      }
                    }}
                    style={{ background: "rgba(56, 189, 248, 0.14)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.35)", color: "var(--accent-ink)", fontSize: "14px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", margin: 0 }}
                  >
                    <FileText size={15} strokeWidth={1.5} />
                    <span>تسجيل غياب بعذر</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleMoveToSectionClick}
                style={{ background: "var(--primary)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid var(--primary)", color: "#ffffff", fontSize: "14px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", margin: 0 }}
              >
                <ArrowLeftRight size={15} strokeWidth={1.5} />
                <span>نقل الطالب لسكشن آخر</span>
              </button>
              <button
                type="button"
                onClick={handleRemoveStudentFromCourse}
                style={{ background: "rgba(239, 68, 68, 0.14)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.35)", color: "var(--error-ink)", fontSize: "14px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", margin: 0 }}
              >
                <Trash2 size={15} strokeWidth={1.5} />
                <span>حذف من مقرري نهائياً</span>
              </button>
              <button
                type="button"
                onClick={() => setLongPressStudent(null)}
                style={{ background: "var(--surface-hover)", width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500, cursor: "pointer", margin: 0 }}
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Move Section Modal */}
      {showMoveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.72)", zIndex: 110, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "340px", borderRadius: "16px", padding: "20px", textAlign: "center", border: "1px solid var(--border-light)", direction: "rtl", boxSizing: "border-box" }}>
            <h3 style={{ color: "var(--accent-ink)", margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600 }}>نقل الطالب إلى سكشن آخر</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 16px 0" }}>اختر السكشن الجديد الذي ترغب في نقل الطالب إليه:</p>

            <select
              value={targetSection}
              onChange={(e) => setTargetSection(e.target.value)}
              style={{ width: "100%", padding: "11px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", marginBottom: "14px", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
            >
              {course?.sections?.map((sec: string) => (
                <option key={sec} value={sec}>سكشن {sec}</option>
              ))}
              <option value="تخلفات">التخلفات</option>
            </select>

            <button type="button" onClick={handleConfirmMove} style={{ background: "var(--primary)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid var(--primary)", color: "#ffffff", fontSize: "14px", marginBottom: "8px", fontWeight: 500, cursor: "pointer", margin: "0 0 8px 0" }}>
              تأكيد النقل
            </button>
            <button type="button" onClick={() => setShowMoveModal(false)} style={{ background: "var(--surface-hover)", width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500, cursor: "pointer", margin: 0 }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Week Rename Modal */}
      {showWeekRenameModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.72)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "340px", borderRadius: "16px", padding: "20px", textAlign: "center", border: "1px solid var(--border-light)", direction: "rtl", boxSizing: "border-box" }}>
            <h3 style={{ color: "var(--success-ink)", margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600 }}>تسمية الأسبوع المخصصة</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 14px 0", lineHeight: 1.5 }}>أدخل اسماً مخصصاً ليظهر في التقارير (مثال: الأسبوع الأول - تدريب)</p>

            <input
              type="text"
              value={customWeekName}
              onChange={(e) => setCustomWeekName(e.target.value)}
              placeholder="اسم الأسبوع"
              style={{ width: "100%", padding: "11px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", marginBottom: "14px", textAlign: "right", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
            />

            <button type="button" onClick={handleSaveWeekName} style={{ background: "var(--success)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid var(--success)", color: "#ffffff", fontSize: "14px", marginBottom: "8px", fontWeight: 500, cursor: "pointer", margin: "0 0 8px 0" }}>
              حفظ المسمى
            </button>
            <button type="button" onClick={() => setShowWeekRenameModal(false)} style={{ background: "var(--surface-hover)", width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500, cursor: "pointer", margin: 0 }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Makeup Add Modal */}
      {showMakeupModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.78)", zIndex: 120, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: "360px", borderRadius: "16px", padding: "20px", textAlign: "center", border: "1px solid rgba(244, 63, 94, 0.35)", direction: "rtl", boxSizing: "border-box" }}>
            <h3 style={{ color: "#fda4af", margin: "0 0 14px 0", fontSize: "16px", fontWeight: 600 }}>إضافة طالب تخلفات</h3>

            {!makeupCameraActive ? (
              <>
                <input
                  type="text"
                  value={makeupInputCode}
                  onChange={(e) => setMakeupInputCode(e.target.value)}
                  placeholder="أدخل كود الطالب..."
                  className="tabular-nums"
                  style={{ width: "100%", padding: "11px 12px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text)", marginBottom: "14px", textAlign: "center", fontSize: "16px", letterSpacing: "2px", boxSizing: "border-box", outline: "none" }}
                />

                <button type="button" onClick={() => handleAddMakeupStudentSubmit(makeupInputCode)} style={{ background: "var(--success)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid var(--success)", color: "#ffffff", fontSize: "14px", marginBottom: "8px", fontWeight: 500, cursor: "pointer", margin: "0 0 8px 0" }}>
                  إضافة الآن
                </button>
                <button type="button" onClick={startMakeupCamera} style={{ background: "var(--primary)", width: "100%", padding: "11px", borderRadius: "8px", border: "1px solid var(--primary)", color: "#ffffff", fontSize: "14px", marginBottom: "8px", fontWeight: 500, display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", margin: "0 0 8px 0" }}>
                  <Camera size={16} strokeWidth={1.5} />
                  <span>مسح الكود بالكاميرا</span>
                </button>
              </>
            ) : (
              <div style={{ background: "var(--bg-deep)", borderRadius: "12px", border: "1px solid var(--border-light)", position: "relative", padding: "8px", marginBottom: "14px" }}>
                <QRScanner
                  onScan={(result) => {
                    if(result) {
                      handleAddMakeupStudentSubmit(extractStudentCode(result) || result.trim());
                      setMakeupCameraActive(false);
                    }
                  }}
                  onClose={() => setMakeupCameraActive(false)}
                  height="220px"
                />
              </div>
            )}

            <button type="button" onClick={() => {
              if (makeupCameraActive && (window as any).__mkpScanner) { (window as any).__mkpScanner.clear(); setMakeupCameraActive(false); }
              setShowMakeupModal(false);
            }} style={{ background: "var(--surface-hover)", width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500, cursor: "pointer", margin: 0 }}>
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Batch Attendance Scanner Modal */}
      {showCameraScanner && (
        <div style={{ position: "fixed", inset: 0, background: "var(--background)", zIndex: 130, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", direction: "rtl" }}>
            <h3 style={{ margin: 0, color: "var(--accent-ink)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Camera size={18} strokeWidth={1.5} />
              <span>ماسح الحضور الذكي</span>
            </h3>

            <button
              type="button"
              onClick={closeCameraScanner}
              className="btn-compact"
              title="إغلاق"
              style={{ width: "32px", height: "32px", padding: 0, borderRadius: "8px", background: "var(--surface-hover)", border: "1px solid var(--border-light)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: 0 }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div style={{ background: "var(--bg-deep)", position: "relative", padding: "10px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
            <QRScanner
              onScan={(result) => { if (result) handleCameraScan(result); }}
              isBusy={isProcessingScanRef.current || scannerStatus !== 'idle'}
              status={scannerStatus}
              statusText={scannerStatusText}
              height="240px"
              onClose={closeCameraScanner}
            />
          </div>

          <div style={{ padding: "12px 16px", background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", direction: "rtl" }}>
            <span className="tabular-nums" style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: "14px" }}>
              تم رصد: <span style={{ color: "var(--text)", fontWeight: 600 }}>{scannedStudents.length}</span> طلاب
            </span>
            <button
              type="button"
              onClick={saveBatchCameraAttendance}
              disabled={scannedStudents.length === 0 || savingBatch}
              style={{
                background: scannedStudents.length > 0 ? "var(--success)" : "var(--surface-hover)",
                color: scannedStudents.length > 0 ? "#ffffff" : "var(--text-muted)",
                border: scannedStudents.length > 0 ? "1px solid var(--success)" : "1px solid var(--border-light)",
                padding: "9px 16px",
                borderRadius: "8px",
                fontWeight: 500,
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: scannedStudents.length > 0 && !savingBatch ? "pointer" : "not-allowed",
                margin: 0
              }}
            >
              <Check size={15} strokeWidth={1.5} />
              <span>{savingBatch ? "جاري الحفظ..." : "حفظ الحضور"}</span>
            </button>
          </div>

          <div ref={scannedListRef} style={{ flexGrow: 1, overflowY: "auto", background: "var(--background)", padding: "12px", direction: "rtl" }}>
            {scannedStudents.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "32px", fontSize: "13px" }}>الطلاب الممسوحين سيظهرون هنا...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: "13px", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    <th style={{ padding: "10px", border: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 600 }}>الاسم</th>
                    <th style={{ padding: "10px", border: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 600, width: "56px" }}>السكشن</th>
                    <th style={{ padding: "10px", border: "1px solid var(--border)", color: "var(--text-secondary)", fontWeight: 600, width: "44px" }}>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedStudents.map((s, idx) => {
                    const isLatest = s.id === latestScannedStudentId;
                    const isMakeup = s.isMakeup || course?.makeup_students?.includes(s.id) || s.section === "تخلفات";
                    const sTag = getStudentTag(s, course?.teacher_id);
                    return (
                      <tr
                        key={s.id}
                        className={isLatest ? "latest-scanned-row" : ""}
                        onTouchStart={() => handleTouchStart(s)}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={() => handleTouchStart(s)}
                        onMouseUp={handleTouchEnd}
                        style={{
                          background: isLatest ? "rgba(16, 185, 129, 0.14)" : (idx % 2 === 0 ? "var(--surface)" : "var(--bg-deep)"),
                          transition: "background-color 0.2s var(--ease-out)",
                          cursor: "pointer"
                        }}
                        title="اضغط ضغطة مطولة لتصنيف الطالب (متميز / غير ملتزم)"
                      >
                        <td style={{ padding: "10px", border: "1px solid var(--border)", color: "var(--text)", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: isLatest ? 600 : 400, color: isLatest ? "var(--success-ink)" : "var(--text)" }}>
                                {s.full_name}
                              </span>
                              {isMakeup && (
                                <span style={{ background: "rgba(244, 63, 94, 0.14)", color: "#fda4af", border: "1px solid rgba(244, 63, 94, 0.3)", fontSize: "10px", padding: "1px 5px", borderRadius: "6px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                  <Repeat size={10} strokeWidth={1.5} />
                                  <span>تخلفات</span>
                                </span>
                              )}
                              {sTag === "distinguished" && (
                                <span style={{ background: "rgba(245, 158, 11, 0.14)", color: "var(--warning-ink)", border: "1px solid rgba(245, 158, 11, 0.3)", fontSize: "10px", padding: "1px 5px", borderRadius: "6px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                  <Star size={10} strokeWidth={1.5} />
                                  <span>متميز</span>
                                </span>
                              )}
                              {sTag === "uncommitted" && (
                                <span style={{ background: "rgba(239, 68, 68, 0.14)", color: "var(--error-ink)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "10px", padding: "1px 5px", borderRadius: "6px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                  <AlertTriangle size={10} strokeWidth={1.5} />
                                  <span>غير ملتزم</span>
                                </span>
                              )}
                            </div>
                            {isLatest && (
                              <span style={{
                                background: "var(--success)",
                                color: "#ffffff",
                                fontSize: "10px",
                                padding: "2px 7px",
                                borderRadius: "6px",
                                fontWeight: 500,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}>
                                <Sparkles size={10} strokeWidth={1.5} />
                                <span>أحدث رصد</span>
                              </span>
                            )}
                          </div>
                          <span className="tabular-nums" style={{ fontSize: "11px", color: isLatest ? "var(--success-ink)" : "var(--text-secondary)" }}>{s.student_code}</span>
                        </td>
                        <td className="tabular-nums" style={{ padding: "10px", border: "1px solid var(--border)", color: "var(--success-ink)", fontWeight: 600 }}>{s.section}</td>
                        <td style={{ padding: "10px", border: "1px solid var(--border)" }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setScannedStudents(prev => prev.filter(x => x.id !== s.id)); }} style={{ background: "transparent", border: "none", color: "var(--error-ink)", cursor: "pointer", padding: "4px", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: 0 }}>
                            <X size={15} strokeWidth={1.5} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal (Hamburger Menu) */}
      {showSettingsModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.72)", zIndex: 140, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ background: "var(--surface)", borderTopLeftRadius: "16px", borderTopRightRadius: "16px", padding: "20px", direction: "rtl", animation: "slideUp 0.25s var(--ease-out)", borderTop: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "14px", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "var(--text)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                <Settings size={18} strokeWidth={1.5} color="var(--accent-ink)" />
                <span>إعدادات المقرر</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="btn-compact"
                title="إغلاق"
                style={{ width: "30px", height: "30px", padding: 0, borderRadius: "8px", background: "var(--surface-hover)", border: "1px solid var(--border-light)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: 0 }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-deep)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>حد الإنذار (أسابيع الغياب):</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="number"
                    value={absenceLimit}
                    onChange={(e) => setAbsenceLimit(e.target.value)}
                    className="tabular-nums"
                    style={{ width: "54px", padding: "6px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text)", textAlign: "center", fontSize: "14px", outline: "none", margin: 0 }}
                  />
                  <button type="button" onClick={async () => {
                    const updatedNames = { ...(course.custom_week_names || {}), __absence_limit__: Number(absenceLimit) };
                    await supabase.from("courses").update({ custom_week_names: updatedNames }).eq("id", course.id);
                    setCourse({ ...course, custom_week_names: updatedNames });
                    alert("تم حفظ إعدادات الغياب بنجاح.");
                  }} style={{ background: "var(--success)", color: "#ffffff", border: "1px solid var(--success)", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", margin: 0 }}>حفظ</button>
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", textAlign: "center" }}>يُستخدم هذا الرقم لحساب قائمة الإنذارات بالأسفل.</div>
            </div>

            <div className="tabular-nums" style={{ background: "var(--bg-deep)", borderRadius: "10px", border: "1px solid var(--border)", padding: "14px", marginBottom: "16px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "var(--text-secondary)" }}>الأسابيع المسجلة (الرصد):</span>
                <span style={{ color: "var(--warning-ink)", fontWeight: 600 }}>{totalWeeksCount} أسبوع</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "var(--text-secondary)" }}>الطلاب تجاوزوا الإنذار:</span>
                <span style={{ color: "var(--error-ink)", fontWeight: 600 }}>
                  {(() => {
                    const limit = Number(absenceLimit);
                    if (isNaN(limit)) return "0";
                    const excluded = course?.excluded_students || [];
                    const activeStudents = students.filter(s => !excluded.includes(s.id));
                    const activeMakeup = makeupStudents.filter(s => !excluded.includes(s.id));
                    const allStds = [...activeStudents, ...activeMakeup];
                    let count = 0;
                    allStds.forEach(s => {
                      const presences = allAttendances.filter(a => a.student_id === s.id).length;
                      if ((totalWeeksCount - presences) >= limit) count++;
                    });
                    return count;
                  })()} طالب
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                <span style={{ color: "var(--text-secondary)" }}>إجمالي الطلاب المسجلين:</span>
                <span style={{ color: "var(--success-ink)", fontWeight: 600 }}>{students.filter(s => !(course.excluded_students || []).includes(s.id)).length} طالب</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "var(--text-secondary)" }}>تخلفات من فرق أخرى:</span>
                <span style={{ color: "#fda4af", fontWeight: 600 }}>{makeupStudents.filter(s => !(course.excluded_students || []).includes(s.id)).length} طالب</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>نظام المقرر:</span>
                <span style={{ color: "var(--accent-ink)", fontWeight: 600 }}>{course.course_type === "lectures" ? "محاضرات عامة" : "سكاشن منفصلة"}</span>
              </div>
            </div>

            <button type="button" onClick={handlePrintWarnings} style={{ width: "100%", background: "var(--error)", color: "#ffffff", border: "1px solid var(--error)", padding: "12px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", marginBottom: "8px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", margin: "0 0 8px 0" }}>
              <FileText size={16} strokeWidth={1.5} />
              <span>استخراج قائمة المنذرين بصيغة PDF</span>
            </button>
            <button type="button" onClick={handleSendTelegramWarnings} disabled={saving} style={{ width: "100%", background: "var(--primary)", color: "#ffffff", border: "1px solid var(--primary)", padding: "12px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, margin: 0 }}>
              <Megaphone size={16} strokeWidth={1.5} />
              <span>إرسال إنذار لبوابة الطلاب للمتجاوزين</span>
            </button>
          </div>
        </div>
      )}

      {/* Week Picker Modal */}
      {showWeeksModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.72)", zIndex: 120, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ background: "var(--surface)", borderTopLeftRadius: "16px", borderTopRightRadius: "16px", padding: "20px", direction: "rtl", animation: "slideUp 0.25s var(--ease-out)", maxHeight: "80vh", display: "flex", flexDirection: "column", borderTop: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "14px", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, color: "var(--text)", fontSize: "16px", fontWeight: 600 }}>اختر أسبوع التحضير</h3>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>اضغط مطولاً على أي أسبوع لتغيير اسمه (مثال: أسبوع الرسم بالرصاص)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWeeksModal(false)}
                className="btn-compact"
                title="إغلاق"
                style={{ width: "30px", height: "30px", padding: 0, borderRadius: "8px", background: "var(--surface-hover)", border: "1px solid var(--border-light)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: 0 }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ overflowY: "auto", flexGrow: 1, paddingLeft: "2px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                {generateWeeks().map((w) => {
                  const isActive = selectedWeekKey === w.key;
                  const displayName = course?.custom_week_names?.[w.key] || w.defaultName;

                  return (
                    <div
                      key={w.key}
                      onClick={() => { setSelectedWeekKey(w.key); setShowWeeksModal(false); }}
                      onTouchStart={() => handleWeekTouchStart(w.key, w.defaultName)}
                      onTouchEnd={handleTouchEnd}
                      onMouseDown={() => handleWeekTouchStart(w.key, w.defaultName)}
                      onMouseUp={handleTouchEnd}
                      onMouseLeave={handleTouchEnd}
                      style={{
                        background: isActive ? "rgba(16, 185, 129, 0.12)" : "var(--bg-deep)",
                        border: isActive ? "1px solid var(--success)" : "1px solid var(--border)",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ color: isActive ? "var(--text)" : "var(--success-ink)", fontWeight: 600, fontSize: "14px" }}>{displayName}</div>
                        <div className="tabular-nums" style={{ color: "var(--text-secondary)", fontSize: "11px", marginTop: "3px" }}>{w.subtitle}</div>
                      </div>
                      {isActive && <Check size={18} strokeWidth={2} color="var(--success-ink)" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
