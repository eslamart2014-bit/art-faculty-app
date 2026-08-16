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
  const [archives, setArchives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchArchives();
    }
  }, [isOpen, user]);

  const fetchArchives = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("archives")
      .select("*")
      .order("created_at", { ascending: false });
    
    setArchives(data || []);
    setLoading(false);
  };

  const handleRestore = async (archive: any) => {
    if (!confirm("هل أنت متأكد من استعادة هذا العنصر إلى مكانه الطبيعي؟")) return;
    
    try {
      if (archive.item_type === "course") {
        // Course is soft-deleted. original_data contains { course_id: ... }
        const courseId = archive.original_data.course_id;
        const { data: cData } = await supabase.from("courses").select("custom_week_names").eq("id", courseId).single();
        if (cData) {
          const names = cData.custom_week_names || {};
          names.__archived = false;
          await supabase.from("courses").update({ custom_week_names: names }).eq("id", courseId);
        }
      }
      else if (archive.item_type === "student") {
        // Student was excluded. original_data contains { course_id: ..., student_id: ... }
        const { course_id, student_id } = archive.original_data;
        const { data: cData } = await supabase.from("courses").select("excluded_students").eq("id", course_id).single();
        if (cData) {
          const excluded = (cData.excluded_students || []).filter((id: string) => id !== student_id);
          await supabase.from("courses").update({ excluded_students: excluded }).eq("id", course_id);
        }
      }
      else {
        // Hard-deleted items (attendance, grades) can be just re-inserted
        let tableName = "";
        if (archive.item_type === "attendance") tableName = "attendance";
        else if (archive.item_type === "grade" || archive.item_type === "evaluation") tableName = "evaluations";
        
        if (tableName) {
          await supabase.from(tableName).insert(archive.original_data);
        }
      }

      // Delete from archives
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
      // Actually delete the course from DB now
      const courseId = archive.original_data.course_id;
      await supabase.from("courses").delete().eq("id", courseId);
    }
    
    await supabase.from("archives").delete().eq("id", itemToDelete);
    setArchives(archives.filter(a => a.id !== itemToDelete));
    setShowPasswordModal(false);
    setItemToDelete(null);
    alert("تم الحذف نهائياً بلا رجعة.");
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
            <span>🗄️</span> الأرشيف والمحذوفات
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: "24px", cursor: "pointer" }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto", direction: "rtl" }}>
          <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px" }}>
            هنا تجد كافة العناصر (مقررات، طلاب، درجات) التي قمت بحذفها من النظام. يمكنك استعادتها مرة أخرى أو حذفها نهائياً ولا يمكن التراجع عن الحذف النهائي.
          </p>

          {loading ? (
            <div style={{ textAlign: "center", color: "#888", marginTop: "50px" }}>جاري التحميل...</div>
          ) : archives.length === 0 ? (
            <div style={{ textAlign: "center", color: "#555", marginTop: "50px", fontSize: "18px" }}>
              <div>🗑️</div>
              الأرشيف فارغ حالياً
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
                      ❌ حذف نهائي
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
