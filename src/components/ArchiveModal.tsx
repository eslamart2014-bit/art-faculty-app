import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import PasswordConfirmModal from "./PasswordConfirmModal";

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onItemRestored?: () => void;
}

export default function ArchiveModal({ isOpen, onClose, user, onItemRestored }: ArchiveModalProps) {
  useEffect(() => {
    window.history.pushState({ modal: true }, "");
  }, []);

  const [activeTab, setActiveTab] = useState<"general" | "graduates">("general");
  const [archives, setArchives] = useState<any[]>([]);
  const [graduates, setGraduates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      if (activeTab === "general") fetchArchives();
      else fetchGraduates();
    }
  }, [isOpen, user, activeTab]);

  const fetchArchives = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("archives")
      .select("*")
      .order("created_at", { ascending: false });
    
    setArchives(data || []);
    setLoading(false);
  };

  const fetchGraduates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("is_active", false)
      .order("updated_at", { ascending: false });
    
    setGraduates(data || []);
    setLoading(false);
  };

  const handleRestore = async (archive: any) => {
    if (!confirm("هل أنت متأكد من استعادة هذا العنصر إلى مكانه الطبيعي؟")) return;
    
    try {
      if (archive.item_type === "course") {
        const courseId = archive.original_data.course_id;
        const { data: cData } = await supabase.from("courses").select("custom_week_names").eq("id", courseId).single();
        if (cData) {
          const names = cData.custom_week_names || {};
          names.__archived = false;
          await supabase.from("courses").update({ custom_week_names: names }).eq("id", courseId);
        }
      }
      else if (archive.item_type === "student") {
        const { course_id, student_id } = archive.original_data;
        const { data: cData } = await supabase.from("courses").select("excluded_students").eq("id", course_id).single();
        if (cData) {
          const excluded = (cData.excluded_students || []).filter((id: string) => id !== student_id);
          await supabase.from("courses").update({ excluded_students: excluded }).eq("id", course_id);
        }
      }
      else {
        let tableName = "";
        if (archive.item_type === "attendance") tableName = "attendance";
        else if (archive.item_type === "grade" || archive.item_type === "evaluation") tableName = "evaluations";
        
        if (tableName) {
          await supabase.from(tableName).insert(archive.original_data);
        }
      }

      await supabase.from("archives").delete().eq("id", archive.id);
      setArchives(archives.filter(a => a.id !== archive.id));
      alert("تم الاستعادة بنجاح!");
      if (onItemRestored) onItemRestored();
      
    } catch (err: any) {
      alert("حدث خطأ أثناء الاستعادة: " + err.message);
    }
  };

  const handlePermanentDeleteClick = (id: string) => {
    setItemToDelete(id);
    setShowPasswordModal(true);
  };

  const executePermanentDelete = async () => {
    if (!itemToDelete) return;
    
    const archive = archives.find(a => a.id === itemToDelete);
    if (archive && archive.item_type === "course") {
      const courseId = archive.original_data.course_id;
      await supabase.from("courses").delete().eq("id", courseId);
    }
    
    await supabase.from("archives").delete().eq("id", itemToDelete);
    setArchives(archives.filter(a => a.id !== itemToDelete));
    setShowPasswordModal(false);
    setItemToDelete(null);
    alert("تم الحذف النهائي بنجاح.");
  };

  const handleRestoreGraduate = async (studentId: string) => {
    if (!confirm("هل تريد إعادة هذا الخريج إلى النظام النشط؟")) return;
    setLoading(true);
    await supabase.from("students").update({ is_active: true }).eq("id", studentId);
    setGraduates(graduates.filter(g => g.id !== studentId));
    alert("تم إعادة تنشيط الطالب بنجاح.");
    setLoading(false);
  };

  const handleExportGraduatesCSV = () => {
    if (graduates.length === 0) return;
    let csvContent = "\uFEFFالاسم,الكود,الفرقة (قبل التخرج),تاريخ الأرشفة\n";
    graduates.forEach(s => {
      csvContent += `${s.full_name},="${s.student_code}",${s.academic_year},${new Date(s.updated_at || s.created_at).toLocaleDateString("ar-EG")}\n`;
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `أرشيف_الخريجين.csv`;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <>
      <div style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        background: "rgba(0,0,0,0.85)", zIndex: 1000,
        display: "flex", flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px", background: "#1e1e1e", borderBottom: "1px solid #333", direction: "rtl" }}>
          <h2 style={{ margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>🗄️</span> الأرشيف الشامل
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: "24px", cursor: "pointer" }}>✖</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#111", borderBottom: "1px solid #333", direction: "rtl" }}>
          <button 
            onClick={() => setActiveTab("general")}
            style={{ flex: 1, padding: "12px", background: activeTab === "general" ? "#222" : "transparent", color: activeTab === "general" ? "#fff" : "#888", border: "none", borderBottom: activeTab === "general" ? "2px solid #2196F3" : "none", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
          >
            الأرشيف العام (المحذوفات)
          </button>
          <button 
            onClick={() => setActiveTab("graduates")}
            style={{ flex: 1, padding: "12px", background: activeTab === "graduates" ? "#222" : "transparent", color: activeTab === "graduates" ? "#fff" : "#888", border: "none", borderBottom: activeTab === "graduates" ? "2px solid #2196F3" : "none", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
          >
            أرشيف الخريجين 🎓
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto", direction: "rtl" }}>
          {activeTab === "general" && (
            <>
              <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px" }}>
                هنا تجد جميع العناصر (مقررات، غياب، درجات) التي قمت بحذفها. يمكنك استعادتها أو حذفها نهائياً.
              </p>

              {loading ? (
                <div style={{ textAlign: "center", color: "#888", marginTop: "50px" }}>جاري التحميل...</div>
              ) : archives.length === 0 ? (
                <div style={{ textAlign: "center", color: "#555", marginTop: "50px", fontSize: "18px" }}>
                  <div>📭</div>
                  الأرشيف العام فارغ
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  {archives.map(item => (
                    <div key={item.id} style={{ background: "#222", border: "1px solid #444", borderRadius: "10px", padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                      <div>
                        <h4 style={{ margin: "0 0 5px 0", color: "#fff", fontSize: "15px" }}>{item.description}</h4>
                        <span style={{ fontSize: "11px", color: "#777", background: "#111", padding: "3px 8px", borderRadius: "4px" }}>
                          {new Date(item.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button 
                          onClick={() => handleRestore(item)}
                          style={{ background: "#4CAF50", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                        >
                          🔄 استعادة
                        </button>
                        <button 
                          onClick={() => handlePermanentDeleteClick(item.id)}
                          style={{ background: "transparent", color: "#f44336", border: "1px solid #f44336", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                        >
                          🗑️ حذف نهائي
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "graduates" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <p style={{ color: "#aaa", fontSize: "14px", margin: 0 }}>
                  الطلاب الذين اختفوا من شيت المزامنة وتم تحويلهم لخريجين/منقولين للحفاظ على أكوادهم القديمة وبياناتهم.
                </p>
                <button 
                  onClick={handleExportGraduatesCSV}
                  disabled={graduates.length === 0}
                  style={{ background: "#2196F3", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                >
                  📥 تحميل أرشيف الخريجين
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: "center", color: "#888", marginTop: "50px" }}>جاري التحميل...</div>
              ) : graduates.length === 0 ? (
                <div style={{ textAlign: "center", color: "#555", marginTop: "50px", fontSize: "18px" }}>
                  <div>📭</div>
                  لا يوجد خريجين في الأرشيف
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
                  {graduates.map(g => (
                    <div key={g.id} style={{ background: "#222", border: "1px solid #444", borderRadius: "10px", padding: "15px" }}>
                      <h4 style={{ margin: "0 0 10px 0", color: "#fff", fontSize: "15px" }}>{g.full_name}</h4>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#aaa", marginBottom: "15px" }}>
                        <span>الكود: <strong style={{ color: "#2196F3" }}>{g.student_code}</strong></span>
                        <span>الفرقة: {g.academic_year}</span>
                      </div>
                      <button 
                        onClick={() => handleRestoreGraduate(g.id)}
                        style={{ width: "100%", background: "transparent", color: "#4CAF50", border: "1px solid #4CAF50", padding: "8px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                      >
                        🔄 تنشيط وإعادة للنظام
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <PasswordConfirmModal 
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        userEmail={user?.email || ""}
        onConfirm={executePermanentDelete}
      />
    </>
  );
}
