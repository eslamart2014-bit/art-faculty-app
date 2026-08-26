"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface CoursesListProps {
  user: any;
  refreshTrigger: number;
}

export default function CoursesList({ user, refreshTrigger }: CoursesListProps) {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Menu and Modals state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [courseToRename, setCourseToRename] = useState<any>(null);
  const [newName, setNewName] = useState("");
  const [courseToDelete, setCourseToDelete] = useState<any>(null);
  const [courseToShare, setCourseToShare] = useState<any>(null);
  const [colleagueName, setColleagueName] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCourses();
    fetchProfiles();
  }, [user.id, refreshTrigger]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => map[p.id] = p.full_name);
      setProfilesMap(map);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
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
    }
    setLoading(false);
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
    setCourses(courses.map(c => c.id === course.id ? { ...c, custom_week_names: updatedCustom } : c));
    
    await supabase.from("courses").update({ custom_week_names: updatedCustom }).eq("id", course.id);
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
    setCourses(courses.map(c => c.id === courseToRename.id ? { ...c, name: newName } : c));
    setCourseToRename(null);

    await supabase.from("courses").update({ name: newName }).eq("id", courseToRename.id);
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

    setCourses(courses.filter(c => c.id !== courseToDelete.id));
    
    await supabase.from("archives").insert({
      user_id: user?.id,
      item_type: "course",
      description: `حذف مقرر للجميع: ${courseToDelete.name}`,
      original_data: { course_id: courseToDelete.id }
    });

    await supabase.from("courses").update({ custom_week_names: updatedCustom }).eq("id", courseToDelete.id);
    setCourseToDelete(null);
  };

  const handleDeleteForMeOnly = async () => {
    if (!courseToDelete) return;
    const currentCustom = courseToDelete.custom_week_names || {};
    const hiddenFor = currentCustom.__hidden_for || [];
    const updatedCustom = { ...currentCustom, __hidden_for: [...hiddenFor, user.id] };

    setCourses(courses.filter(c => c.id !== courseToDelete.id));
    await supabase.from("courses").update({ custom_week_names: updatedCustom }).eq("id", courseToDelete.id);
    setCourseToDelete(null);
  };

  const handleLeaveCourse = async () => {
    if (!courseToDelete) return;
    const sharedWith = courseToDelete.shared_with || [];
    const newShared = sharedWith.filter((id: string) => id !== user.id);

    setCourses(courses.filter(c => c.id !== courseToDelete.id));
    await supabase.from("courses").update({ shared_with: newShared }).eq("id", courseToDelete.id);
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
      {courses.map(course => (
        <div 
          key={course.id} 
          onClick={() => router.push(`/course/${course.id}`)}
          style={{ 
            background: "var(--surface)", 
            padding: "15px", 
            borderRadius: "12px", 
            border: "1px solid var(--border)", 
            borderRight: "6px solid var(--primary)", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            cursor: "pointer",
            transition: "transform 0.2s",
            position: "relative"
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 5px 0", color: "#fff", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              {course.name}
              {course.created_at && (
                <span style={{ fontSize: "10px", background: "#333", padding: "2px 6px", borderRadius: "10px", color: "#aaa", fontWeight: "normal" }}>
                  {new Date(course.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )}
              {course.shared_with && course.shared_with.length > 0 && (
                <span style={{ fontSize: "10px", background: "#4CAF50", padding: "2px 6px", borderRadius: "10px", color: "#fff", fontWeight: "normal" }}>
                  🤝 مشترك مع {
                    course.teacher_id === user.id 
                    ? course.shared_with.map((id: string) => profilesMap[id] || "زميل").join(" و ")
                    : profilesMap[course.teacher_id] || "الزميل"
                  }
                </span>
              )}
            </h3>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              الفرقة {course.academic_year} • {course.course_type === "lectures" ? "محاضرات" : `سكاشن: ${course.sections.join(", ")}`}
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            
            {course.custom_week_names?.__pinned_attendance && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/course/${course.id}/attendance?mode=camera`);
                }}
                style={{ fontSize: "22px", cursor: "pointer", background: "rgba(76, 175, 80, 0.15)", padding: "5px 10px", borderRadius: "8px", border: "1px solid rgba(76, 175, 80, 0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="تسجيل الحضور السريع"
              >
                📷
              </span>
            )}
            
            <div style={{ position: "relative" }}>
              <span 
                onClick={(e) => handleMenuClick(e, course.id)}
                style={{ fontSize: "24px", color: "var(--text-muted)", cursor: "pointer", padding: "0 10px", position: "relative", zIndex: activeMenuId === course.id ? 101 : 1 }}
              >
                ⋮
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
            
            <div style={{ fontSize: "20px", color: "var(--primary)" }}>
              🡰
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
