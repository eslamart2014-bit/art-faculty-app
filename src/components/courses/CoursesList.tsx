"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Camera, MoreVertical, Download, CheckCircle2, Zap } from "lucide-react";
import { forceDownloadFacultyOfflinePack } from "@/lib/preloadFacultyData";

interface CoursesListProps {
  user: any;
  refreshTrigger: number;
}

const formatCourseDate = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${day}/${m}/${y}`;
  } catch {
    return "";
  }
};

export default function CoursesList({ user, refreshTrigger }: CoursesListProps) {
  const router = useRouter();
  
  // 0ms Instant Synchronous Cache Initialization (Zero White Screen / Loading Spinners)
  const [courses, setCourses] = useState<any[]>(() => {
    if (typeof window !== 'undefined' && user?.id) {
      try {
        const cached = localStorage.getItem(`cached_courses_${user.id}`);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined' && user?.id) {
      try {
        const cached = localStorage.getItem(`cached_courses_${user.id}`);
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch (e) {}
    }
    return true;
  });
  
  // Menu and Modals state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [courseToRename, setCourseToRename] = useState<any>(null);
  const [newName, setNewName] = useState("");
  const [courseToDelete, setCourseToDelete] = useState<any>(null);
  const [courseToShare, setCourseToShare] = useState<any>(null);
  const [colleagueName, setColleagueName] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const [profilesMap, setProfilesMap] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cached_profiles_map');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return {};
  });

  // Offline Pack & Instant Mode State
  const [offlinePackMeta, setOfflinePackMeta] = useState<any>(() => {
    if (typeof window !== 'undefined' && user?.id) {
      try {
        const meta = localStorage.getItem(`cached_offline_pack_meta_${user.id}`);
        if (meta) return JSON.parse(meta);
      } catch (e) {}
    }
    return null;
  });
  const [downloadingPack, setDownloadingPack] = useState(false);
  const [packProgressStep, setPackProgressStep] = useState("");
  const [packProgressPercent, setPackProgressPercent] = useState(0);
  const [showPackSuccessToast, setShowPackSuccessToast] = useState(false);

  // Instant Local Cache reload when user changes
  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      try {
        const cachedCourses = localStorage.getItem(`cached_courses_${user.id}`);
        if (cachedCourses) {
          setCourses(JSON.parse(cachedCourses));
          setLoading(false);
        }
        const cachedProfiles = localStorage.getItem('cached_profiles_map');
        if (cachedProfiles) {
          setProfilesMap(JSON.parse(cachedProfiles));
        }
        const meta = localStorage.getItem(`cached_offline_pack_meta_${user.id}`);
        if (meta) setOfflinePackMeta(JSON.parse(meta));
      } catch (e) {}
    }
  }, [user.id]);

  useEffect(() => {
    fetchCourses();
    fetchProfiles();
  }, [user.id, refreshTrigger]);

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase.from("profiles").select("id, full_name");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(p => map[p.id] = p.full_name);
        setProfilesMap(map);
        try { localStorage.setItem('cached_profiles_map', JSON.stringify(map)); } catch (e) {}
      }
    } catch (e) {}
  };

  const fetchCourses = async () => {
    // Only show full loading if we have zero cached courses
    if (courses.length === 0) setLoading(true);

    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .or(`teacher_id.eq.${user.id},shared_with.cs.{${user.id}}`)
        .order("created_at", { ascending: false });

      if (data && !error) {
        // Filter out archived courses and courses hidden for this user
        const activeCourses = data.filter(c => 
          !c.custom_week_names?.__archived && 
          !(c.custom_week_names?.__hidden_for || []).includes(user.id)
        );
        setCourses(activeCourses);
        try {
          localStorage.setItem(`cached_courses_${user.id}`, JSON.stringify(activeCourses));
        } catch (e) {}

        // HIGH-6 FIX: Pre-warm local cache with size guards to prevent localStorage exhaustion
        // Only pre-warm the first 6 active courses sequentially
        (async () => {
          for (const cItem of activeCourses.slice(0, 6)) {
            try {
              const cacheKey = `cache_attendance_${cItem.id}`;
              const existingCache = localStorage.getItem(cacheKey);
              if (!existingCache) {
                let query = supabase
                  .from("students")
                  .select("id, full_name, student_code, academic_year, section")
                  .eq("academic_year", cItem.academic_year)
                  .eq("is_active", true);

                if (cItem.course_type === 'sections' && Array.isArray(cItem.sections) && cItem.sections.length > 0) {
                  query = query.in("section", cItem.sections);
                }

                const { data: studentsData } = await query;
                if (studentsData && studentsData.length > 0) {
                  localStorage.setItem(cacheKey, JSON.stringify({
                    course: cItem,
                    students: studentsData,
                    attendance: []
                  }));
                }
              }
            } catch (err: any) {
              // If quota exceeded, break early to preserve existing cache
              if (err?.name === 'QuotaExceededError' || err?.code === 22) {
                console.warn("Storage quota reached during pre-warm, stopping.");
                break;
              }
            }
          }
        })();
      }
    } catch (e) {
      console.log("Offline mode: using cached courses list");
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === courseId ? null : courseId);
  };

  const togglePinAttendance = async (e: React.MouseEvent, course: any) => {
    e.stopPropagation();
    setActiveMenuId(null);
    
    const currentCustom = course.custom_week_names || {};
    const isPinned = !!currentCustom.__pinned_attendance;
    
    const updatedCustom = {
      ...currentCustom,
      __pinned_attendance: !isPinned
    };

    // Optimistic UI update
    const updatedCourses = courses.map(c => c.id === course.id ? { ...c, custom_week_names: updatedCustom } : c);
    setCourses(updatedCourses);
    try { localStorage.setItem(`cached_courses_${user.id}`, JSON.stringify(updatedCourses)); } catch (e) {}
    
    try {
      await fetch('/api/courses/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_custom', course_id: course.id, custom_week_names: updatedCustom })
      });
    } catch (e) {
      await supabase.from("courses").update({ custom_week_names: updatedCustom }).eq("id", course.id);
    }
  };

  const openRenameModal = (e: React.MouseEvent, course: any) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setCourseToRename(course);
    setNewName(course.name);
  };

  const handleRenameSubmit = async () => {
    if (!newName.trim() || !courseToRename) return;
    
    // Optimistic UI update
    const updatedCourses = courses.map(c => c.id === courseToRename.id ? { ...c, name: newName } : c);
    setCourses(updatedCourses);
    try { localStorage.setItem(`cached_courses_${user.id}`, JSON.stringify(updatedCourses)); } catch (e) {}
    const cId = courseToRename.id;
    setCourseToRename(null);

    try {
      await fetch('/api/courses/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', course_id: cId, name: newName })
      });
    } catch (e) {
      await supabase.from("courses").update({ name: newName }).eq("id", cId);
    }
  };

  const openDeleteModal = (e: React.MouseEvent, course: any) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setCourseToDelete(course);
  };

  const handleArchiveGlobal = async () => {
    if (!courseToDelete) return;
    const currentCustom = courseToDelete.custom_week_names || {};
    const updatedCustom = { ...currentCustom, __archived: true };
    const cId = courseToDelete.id;

    setCourses(courses.filter(c => c.id !== cId));
    
    await supabase.from("archives").insert({
      user_id: user?.id,
      item_type: "course",
      description: `حذف مقرر للجميع: ${courseToDelete.name}`,
      original_data: { course_id: cId }
    });

    try {
      await fetch('/api/courses/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_custom', course_id: cId, custom_week_names: updatedCustom })
      });
    } catch (e) {
      await supabase.from("courses").update({ custom_week_names: updatedCustom }).eq("id", cId);
    }
    
    // تفريغ وحذف كافة صور وتسليمات المقرر من سحابة التخزين تلقائياً
    try {
      await fetch('/api/courses/delete-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: cId })
      });
    } catch (e) {}

    setCourseToDelete(null);
  };

  const handleDeleteForMeOnly = async () => {
    if (!courseToDelete) return;
    const currentCustom = courseToDelete.custom_week_names || {};
    const hiddenFor = currentCustom.__hidden_for || [];
    const updatedCustom = { ...currentCustom, __hidden_for: [...hiddenFor, user.id] };
    const cId = courseToDelete.id;

    setCourses(courses.filter(c => c.id !== cId));
    try {
      await fetch('/api/courses/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_custom', course_id: cId, custom_week_names: updatedCustom })
      });
    } catch (e) {
      await supabase.from("courses").update({ custom_week_names: updatedCustom }).eq("id", cId);
    }
    setCourseToDelete(null);
  };

  const handleLeaveCourse = async () => {
    if (!courseToDelete) return;
    const sharedWith = courseToDelete.shared_with || [];
    const newShared = sharedWith.filter((id: string) => id !== user.id);
    const cId = courseToDelete.id;

    setCourses(courses.filter(c => c.id !== cId));
    try {
      await fetch('/api/courses/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_shared', course_id: cId, shared_with: newShared })
      });
    } catch (e) {
      await supabase.from("courses").update({ shared_with: newShared }).eq("id", cId);
    }
    setCourseToDelete(null);
  };

  const handleShareSubmit = async () => {
    if (!colleagueName.trim()) {
      alert("يرجى إدخال اسم الزميل");
      return;
    }
    setIsSharing(true);
    const { error } = await supabase.from("course_share_requests").insert({
      course_id: courseToShare.id,
      requester_id: user.id,
      target_name: colleagueName.trim(),
      status: "pending"
    });
    
    if (error) {
      alert("حدث خطأ أثناء إرسال الطلب. يرجى إعداد قاعدة البيانات أولاً.");
    } else {
      alert("تم إرسال الطلب، سوف يتم الإضافة من قبل المطور.");
      setCourseToShare(null);
      setColleagueName("");
    }
    setIsSharing(false);
  };

  const handleDownloadOfflinePack = async () => {
    if (!user?.id || downloadingPack) return;
    setDownloadingPack(true);
    setPackProgressPercent(10);
    setPackProgressStep("جاري بدء التنزيل...");

    const res = await forceDownloadFacultyOfflinePack(user.id, (step, percent) => {
      setPackProgressStep(step);
      setPackProgressPercent(percent);
    });

    setDownloadingPack(false);
    if (res.success) {
      try {
        const meta = localStorage.getItem(`cached_offline_pack_meta_${user.id}`);
        if (meta) setOfflinePackMeta(JSON.parse(meta));
      } catch (e) {}
      try {
        const cached = localStorage.getItem(`cached_courses_${user.id}`);
        if (cached) setCourses(JSON.parse(cached));
      } catch (e) {}
      setShowPackSuccessToast(true);
      setTimeout(() => setShowPackSuccessToast(false), 5000);
    } else {
      alert("تعذر استكمال تنزيل الحزمة: " + (res.error || "خطأ في الشبكة"));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
        جاري تحميل المقررات...
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "30px", border: "1px dashed var(--border-light)", borderRadius: "12px", color: "var(--text-muted)" }}>
        لا توجد مقررات دراسية حالياً.<br/>
        <span style={{ fontSize: "12px" }}>اضغط على أيقونة الإعدادات ⚙️ ثم "إضافة مقرر" لتبدأ.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
      {/* Offline Pack Status & One-Click Download Widget */}
      <div style={{
        background: offlinePackMeta ? "rgba(34, 197, 94, 0.08)" : "rgba(37, 99, 235, 0.08)",
        border: `1px solid ${offlinePackMeta ? "rgba(34, 197, 94, 0.25)" : "rgba(59, 130, 246, 0.25)"}`,
        borderRadius: "14px",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        direction: "rtl"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: offlinePackMeta ? "rgba(34, 197, 94, 0.2)" : "rgba(59, 130, 246, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            color: offlinePackMeta ? "#22c55e" : "#3b82f6"
          }}>
            {offlinePackMeta ? <Zap size={20} /> : <Download size={20} />}
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: offlinePackMeta ? "#4ade80" : "#60a5fa" }}>
              {offlinePackMeta ? "وضع السرعة الفائقة مفعّل (0ms)" : "حفظ المقررات للعمل بدون إنترنت"}
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
              {offlinePackMeta 
                ? `بيانات (${courses.length}) مقررات و (${offlinePackMeta.studentsCount || 0}) طالباً محفوظة محلياً`
                : "اضغط لتنزيل مقرراتك وطلابك للعمل في قاعات الكلية بدون نت"}
            </div>
          </div>
        </div>

        <button
          onClick={handleDownloadOfflinePack}
          disabled={downloadingPack}
          style={{
            background: offlinePackMeta ? "rgba(255, 255, 255, 0.08)" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
            color: "#fff",
            border: offlinePackMeta ? "1px solid rgba(255, 255, 255, 0.15)" : "none",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: downloadingPack ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap"
          }}
        >
          {downloadingPack ? "جاري الحفظ..." : (offlinePackMeta ? "تحديث الحزمة 🔄" : "تنزيل الآن 📥")}
        </button>
      </div>

      {/* Progress Modal during Download */}
      {downloadingPack && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(4px)",
          zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px", direction: "rtl"
        }}>
          <div style={{
            background: "#181f2c", border: "1px solid #334155", borderRadius: "16px",
            padding: "24px", maxWidth: "400px", width: "100%", textAlign: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
          }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚡</div>
            <h3 style={{ margin: "0 0 8px 0", color: "#f8fafc", fontSize: "16px" }}>
              تجهيز حزمة العمل السريع بدون إنترنت
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#94a3b8" }}>
              {packProgressStep}
            </p>
            {/* Progress Bar */}
            <div style={{ width: "100%", height: "8px", background: "#0f172a", borderRadius: "4px", overflow: "hidden", marginBottom: "10px" }}>
              <div style={{
                width: `${packProgressPercent}%`, height: "100%",
                background: "linear-gradient(90deg, #2563eb, #22c55e)",
                transition: "width 0.3s ease"
              }} />
            </div>
            <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "bold" }}>
              {packProgressPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showPackSuccessToast && (
        <div style={{
          position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
          background: "#166534", color: "#fff", padding: "12px 20px", borderRadius: "12px",
          display: "flex", alignItems: "center", gap: "10px", zIndex: 999999,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)", direction: "rtl", fontSize: "13px", fontWeight: "bold"
        }}>
          <CheckCircle2 size={18} />
          <span>تم حفظ كافة بياناتك وطلابك على الهاتف بنجاح! التطبيق جاهز للعمل بدون نت 0ms.</span>
        </div>
      )}

      {courses.map(course => (
        <div 
          key={course.id} 
          onClick={() => router.push(`/course/${course.id}`)}
          onMouseEnter={() => {
            router.prefetch(`/course/${course.id}`);
            router.prefetch(`/course/${course.id}/attendance`);
            router.prefetch(`/course/${course.id}/evaluations`);
          }}
          onTouchStart={() => {
            router.prefetch(`/course/${course.id}`);
            router.prefetch(`/course/${course.id}/attendance`);
            router.prefetch(`/course/${course.id}/evaluations`);
          }}
          style={{ 
            background: "var(--surface)", 
            padding: "11px 14px", 
            borderRadius: "12px", 
            border: "1px solid var(--border)", 
            borderRight: "5px solid var(--primary)", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
            boxSizing: "border-box"
          }}
        >
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
            {/* السطر الأول: اسم المقرر + شارة المشاركة الذكية */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: "15px", fontWeight: "bold", wordBreak: "break-word" }}>
                {course.name}
              </h3>
              {course.shared_with && course.shared_with.length > 0 && (
                <span 
                  title={`مقرر مشترك مع: ${
                    course.teacher_id === user.id 
                    ? course.shared_with.map((id: string) => profilesMap[id] || "زميل").join("، ")
                    : (profilesMap[course.teacher_id] || "الزميل")
                  }`}
                  style={{ 
                    fontSize: "11px", 
                    background: "rgba(16, 185, 129, 0.15)", 
                    border: "1px solid rgba(16, 185, 129, 0.35)", 
                    color: "#34d399", 
                    padding: "2px 7px", 
                    borderRadius: "6px", 
                    fontWeight: "500",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    maxWidth: "200px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  <span>🤝</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    مشترك: {
                      course.teacher_id === user.id 
                      ? course.shared_with.map((id: string) => profilesMap[id] || "زميل").join("، ")
                      : (profilesMap[course.teacher_id] || "الزميل")
                    }
                  </span>
                </span>
              )}
            </div>

            {/* السطر الثاني: الفرقة والسكاشن + تاريخ التسجيل الصغير بالأرقام */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
              <span>الفرقة {course.academic_year}</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>{course.course_type === "lectures" ? "محاضرات" : `سكاشن: ${Array.isArray(course.sections) ? course.sections.join(", ") : course.sections || "عام"}`}</span>
              {course.created_at && (
                <>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span 
                    title="تاريخ إنشاء المقرر"
                    style={{ 
                      fontSize: "10.5px", 
                      color: "#94a3b8", 
                      background: "rgba(255, 255, 255, 0.05)", 
                      padding: "1px 6px", 
                      borderRadius: "4px", 
                      fontFamily: "monospace", 
                      direction: "ltr",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px"
                    }}
                  >
                    <span>📅</span>
                    <span>{formatCourseDate(course.created_at)}</span>
                  </span>
                </>
              )}
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            
            {course.custom_week_names?.__pinned_attendance && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/course/${course.id}/attendance?mode=camera`);
                }}
                style={{ 
                  width: "34px", 
                  height: "34px", 
                  cursor: "pointer", 
                  background: "rgba(16, 185, 129, 0.15)", 
                  border: "1px solid rgba(16, 185, 129, 0.4)", 
                  borderRadius: "8px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  color: "#34d399",
                  transition: "all 0.15s ease",
                  flexShrink: 0
                }}
                title="تسجيل الحضور السريع بالكاميرا"
              >
                <Camera size={17} />
              </span>
            )}
            
            <div style={{ position: "relative" }}>
              <span 
                onClick={(e) => handleMenuClick(e, course.id)}
                style={{ 
                  width: "30px", 
                  height: "34px", 
                  color: "var(--text-muted)", 
                  cursor: "pointer", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  position: "relative", 
                  zIndex: activeMenuId === course.id ? 101 : 1,
                  borderRadius: "6px"
                }}
                title="خيارات المقرر"
              >
                <MoreVertical size={18} />
              </span>
              
              {activeMenuId === course.id && (
                <>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                    style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                  />
                  <div 
                    style={{
                      position: "absolute",
                      top: "35px",
                      left: "0",
                      background: "#2a2a2a",
                      border: "1px solid #444",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      zIndex: 100,
                      width: "170px",
                      overflow: "hidden"
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                  <div 
                    onClick={(e) => openRenameModal(e, course)}
                    style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #333", fontSize: "13px", color: "#fff" }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#333"}
                    onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    ✏️ تعديل اسم المقرر
                  </div>
                  <div 
                    onClick={(e) => togglePinAttendance(e, course)}
                    style={{ padding: "12px 15px", cursor: "pointer", borderBottom: "1px solid #333", fontSize: "13px", color: "#fff" }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#333"}
                    onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    {course.custom_week_names?.__pinned_attendance ? "📌 إلغاء الكاميرا" : "📷 تثبيت زر الحضور"}
                  </div>
                  <div 
                    onClick={(e) => openDeleteModal(e, course)}
                    style={{ padding: "12px 15px", cursor: "pointer", fontSize: "13px", color: "#f44336" }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#3a2020"}
                    onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    🗑️ حذف المقرر
                  </div>
                  <div 
                    onClick={(e) => {
                       e.stopPropagation();
                       setCourseToShare(course);
                       setActiveMenuId(null);
                    }}
                    style={{ padding: "12px 15px", cursor: "pointer", borderTop: "1px solid #333", fontSize: "13px", color: "#4CAF50" }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#2a3b2c"}
                    onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    🤝 طلب مشاركة المقرر مع زميل
                  </div>
                  </div>
                </>
              )}
            </div>
            
          </div>
        </div>
      ))}
      
      {/* Rename Modal */}
      {courseToRename && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center"
        }} onClick={() => setCourseToRename(null)}>
          <div style={{ background: "#222", padding: "20px", borderRadius: "15px", width: "90%", maxWidth: "350px", border: "1px solid #444" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 15px 0", color: "#fff" }}>تعديل اسم المقرر</h3>
            <input 
              type="text" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #555", background: "#111", color: "#fff", marginBottom: "20px" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                onClick={handleRenameSubmit}
                style={{ flex: 1, padding: "10px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
              >حفظ التعديل</button>
              <button 
                onClick={() => setCourseToRename(null)}
                style={{ flex: 1, padding: "10px", background: "#444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
              >إلغاء</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete/Archive Modal */}
      {courseToDelete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center"
        }} onClick={() => setCourseToDelete(null)}>
          <div style={{ background: "#222", padding: "25px", borderRadius: "15px", width: "90%", maxWidth: "350px", border: "1px solid #555", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>⚠️</div>
            <h3 style={{ margin: "0 0 10px 0", color: "#fff" }}>تحذير!</h3>
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "25px", lineHeight: "1.5" }}>
              هذا المقرر قد يحتوي على بيانات طلاب وكشوف غياب ومشاريع. هل أنت متأكد من رغبتك في حذفه؟
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {courseToDelete.teacher_id === user.id ? (
                // Owner
                courseToDelete.shared_with && courseToDelete.shared_with.length > 0 ? (
                  <>
                    <button 
                      onClick={handleDeleteForMeOnly}
                      style={{ width: "100%", padding: "12px", background: "#FF9800", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                    >حذف لدي فقط (يبقى للزملاء)</button>
                    <button 
                      onClick={handleArchiveGlobal}
                      style={{ width: "100%", padding: "12px", background: "#f44336", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                    >حذف عند الجميع (نقل للأرشيف)</button>
                  </>
                ) : (
                  <button 
                    onClick={handleArchiveGlobal}
                    style={{ width: "100%", padding: "12px", background: "#f44336", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                  >حذف المقرر (نقل للأرشيف)</button>
                )
              ) : (
                // Colleague
                <button 
                  onClick={handleLeaveCourse}
                  style={{ width: "100%", padding: "12px", background: "#FF9800", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                >حذف من قائمتي (انسحاب من المقرر)</button>
              )}

              <button 
                onClick={() => setCourseToDelete(null)}
                style={{ width: "100%", padding: "10px", background: "transparent", color: "#aaa", border: "none", cursor: "pointer", marginTop: "10px" }}
              >تراجع وإلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {courseToShare && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center"
        }} onClick={() => setCourseToShare(null)}>
          <div style={{ background: "#222", padding: "20px", borderRadius: "15px", width: "90%", maxWidth: "350px", border: "1px solid #4CAF50" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 15px 0", color: "#4CAF50" }}>🤝 طلب مشاركة المقرر مع زميل</h3>
            <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "15px", lineHeight: "1.5" }}>
              سيتم إرسال الطلب للمطور لإضافة الزميل للمقرر. بعد الإضافة، سيتمكن كلاكما من إدارة نفس المقرر بكل بياناته.
            </p>
            <input 
              type="text" 
              value={colleagueName}
              onChange={(e) => setColleagueName(e.target.value)}
              placeholder="اكتب اسم الزميل هنا..."
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #555", background: "#111", color: "#fff", marginBottom: "20px" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                onClick={handleShareSubmit}
                disabled={isSharing}
                style={{ flex: 1, padding: "10px", background: "#4CAF50", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", opacity: isSharing ? 0.7 : 1 }}
              >{isSharing ? "جاري الإرسال..." : "إرسال الطلب"}</button>
              <button 
                onClick={() => setCourseToShare(null)}
                style={{ flex: 1, padding: "10px", background: "#444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
              >إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
