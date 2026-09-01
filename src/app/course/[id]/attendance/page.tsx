"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentWeekRange } from "@/lib/dateHelpers";
import QRScanner from "@/components/QRScanner";
import { downloadPdf } from "@/lib/downloadPdf";
import { extractStudentCode } from "@/lib/scannerHelper";

const getWeekRangeFromKey = (key: string) => {
  const start = new Date(key);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  
  const [course, setCourse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [makeupStudents, setMakeupStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [instructorName, setInstructorName] = useState<string>("........................");
  
  // Selection state (instead of auto-save)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [loading, setLoading] = useState(true);

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

  // Scanner & Makeup specific state
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannedStudents, setScannedStudents] = useState<any[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);

  const [showMakeupModal, setShowMakeupModal] = useState(false);
  const [makeupInputCode, setMakeupInputCode] = useState("");
  const [makeupCameraActive, setMakeupCameraActive] = useState(false);
  const [scannerPulse, setScannerPulse] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const { startOfWeek, endOfWeek } = getCurrentWeekRange();
  const currentWeekKey = startOfWeek.toISOString().split('T')[0];
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(currentWeekKey);

  const [allAttendances, setAllAttendances] = useState<any[]>([]);
  const [totalWeeksCount, setTotalWeeksCount] = useState(0);

  const generateWeeks = () => {
    const arabicNumbers = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر"];
    
    // Find the term start date. Use created_at.
    const startCourseDate = new Date(course?.created_at || new Date());
    const dayOfWeek = startCourseDate.getDay();
    const daysToSubtract = (dayOfWeek + 1) % 7; 
    const termStart = new Date(startCourseDate);
    termStart.setDate(startCourseDate.getDate() - daysToSubtract);
    termStart.setHours(0,0,0,0);

    const { startOfWeek: currentWeekStart } = getCurrentWeekRange();
    
    const weeksList = [];
    let current = new Date(termStart);
    let index = 0;
    
    // If termStart is somehow after current week, force at least one iteration to include current week
    if (current > currentWeekStart) {
      current = new Date(currentWeekStart);
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
    fetchData();
  }, [resolvedParams.id, selectedWeekKey]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", resolvedParams.id)
      .single();

    if (courseError || !courseData) {
      alert("تعذر تحميل بيانات المقرر");
      router.push("/");
      return;
    }
    setCourse(courseData);

    const { data: studentsData } = await supabase
      .from("students")
      .select("*")
      .eq("academic_year", courseData.academic_year);

    setStudents(studentsData || []);

    if (courseData.makeup_students && courseData.makeup_students.length > 0) {
      const { data: makeupData } = await supabase
        .from("students")
        .select("*")
        .in("id", courseData.makeup_students);
      setMakeupStudents(makeupData || []);
    }

    // Fetch Instructor Name from profiles table
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: profile } = await supabase.from("profiles").select("full_name, degree").eq("id", userData.user.id).single();
      if (profile && profile.full_name) {
        const title = profile.degree ? `${profile.degree}/` : '';
        setInstructorName(`${title}${profile.full_name}`);
      } else {
        setInstructorName(userData.user.email || "........................");
      }
    }

    const { data: allAtt } = await supabase
      .from("attendance")
      .select("student_id, date")
      .eq("course_id", resolvedParams.id);
    setAllAttendances(allAtt || []);

    const distinctWeekStarts = new Set();
    (allAtt || []).forEach(a => {
       const d = new Date(a.date);
       const dayOfWeek = d.getDay();
       const daysToSubtract = (dayOfWeek + 1) % 7; 
       const start = new Date(d);
       start.setDate(d.getDate() - daysToSubtract);
       distinctWeekStarts.add(start.toISOString().split('T')[0]);
    });
    setTotalWeeksCount(distinctWeekStarts.size);

    const { start: wStart, end: wEnd } = getWeekRangeFromKey(selectedWeekKey);

    const { data: attData } = await supabase
      .from("attendance")
      .select("*")
      .eq("course_id", resolvedParams.id)
      .gte("date", wStart.toISOString())
      .lte("date", wEnd.toISOString());
    
    setAttendance(attData || []);

    // Initialize previously recorded attendance as selected
    const initialSelected = new Set<string>();
    (attData || []).forEach(a => {
      if (a.status === "حاضر") initialSelected.add(a.student_id);
    });
    setSelectedStudentIds(initialSelected);

    if (courseData.custom_week_names && courseData.custom_week_names.__absence_limit__) {
      setAbsenceLimit(courseData.custom_week_names.__absence_limit__.toString());
    }

    setLoading(false);

    // Auto open camera if requested via query param
    if (searchParams.get("mode") === "camera") {
      setShowCameraScanner(true);
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
      // Prevent un-toggling if already saved in DB for this week
      const isSaved = attendance.some(a => a.student_id === id && a.status === "حاضر");
      if (isSaved) {
        alert("هذا الطالب مسجل كحاضر بالفعل. للإلغاء استخدم الضغط المطول على اسم الطالب.");
        return;
      }
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStudentIds(newSet);
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    const saveDate = selectedWeekKey;

    const displayIds = getDisplayStudents().map(s => s.id);
    const toDeleteIds = displayIds.filter(id => !selectedStudentIds.has(id));
    const toInsertIds = displayIds.filter(id => 
      selectedStudentIds.has(id) && 
      !attendance.some(a => a.student_id === id && a.status === "حاضر")
    );

    if (toDeleteIds.length > 0) {
      const recordsToDelete = attendance.filter(a => toDeleteIds.includes(a.student_id));
      for (const rec of recordsToDelete) {
        const { error: delErr } = await supabase.from("attendance").delete().eq("id", rec.id);
        if (delErr) { alert("حدث خطأ أثناء إلغاء الحضور، تأكد من الإنترنت."); setSaving(false); return; }
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
      const { error: insErr } = await supabase.from("attendance").insert(inserts);
      if (insErr) { alert("حدث خطأ في الحفظ، تأكد من اتصالك بالإنترنت."); setSaving(false); return; }
    }

    alert("تم حفظ الحضور بنجاح!");
    await fetchData(); // Refresh data
    setSaving(false);
  };

  // --- CROSS-COURSE MAKEUP LOGIC ---
  const handleCrossCourseMakeup = async (code: string) => {
    const { data: globalStudent } = await supabase.from("students").select("*").eq("student_code", code).maybeSingle();
    
    if (!globalStudent) {
      vibrateError();
      alert("لم يتم العثور على طالب بهذا الكود في أي فرقة!");
      return null;
    }

    vibrateError(); // Small alert pattern
    const confirmAdd = window.confirm(`الطالب (${globalStudent.full_name}) مقيد بفرقة ${globalStudent.academic_year} - سكشن ${globalStudent.section} وهو غير مدرج في قوائم هذا المقرر.\nهل تود ضمه كطالب تخلفات / مستمع الآن؟`);
    
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
    
    // First, find the student globally by code
    const { data: student } = await supabase.from("students").select("*").eq("student_code", code).maybeSingle();
    
    if (!student) {
      vibrateError();
      alert("لم يتم العثور على طالب بهذا الكود في أي فرقة!");
      return null;
    }

    const inMakeup = isMakeup && course.makeup_students.includes(student.id);
    const inCourseSections = course.sections && course.sections.includes(student.section) && student.academic_year === course.academic_year;

    if (inMakeup || inCourseSections) {
      return student;
    }

    // If not in the course naturally or via makeup, trigger makeup prompt
    return await handleCrossCourseMakeup(code);
  };


  // --- CAMERA LOGIC ---
  const vibrateSuccess = () => { if (navigator.vibrate) navigator.vibrate(100); };
  const vibrateError = () => { if (navigator.vibrate) navigator.vibrate([50, 100, 50]); };

  const handleCameraScan = async (decodedText: string) => {
    if (!decodedText || !showCameraScanner) return;
    
    setScannerPulse(true);
    setTimeout(() => setScannerPulse(false), 300);

    const cleanCode = extractStudentCode(decodedText);
    const student = await checkStudentLocalOrGlobal(cleanCode);
    if (student) {
      setScannedStudents((prev) => {
        if (prev.some(s => s.id === student.id)) {
          vibrateError();
          return prev;
        }
        vibrateSuccess();
        return [...prev, student];
      });
    }
  };

  const startCameraScanner = () => {
    setShowCameraScanner(true);
  };

  const closeCameraScanner = () => {
    setShowCameraScanner(false);
    setScannedStudents([]);
    if (searchParams.get("mode") === "camera") {
      router.push("/");
    }
  };

  const saveBatchCameraAttendance = async () => {
    if (scannedStudents.length === 0) return;
    setSavingBatch(true);
    const saveDate = selectedWeekKey;
    
    for (const s of scannedStudents) {
      const existing = attendance.find(a => a.student_id === s.id && a.date === saveDate);
      if (existing) {
        if (existing.status !== "حاضر") { 
          const { error: updErr } = await supabase.from("attendance").update({ status: "حاضر", created_at: new Date().toISOString() }).eq("id", existing.id); 
          if (updErr) { alert("حدث خطأ في تحديث البيانات. تأكد من الإنترنت."); setSavingBatch(false); return; }
        }
      } else {
        await supabase.from("attendance").insert({
          course_id: course.id,
          student_id: s.id,
          date: saveDate,
          status: "حاضر",
          teacher_id: course.teacher_id
        });
      }
    }
    
    vibrateSuccess();
    alert("تم حفظ حضور هذه المجموعة بنجاح!");
    
    // Refresh data so the UI updates and shows them as green in their respective sections
    await fetchData();
    closeCameraScanner();
    setSavingBatch(false);
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

    await downloadPdf(
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
      const res = await fetch("/api/bot/notify_warning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column" }}>
        <div className="loader-circle"></div>
        <div style={{ color: "#ccc", fontSize: "14px", marginTop: "10px" }}>جاري التحميل...</div>
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
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: "#121212", position: "relative" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#1e1e1e", borderBottom: "1px solid #333", direction: "rtl" }}>
        <button className="hide-on-mobile" onClick={() => {
          if (searchParams.get("mode") === "camera") {
            router.push("/");
          } else {
            router.push(`/course/${course.id}`);
          }
        }} style={{ background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>
          🡲
        </button>
        <h2 style={{ margin: 0, color: "#4CAF50", fontSize: "18px" }}>تسجيل الحضور</h2>
        <button onClick={() => setShowSettingsModal(true)} style={{ background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>
          ☰
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "10px", padding: "15px", direction: "rtl" }}>
        
        <button 
          onClick={() => setShowWeeksModal(true)}
          style={{ flex: 1, background: "var(--surface)", border: "1px solid #444", color: selectedWeekKey === currentWeekKey ? "#4CAF50" : "#FF9800", padding: "12px 10px", borderRadius: "10px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", fontWeight: "bold" }}>
          <span>📅</span> {getWeekDisplayName()}
        </button>

        <button 
          onClick={startCameraScanner}
          style={{ flex: 1, background: "var(--primary)", border: "none", color: "#fff", padding: "12px 10px", borderRadius: "10px", fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
          <span>📸</span> كاميرا
        </button>

        <button 
          onClick={() => setShowMakeupModal(true)}
          disabled={saving}
          style={{ flex: 1, background: "#E91E63", border: "none", color: "#fff", padding: "12px 10px", borderRadius: "10px", fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
          <span>➕</span> تخلفات
        </button>

      </div>

      {/* Section Selector */}
      <div style={{ padding: "0 15px", direction: "rtl", marginBottom: "10px" }}>
        <select 
          value={selectedSection} 
          onChange={(e) => setSelectedSection(e.target.value)}
          style={{ width: "100%", padding: "12px", background: "#1e1e1e", border: "1px solid #444", borderRadius: "10px", color: selectedSection ? "#fff" : "#aaa", fontSize: "16px", outline: "none" }}
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
        <div style={{ fontSize: "12px", color: "#aaa", marginTop: "8px", paddingRight: "5px" }}>
          إجمالي الطلاب: <span style={{ color: "var(--primary)", fontWeight: "bold" }}>{displayStudents.length}</span> طالباً
        </div>
      </div>

      {/* Students List */}
      <div style={{ flexGrow: 1, overflowY: "auto", direction: "rtl", paddingBottom: "80px" }}>
        {!selectedSection ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#888", display: "flex", flexDirection: "column", alignItems: "center", gap: "15px" }}>
            <span style={{ fontSize: "50px", opacity: 0.5 }}>📂</span>
            <span>لم يتم اختيار سكشن.<br/>اختر سكشن من القائمة بالأعلى لعرض الطلاب وبدء التحضير.</span>
          </div>
        ) : displayStudents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#888" }}>لا يوجد طلاب في هذا القسم.</div>
        ) : (
          displayStudents.map((student) => {
            const isSelected = selectedStudentIds.has(student.id);
            const isExcused = attendance.some(a => a.student_id === student.id && a.status === 'غياب بعذر');
            
            let bg = "#1e1e1e";
            let borderColor = "transparent";
            if (isSelected) {
              bg = "#1b5e20";
              borderColor = "#4CAF50";
            } else if (isExcused) {
              bg = "#4a0b0b";
              borderColor = "#f44336";
            }
            
            return (
              <div 
                key={student.id} 
                onClick={() => {
                  if (isExcused) {
                    alert("هذا الطالب مسجل غياب بعذر، للإلغاء استخدم الضغط المطول ثم (إلغاء الحضور).");
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
                  padding: "15px 20px",
                  background: bg,
                  borderBottom: "1px solid #333",
                  borderRight: `5px solid ${borderColor}`,
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
              >
                <div>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                    {student.full_name}
                    {student.isMakeup && (
                      <span style={{ background: "#E91E63", color: "white", fontSize: "10px", padding: "2px 6px", borderRadius: "8px" }}>تخلفات</span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: isSelected ? "#A5D6A7" : "#888", marginTop: "4px", fontFamily: "monospace" }}>
                    كود: {student.student_code}
                  </div>
                </div>
                {isSelected && <div style={{ color: "#4CAF50", fontSize: "20px" }}>✓</div>}
                {isExcused && <div style={{ color: "#f44336", fontSize: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span>📝</span>
                  <span style={{ fontSize: "9px" }}>بعذر</span>
                </div>}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Save Button */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "15px", background: "linear-gradient(transparent, #121212 20%, #121212)" }}>
        <button 
          onClick={handleSaveAttendance}
          disabled={saving || pendingChangesCount === 0}
          style={{ 
            width: "100%", 
            padding: "15px", 
            borderRadius: "15px", 
            background: pendingChangesCount > 0 ? "#4CAF50" : "#333", 
            color: pendingChangesCount > 0 ? "#fff" : "#888", 
            fontWeight: "bold", 
            fontSize: "16px", 
            boxShadow: pendingChangesCount > 0 ? "0 4px 15px rgba(76,175,80,0.4)" : "none", 
            border: "none",
            transition: "all 0.3s"
          }}>
          {saving ? "جاري الحفظ..." : `تأكيد وحفظ التعديلات (${pendingChangesCount})`}
        </button>
      </div>

      {/* Long Press Modal */}
      {longPressStudent && (() => {
        const isExcused = attendance.some(a => a.student_id === longPressStudent.id && a.status === 'غياب بعذر');
        return (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(3px)" }}>
          <div style={{ background: "#1e1e1e", width: "90%", maxWidth: "320px", borderRadius: "15px", padding: "20px", textAlign: "center", border: "1px solid #333", direction: "rtl" }}>
            <h3 style={{ color: "var(--primary)", marginTop: 0 }}>{longPressStudent.full_name}</h3>
            <p style={{ fontSize: "14px", color: "#aaa", marginBottom: "20px", fontFamily: "monospace" }}>كود: {longPressStudent.student_code}</p>
            
            {isExcused ? (
              <button onClick={handleCancelAttendancePast} style={{ background: "#f44336", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "10px" }}>
                ❌ إلغاء العذر
              </button>
            ) : (
              <>
                <button onClick={handleCancelAttendancePast} style={{ background: "#FF9800", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "10px" }}>
                  ❌ إلغاء حضور هذا الأسبوع
                </button>
                <button onClick={() => {
                  const excuse = window.prompt("أدخل سبب الغياب (مثال: مرضي، رياضي...):");
                  if (excuse !== null) {
                    const inserts = [{
                      course_id: course.id,
                      student_id: longPressStudent.id,
                      date: selectedWeekKey,
                      status: "غياب بعذر",
                      note: excuse,
                      teacher_id: course.teacher_id
                    }];
                    supabase.from("attendance").upsert(inserts, { onConflict: 'course_id,student_id,date' }).then(() => {
                      fetchData();
                    });
                    setLongPressStudent(null);
                  }
                }} style={{ background: "#9C27B0", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "10px" }}>
                  📝 تسجيل غياب بعذر
                </button>
              </>
            )}
            
            <button onClick={handleMoveToSectionClick} style={{ background: "#2196F3", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "10px" }}>
              🔄 نقل الطالب لسكشن آخر
            </button>
            <button onClick={handleRemoveStudentFromCourse} style={{ background: "#F44336", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "15px" }}>
              🗑️ حذف من مقرري نهائياً
            </button>
            <button onClick={() => setLongPressStudent(null)} style={{ background: "transparent", width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #555", color: "#fff", fontSize: "15px" }}>
              تراجع
            </button>
          </div>
        </div>
        );
      })()}

      {/* Move Section Modal */}
      {showMoveModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", zIndex: 110, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(3px)" }}>
          <div style={{ background: "#1e1e1e", width: "90%", maxWidth: "320px", borderRadius: "15px", padding: "20px", textAlign: "center", border: "1px solid #333", direction: "rtl" }}>
            <h3 style={{ color: "#2196F3", marginTop: 0 }}>نقل الطالب إلى سكشن آخر</h3>
            <p style={{ fontSize: "14px", color: "#aaa", marginBottom: "20px" }}>اختر السكشن الجديد الذي ترغب في نقل الطالب إليه:</p>
            
            <select 
              value={targetSection} 
              onChange={(e) => setTargetSection(e.target.value)}
              style={{ width: "100%", padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "10px", color: "#fff", marginBottom: "15px", fontSize: "16px" }}
            >
              {course?.sections?.map((sec: string) => (
                <option key={sec} value={sec}>سكشن {sec}</option>
              ))}
              <option value="تخلفات">التخلفات</option>
            </select>

            <button onClick={handleConfirmMove} style={{ background: "#2196F3", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "10px", fontWeight: "bold" }}>
              تأكيد النقل
            </button>
            <button onClick={() => setShowMoveModal(false)} style={{ background: "transparent", width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #555", color: "#fff", fontSize: "15px" }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Week Rename Modal */}
      {showWeekRenameModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(3px)" }}>
          <div style={{ background: "#1e1e1e", width: "90%", maxWidth: "320px", borderRadius: "15px", padding: "20px", textAlign: "center", border: "1px solid #333", direction: "rtl" }}>
            <h3 style={{ color: "#4CAF50", marginTop: 0 }}>تسمية الأسبوع المخصصة</h3>
            <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "15px" }}>أدخل اسماً مخصصاً ليظهر في التقارير (مثال: الأسبوع الأول - تدريب)</p>
            
            <input 
              type="text" 
              value={customWeekName} 
              onChange={(e) => setCustomWeekName(e.target.value)}
              placeholder="اسم الأسبوع"
              style={{ width: "100%", padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "10px", color: "#fff", marginBottom: "15px", textAlign: "right" }}
            />

            <button onClick={handleSaveWeekName} style={{ background: "#4CAF50", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "10px", fontWeight: "bold" }}>
              حفظ المسمى
            </button>
            <button onClick={() => setShowWeekRenameModal(false)} style={{ background: "transparent", width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #555", color: "#fff", fontSize: "15px" }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Makeup Add Modal */}
      {showMakeupModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 120, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#1e1e1e", width: "90%", maxWidth: "350px", borderRadius: "15px", padding: "20px", textAlign: "center", border: "1px solid #E91E63", direction: "rtl" }}>
            <h3 style={{ color: "#E91E63", marginTop: 0 }}>إضافة طالب تخلفات</h3>
            
            {!makeupCameraActive ? (
              <>
                <input 
                  type="text" 
                  value={makeupInputCode}
                  onChange={(e) => setMakeupInputCode(e.target.value)}
                  placeholder="أدخل كود الطالب..."
                  style={{ width: "100%", padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "10px", color: "#fff", marginBottom: "15px", textAlign: "center", fontSize: "18px", letterSpacing: "2px" }}
                />
                
                <button onClick={() => handleAddMakeupStudentSubmit(makeupInputCode)} style={{ background: "#4CAF50", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "10px", fontWeight: "bold" }}>
                  إضافة الآن
                </button>
                <button onClick={startMakeupCamera} style={{ background: "#2196F3", width: "100%", padding: "12px", borderRadius: "10px", border: "none", color: "#fff", fontSize: "15px", marginBottom: "10px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                  <span>📸</span> مسح الكود بالكاميرا
                </button>
              </>
            ) : (
              <>
                <div style={{ background: "black", borderRadius: "10px", overflow: "hidden", position: "relative", height: "260px", marginBottom: "15px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <QRScanner onScan={(result) => { if(result) { handleAddMakeupStudentSubmit(extractStudentCode(result)); setMakeupCameraActive(false); } }} />
                  
                  {/* Target Overlay UI */}
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "220px", height: "220px", border: "3px solid rgba(233, 30, 99, 0.7)", borderRadius: "20px", pointerEvents: "none", boxShadow: "0 0 0 4000px rgba(0,0,0,0.5)" }}></div>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "220px", height: "220px", pointerEvents: "none" }}>
                     <div style={{ position: "absolute", top: "-3px", left: "-3px", width: "30px", height: "30px", borderTop: "4px solid #E91E63", borderLeft: "4px solid #E91E63", borderTopLeftRadius: "15px" }}></div>
                     <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "30px", height: "30px", borderTop: "4px solid #E91E63", borderRight: "4px solid #E91E63", borderTopRightRadius: "15px" }}></div>
                     <div style={{ position: "absolute", bottom: "-3px", left: "-3px", width: "30px", height: "30px", borderBottom: "4px solid #E91E63", borderLeft: "4px solid #E91E63", borderBottomLeftRadius: "15px" }}></div>
                     <div style={{ position: "absolute", bottom: "-3px", right: "-3px", width: "30px", height: "30px", borderBottom: "4px solid #E91E63", borderRight: "4px solid #E91E63", borderBottomRightRadius: "15px" }}></div>
                  </div>
                  
                  <div style={{ position: "absolute", bottom: "20px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "5px 15px", borderRadius: "15px", fontSize: "12px", zIndex: 10 }}>وجه الكاميرا داخل الإطار الزهري</div>
                </div>
              </>
            )}

            <button onClick={() => {
              if (makeupCameraActive && (window as any).__mkpScanner) { (window as any).__mkpScanner.clear(); setMakeupCameraActive(false); }
              setShowMakeupModal(false);
            }} style={{ background: "transparent", width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #555", color: "#fff", fontSize: "15px" }}>
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Batch Attendance Scanner Modal */}
      {showCameraScanner && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.9)", zIndex: 130, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "15px", background: "#1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", direction: "rtl" }}>
            <h3 style={{ margin: 0, color: "#2196F3", fontSize: "16px" }}>📸 ماسح الحضور الذكي</h3>
            
            <button onClick={closeCameraScanner} style={{ background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>✕</button>
          </div>
          
          <div style={{ background: "black", position: "relative", height: "300px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            <QRScanner onScan={(result) => { if (result) handleCameraScan(result); }} />
            
            {/* Target Overlay UI */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "220px", height: "220px", border: "3px solid", borderColor: scannerPulse ? "#2196F3" : "rgba(33, 150, 243, 0.7)", borderRadius: "20px", pointerEvents: "none", boxShadow: scannerPulse ? "0 0 15px #2196F3, 0 0 0 4000px rgba(0,0,0,0.5)" : "0 0 0 4000px rgba(0,0,0,0.5)", transition: "all 0.2s" }}></div>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "220px", height: "220px", pointerEvents: "none" }}>
               <div style={{ position: "absolute", top: "-3px", left: "-3px", width: "30px", height: "30px", borderTop: "4px solid #2196F3", borderLeft: "4px solid #2196F3", borderTopLeftRadius: "15px" }}></div>
               <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "30px", height: "30px", borderTop: "4px solid #2196F3", borderRight: "4px solid #2196F3", borderTopRightRadius: "15px" }}></div>
               <div style={{ position: "absolute", bottom: "-3px", left: "-3px", width: "30px", height: "30px", borderBottom: "4px solid #2196F3", borderLeft: "4px solid #2196F3", borderBottomLeftRadius: "15px" }}></div>
               <div style={{ position: "absolute", bottom: "-3px", right: "-3px", width: "30px", height: "30px", borderBottom: "4px solid #2196F3", borderRight: "4px solid #2196F3", borderBottomRightRadius: "15px" }}></div>
            </div>

            <div style={{ position: "absolute", bottom: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "5px 15px", borderRadius: "15px", fontSize: "12px", fontWeight: "bold", zIndex: 10 }}>وجه الكاميرا داخل الإطار الأزرق</div>
          </div>

          <div style={{ padding: "15px", background: "#2d2d2d", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #444", direction: "rtl" }}>
            <span style={{ color: "#90CAF9", fontWeight: "bold", fontSize: "14px" }}>تم رصد: <span style={{ color: "#fff" }}>{scannedStudents.length}</span> طلاب</span>
            <button onClick={saveBatchCameraAttendance} disabled={scannedStudents.length === 0 || savingBatch} style={{ background: scannedStudents.length > 0 ? "#4CAF50" : "#555", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "bold" }}>
              {savingBatch ? "جاري الحفظ..." : "حفظ الحضور ✅"}
            </button>
          </div>

          <div style={{ flexGrow: 1, overflowY: "auto", background: "#1e1e1e", padding: "10px", direction: "rtl" }}>
            {scannedStudents.length === 0 ? (
              <div style={{ textAlign: "center", color: "#666", marginTop: "30px" }}>الطلاب الممسوحين سيظهرون هنا...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#333" }}>
                    <th style={{ padding: "10px", border: "1px solid #444", color: "#fff" }}>الاسم</th>
                    <th style={{ padding: "10px", border: "1px solid #444", color: "#fff", width: "50px" }}>السكشن</th>
                    <th style={{ padding: "10px", border: "1px solid #444", color: "#fff", width: "40px" }}>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedStudents.map(s => (
                    <tr key={s.id} style={{ background: "#222" }}>
                      <td style={{ padding: "10px", border: "1px solid #444", color: "#fff", textAlign: "right" }}>
                        {s.full_name} <br/><span style={{ fontSize: "10px", color: "#aaa" }}>{s.student_code}</span>
                      </td>
                      <td style={{ padding: "10px", border: "1px solid #444", color: "#4CAF50", fontWeight: "bold" }}>{s.section}</td>
                      <td style={{ padding: "10px", border: "1px solid #444" }}>
                        <button onClick={() => setScannedStudents(prev => prev.filter(x => x.id !== s.id))} style={{ background: "transparent", border: "none", color: "#f44336", fontSize: "16px", fontWeight: "bold" }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal (Hamburger Menu) */}
      {showSettingsModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 140, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ background: "#1e1e1e", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", padding: "20px", direction: "rtl", animation: "slideUp 0.3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "15px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#fff" }}>⚙️ إعدادات المقرر</h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: "24px", cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#121212", padding: "10px 15px", borderRadius: "10px", border: "1px solid #333" }}>
                <span style={{ color: "#aaa", fontSize: "14px" }}>حد الإنذار (أسابيع الغياب):</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input 
                    type="number" 
                    value={absenceLimit}
                    onChange={(e) => setAbsenceLimit(e.target.value)}
                    style={{ width: "50px", padding: "6px", background: "#1e1e1e", border: "1px solid #444", borderRadius: "6px", color: "#fff", textAlign: "center", fontSize: "14px", outline: "none" }}
                  />
                  <button onClick={async () => {
                    const updatedNames = { ...(course.custom_week_names || {}), __absence_limit__: Number(absenceLimit) };
                    await supabase.from("courses").update({ custom_week_names: updatedNames }).eq("id", course.id);
                    setCourse({ ...course, custom_week_names: updatedNames });
                    alert("تم حفظ إعدادات الغياب بنجاح!");
                  }} style={{ background: "#4CAF50", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>حفظ</button>
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "#666", marginTop: "8px", textAlign: "center" }}>يُستخدم هذا الرقم لحساب قائمة الإنذارات بالأسفل.</div>
            </div>

            <div style={{ background: "#121212", borderRadius: "10px", border: "1px solid #333", padding: "15px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#aaa" }}>الأسابيع المسجلة (الرصد):</span>
                <span style={{ color: "#FF9800", fontWeight: "bold" }}>{totalWeeksCount} أسبوع</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#aaa" }}>الطلاب تجاوزوا الإنذار:</span>
                <span style={{ color: "#F44336", fontWeight: "bold" }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", borderTop: "1px solid #333", paddingTop: "10px" }}>
                <span style={{ color: "#aaa" }}>إجمالي الطلاب المسجلين:</span>
                <span style={{ color: "#4CAF50", fontWeight: "bold" }}>{students.filter(s => !(course.excluded_students || []).includes(s.id)).length} طالب</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#aaa" }}>تخلفات من فرق أخرى:</span>
                <span style={{ color: "#E91E63", fontWeight: "bold" }}>{makeupStudents.filter(s => !(course.excluded_students || []).includes(s.id)).length} طالب</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#aaa" }}>نظام المقرر:</span>
                <span style={{ color: "#2196F3", fontWeight: "bold" }}>{course.course_type === "lectures" ? "محاضرات عامة" : "سكاشن منفصلة"}</span>
              </div>
            </div>

            <button onClick={handlePrintWarnings} style={{ width: "100%", background: "#F44336", color: "#fff", border: "none", padding: "15px", borderRadius: "10px", fontWeight: "bold", fontSize: "16px", marginBottom: "10px", display: "flex", justifyContent: "center", gap: "10px" }}>
              <span>📄</span> استخراج قائمة المنذرين بصيغة PDF
            </button>
            <button onClick={handleSendTelegramWarnings} disabled={saving} style={{ width: "100%", background: "#2196F3", color: "#fff", border: "none", padding: "15px", borderRadius: "10px", fontWeight: "bold", fontSize: "16px", marginBottom: "10px", display: "flex", justifyContent: "center", gap: "10px", opacity: saving ? 0.7 : 1 }}>
              <span>✈️</span> إرسال إنذار عبر التليجرام للمتجاوزين
            </button>
          </div>
        </div>
      )}

      {/* Week Picker Modal */}
      {showWeeksModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 120, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ background: "#1e1e1e", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", padding: "20px", direction: "rtl", animation: "slideUp 0.3s", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "15px", marginBottom: "15px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#fff" }}>اختر أسبوع التحضير</h3>
                <span style={{ fontSize: "12px", color: "#888" }}>اضغط مطولاً على أي أسبوع لتغيير اسمه (مثال: أسبوع الرسم بالرصاص)</span>
              </div>
              <button onClick={() => setShowWeeksModal(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: "24px", cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ overflowY: "auto", flexGrow: 1, paddingRight: "5px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
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
                        background: isActive ? "#1b5e20" : "#121212", 
                        border: isActive ? "2px solid #4CAF50" : "1px solid #333", 
                        padding: "15px", 
                        borderRadius: "12px", 
                        cursor: "pointer", 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center" 
                      }}
                    >
                      <div>
                        <div style={{ color: isActive ? "#fff" : "#4CAF50", fontWeight: "bold", fontSize: "16px" }}>{displayName}</div>
                        <div style={{ color: "#aaa", fontSize: "11px", marginTop: "4px" }}>{w.subtitle}</div>
                      </div>
                      {isActive && <div style={{ color: "#4CAF50", fontSize: "20px" }}>✓</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
