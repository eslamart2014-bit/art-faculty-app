"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/core/supabase";
import { AlertTriangle, Calendar, Camera, CheckCircle2, Download, Edit3, MoreVertical, PinOff, RefreshCw, Settings, Trash2, Users, Zap } from "lucide-react";
import { forceDownloadFacultyOfflinePack } from "@/lib/admin/preloadFacultyData";

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
  const [autoSyncedBadge, setAutoSyncedBadge] = useState(false);

  // Auto-Sync in background when internet connection returns and is strong
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;

    let lastAutoSync = 0;

    const triggerAutoSyncIfGood = async () => {
      if (!navigator.onLine) return;
      const now = Date.now();
      if (now - lastAutoSync < 45000) return; // Prevent spamming within 45 seconds

      const conn = (navigator as any).connection;
      const isStrong = !conn || (conn.effectiveType === '4g' || !conn.saveData);

      if (isStrong) {
        lastAutoSync = now;
        try {
          // 1. Process any pending queue actions (attendance/evaluations recorded while offline)
          const { processQueue } = await import("@/lib/admin/syncEngine");
          await processQueue();

          // 2. Quietly update local pack in background
          const res = await forceDownloadFacultyOfflinePack(user.id);
          if (res.success) {
            try {
              const meta = localStorage.getItem(`cached_offline_pack_meta_${user.id}`);
              if (meta) setOfflinePackMeta(JSON.parse(meta));
              const cached = localStorage.getItem(`cached_courses_${user.id}`);
              if (cached) setCourses(JSON.parse(cached));
            } catch (e) {}

            setAutoSyncedBadge(true);
            setTimeout(() => setAutoSyncedBadge(false), 4000);
          }
        } catch (e) {}
      }
    };

    window.addEventListener('online', triggerAutoSyncIfGood);
    const conn = (navigator as any).connection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', triggerAutoSyncIfGood);
    }

    return () => {
      window.removeEventListener('online', triggerAutoSyncIfGood);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', triggerAutoSyncIfGood);
      }
    };
  }, [user?.id]);

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
      <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "13px" }}>
        جاري تحميل المقررات...
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 20px", background: "var(--surface)", border: "1px dashed var(--border-light)", borderRadius: "12px", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", marginBottom: "8px" }}>
          لا توجد مقررات دراسية حالياً
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
          <span>اضغط على أيقونة الإعدادات</span>
          <Settings size={14} strokeWidth={1.5} color="var(--accent-ink)" />
          <span>ثم اختر «إضافة مقرر» لتبدأ.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Auto-Sync Badge when Strong Connection Syncs */}
      {autoSyncedBadge && (
        <div style={{
          background: "rgba(16, 185, 129, 0.12)",
          border: "1px solid rgba(16, 185, 129, 0.35)",
          borderRadius: "10px",
          padding: "10px 12px",
          fontSize: "12px",
          color: "var(--success-ink)",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          direction: "rtl",
          animation: "fadeIn 0.25s var(--ease-out)"
        }}>
          <CheckCircle2 size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span>تم التحديث والمزامنة تلقائياً مع استقرار اتصال الإنترنت.</span>
        </div>
      )}

      {/* Offline Pack Status & One-Click Download Widget */}
      <div style={{
        background: offlinePackMeta ? "rgba(16, 185, 129, 0.08)" : "rgba(37, 99, 235, 0.08)",
        border: `1px solid ${offlinePackMeta ? "rgba(16, 185, 129, 0.28)" : "rgba(56, 189, 248, 0.25)"}`,
        borderRadius: "12px",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        direction: "rtl"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: offlinePackMeta ? "rgba(16, 185, 129, 0.15)" : "rgba(37, 99, 235, 0.16)",
            border: `1px solid ${offlinePackMeta ? "rgba(16, 185, 129, 0.3)" : "rgba(56, 189, 248, 0.28)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: offlinePackMeta ? "var(--success-ink)" : "var(--accent-ink)",
            flexShrink: 0
          }}>
            {offlinePackMeta ? <Zap size={18} strokeWidth={1.5} /> : <Download size={18} strokeWidth={1.5} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: offlinePackMeta ? "var(--success-ink)" : "var(--accent-ink)" }}>
              {offlinePackMeta ? "وضع العمل السريع مفعّل (0ms)" : "حفظ المقررات للعمل بدون إنترنت"}
            </div>
            <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
              {offlinePackMeta
                ? `بيانات (${courses.length}) مقررات و (${offlinePackMeta.studentsCount || 0}) طالباً محفوظة محلياً`
                : "اضغط لتنزيل مقرراتك وطلابك للعمل في قاعات الكلية بدون نت"}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-compact"
          onClick={handleDownloadOfflinePack}
          disabled={downloadingPack}
          style={{
            background: offlinePackMeta ? "var(--surface)" : "var(--primary)",
            color: offlinePackMeta ? "var(--text)" : "#ffffff",
            border: offlinePackMeta ? "1px solid var(--border-light)" : "1px solid var(--primary)",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: downloadingPack ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
            margin: 0
          }}
        >
          {downloadingPack ? (
            <>
              <RefreshCw size={14} strokeWidth={1.5} className="animate-spin" />
              <span>جاري الحفظ...</span>
            </>
          ) : offlinePackMeta ? (
            <>
              <RefreshCw size={14} strokeWidth={1.5} />
              <span>تحديث الحزمة</span>
            </>
          ) : (
            <>
              <Download size={14} strokeWidth={1.5} />
              <span>تنزيل الآن</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Modal during Download */}
      {downloadingPack && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0, 0, 0, 0.78)",
          zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px", direction: "rtl"
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "16px",
            padding: "24px", maxWidth: "400px", width: "100%", textAlign: "center"
          }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "12px",
              background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "var(--accent-ink)", marginBottom: "12px"
            }}>
              <Zap size={24} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: "0 0 8px 0", color: "var(--text)", fontSize: "16px", fontWeight: 600 }}>
              تجهيز حزمة العمل السريع بدون إنترنت
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {packProgressStep}
            </p>
            {/* Progress Bar */}
            <div style={{ width: "100%", height: "8px", background: "var(--bg-deep)", borderRadius: "4px", overflow: "hidden", marginBottom: "10px", border: "1px solid var(--border)" }}>
              <div style={{
                width: `${packProgressPercent}%`, height: "100%",
                background: "var(--primary)",
                transition: "width 0.3s var(--ease-out)"
              }} />
            </div>
            <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--accent-ink)", fontWeight: 600 }}>
              {packProgressPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showPackSuccessToast && (
        <div style={{
          position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
          background: "#065f46", border: "1px solid rgba(16, 185, 129, 0.45)", color: "#ffffff",
          padding: "12px 18px", borderRadius: "12px",
          display: "flex", alignItems: "center", gap: "8px", zIndex: 999999,
          direction: "rtl", fontSize: "13px", fontWeight: 500, maxWidth: "90vw"
        }}>
          <CheckCircle2 size={18} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span>تم حفظ كافة بياناتك وطلابك على الهاتف بنجاح. التطبيق جاهز للعمل بدون إنترنت.</span>
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
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            borderRight: "4px solid var(--primary)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            transition: "border-color 0.15s var(--ease-out), background 0.15s var(--ease-out)",
            position: "relative",
            boxSizing: "border-box"
          }}
        >
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
            {/* السطر الأول: اسم المقرر + شارة المشاركة الذكية */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, color: "var(--text)", fontSize: "15px", fontWeight: 600, wordBreak: "break-word" }}>
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
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "var(--success-ink)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    maxWidth: "200px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  <Users size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
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
            <div className="tabular-nums" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
              <span>الفرقة {course.academic_year}</span>
              <span style={{ color: "var(--text-muted)" }}>•</span>
              <span>{course.course_type === "lectures" ? "محاضرات" : `سكاشن: ${Array.isArray(course.sections) ? course.sections.join(", ") : course.sections || "عام"}`}</span>
              {course.created_at && (
                <>
                  <span style={{ color: "var(--text-muted)" }}>•</span>
                  <span
                    title="تاريخ إنشاء المقرر"
                    className="tabular-nums"
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      background: "var(--bg-deep)",
                      border: "1px solid var(--border)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      direction: "ltr",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <Calendar size={11} strokeWidth={1.5} />
                    <span>{formatCourseDate(course.created_at)}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>

            {course.custom_week_names?.__pinned_attendance && (
              <button
                type="button"
                className="btn-compact"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/course/${course.id}/attendance?mode=camera`);
                }}
                style={{
                  width: "34px",
                  height: "34px",
                  padding: 0,
                  cursor: "pointer",
                  background: "rgba(16, 185, 129, 0.14)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--success-ink)",
                  transition: "background 0.15s var(--ease-out)",
                  flexShrink: 0,
                  margin: 0
                }}
                title="تسجيل الحضور السريع بالكاميرا"
              >
                <Camera size={16} strokeWidth={1.5} />
              </button>
            )}

            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="btn-compact"
                onClick={(e) => handleMenuClick(e, course.id)}
                style={{
                  width: "32px",
                  height: "34px",
                  padding: 0,
                  background: activeMenuId === course.id ? "var(--surface-hover)" : "transparent",
                  border: "1px solid transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: activeMenuId === course.id ? 101 : 1,
                  borderRadius: "8px",
                  margin: 0
                }}
                title="خيارات المقرر"
              >
                <MoreVertical size={18} strokeWidth={1.5} />
              </button>

              {activeMenuId === course.id && (
                <>
                  <div
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                    style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "38px",
                      left: "0",
                      background: "var(--surface)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "10px",
                      zIndex: 100,
                      width: "196px",
                      overflow: "hidden"
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      onClick={(e) => openRenameModal(e, course)}
                      style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}
                      onMouseOver={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <Edit3 size={14} strokeWidth={1.5} color="var(--accent-ink)" />
                      <span>تعديل اسم المقرر</span>
                    </div>
                    <div
                      onClick={(e) => togglePinAttendance(e, course)}
                      style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}
                      onMouseOver={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {course.custom_week_names?.__pinned_attendance ? (
                        <>
                          <PinOff size={14} strokeWidth={1.5} color="var(--warning-ink)" />
                          <span>إلغاء زر الكاميرا</span>
                        </>
                      ) : (
                        <>
                          <Camera size={14} strokeWidth={1.5} color="var(--success-ink)" />
                          <span>تثبيت زر الحضور</span>
                        </>
                      )}
                    </div>
                    <div
                      onClick={(e) => openDeleteModal(e, course)}
                      style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--error-ink)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                      <span>حذف المقرر</span>
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setCourseToShare(course);
                        setActiveMenuId(null);
                      }}
                      style={{ padding: "11px 14px", cursor: "pointer", fontSize: "13px", color: "var(--success-ink)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(16, 185, 129, 0.1)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <Users size={14} strokeWidth={1.5} />
                      <span>طلب مشاركة مع زميل</span>
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
          position: "fixed", inset: 0,
          background: "rgba(0, 0, 0, 0.72)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"
        }} onClick={() => setCourseToRename(null)}>
          <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "16px", width: "100%", maxWidth: "360px", border: "1px solid var(--border-light)", boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px 0", color: "var(--text)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Edit3 size={17} strokeWidth={1.5} color="var(--accent-ink)" />
              <span>تعديل اسم المقرر</span>
            </h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "var(--bg-deep)", color: "var(--text)", marginBottom: "16px", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleRenameSubmit}
                style={{ flex: 1, padding: "10px", background: "var(--primary)", color: "#ffffff", border: "1px solid var(--primary)", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "13px", margin: 0 }}
              >حفظ التعديل</button>
              <button
                type="button"
                onClick={() => setCourseToRename(null)}
                style={{ flex: 1, padding: "10px", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "13px", margin: 0 }}
              >إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete/Archive Modal */}
      {courseToDelete && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0, 0, 0, 0.78)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"
        }} onClick={() => setCourseToDelete(null)}>
          <div style={{ background: "var(--surface)", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "360px", border: "1px solid var(--border-light)", textAlign: "center", boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--warning-ink)", marginBottom: "12px" }}>
              <AlertTriangle size={22} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: "0 0 8px 0", color: "var(--text)", fontSize: "16px", fontWeight: 600 }}>تأكيد حذف المقرر</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "0 0 20px 0", lineHeight: 1.6 }}>
              هذا المقرر قد يحتوي على بيانات طلاب وكشوف غياب ومشاريع. هل أنت متأكد من رغبتك في حذفه؟
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {courseToDelete.teacher_id === user.id ? (
                courseToDelete.shared_with && courseToDelete.shared_with.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDeleteForMeOnly}
                      style={{ width: "100%", padding: "11px", background: "var(--warning)", color: "#ffffff", border: "1px solid var(--warning)", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "13px", margin: 0 }}
                    >حذف لدي فقط (يبقى للزملاء)</button>
                    <button
                      type="button"
                      onClick={handleArchiveGlobal}
                      style={{ width: "100%", padding: "11px", background: "var(--error)", color: "#ffffff", border: "1px solid var(--error)", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "13px", margin: 0 }}
                    >حذف عند الجميع (نقل للأرشيف)</button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleArchiveGlobal}
                    style={{ width: "100%", padding: "11px", background: "var(--error)", color: "#ffffff", border: "1px solid var(--error)", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "13px", margin: 0 }}
                  >حذف المقرر (نقل للأرشيف)</button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleLeaveCourse}
                  style={{ width: "100%", padding: "11px", background: "var(--warning)", color: "#ffffff", border: "1px solid var(--warning)", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "13px", margin: 0 }}
                >حذف من قائمتي (انسحاب من المقرر)</button>
              )}

              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                style={{ width: "100%", padding: "10px", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "13px", marginTop: "4px", marginBottom: 0 }}
              >تراجع وإلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {courseToShare && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0, 0, 0, 0.72)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"
        }} onClick={() => setCourseToShare(null)}>
          <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "16px", width: "100%", maxWidth: "360px", border: "1px solid var(--border-light)", boxSizing: "border-box" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 10px 0", color: "var(--success-ink)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={18} strokeWidth={1.5} />
              <span>طلب مشاركة المقرر مع زميل</span>
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 14px 0", lineHeight: 1.6 }}>
              سيتم إرسال الطلب للمطور لإضافة الزميل للمقرر. بعد الإضافة، سيتمكن كلاكما من إدارة نفس المقرر بكل بياناته.
            </p>
            <input
              type="text"
              value={colleagueName}
              onChange={(e) => setColleagueName(e.target.value)}
              placeholder="اكتب اسم الزميل هنا..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "var(--bg-deep)", color: "var(--text)", marginBottom: "16px", fontSize: "13px", boxSizing: "border-box", outline: "none" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleShareSubmit}
                disabled={isSharing}
                style={{ flex: 1, padding: "10px", background: "var(--success)", color: "#ffffff", border: "1px solid var(--success)", borderRadius: "8px", cursor: isSharing ? "not-allowed" : "pointer", fontWeight: 500, fontSize: "13px", opacity: isSharing ? 0.7 : 1, margin: 0 }}
              >{isSharing ? "جاري الإرسال..." : "إرسال الطلب"}</button>
              <button
                type="button"
                onClick={() => setCourseToShare(null)}
                style={{ flex: 1, padding: "10px", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", borderRadius: "8px", cursor: "pointer", fontWeight: 500, fontSize: "13px", margin: 0 }}
              >إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
