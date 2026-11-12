import { useState, useEffect } from "react";
import { supabase } from "@/lib/core/supabase";
import PasswordConfirmModal from "@/components/auth/PasswordConfirmModal";
import { Archive, Download, GraduationCap, Inbox, RotateCcw, Search, Trash2, X } from "lucide-react";

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

  const [searchQuery, setSearchQuery] = useState("");

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
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("is_active", false)
        .order("student_code", { ascending: true })
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
    setGraduates(all);
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
      // مسح كافة وسائط وصور المقرر من سحابة التخزين
      try {
        await fetch('/api/courses/delete-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ course_id: courseId })
        });
      } catch (e) {}
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
        background: "var(--background)", zIndex: 1000,
        display: "flex", flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          padding: "12px 18px", 
          background: "var(--bg-deep)", 
          borderBottom: "1px solid var(--border)", 
          direction: "rtl",
          minHeight: "56px"
        }}>
          <div>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Archive size={18} strokeWidth={1.5} color="var(--accent-ink)" />
              <span>الأرشيف الشامل</span>
            </h3>
            <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
              جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="modal-close-btn"
            title="إغلاق"
            aria-label="إغلاق"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "var(--bg-deep)", borderBottom: "1px solid var(--border)", direction: "rtl" }}>
          <button 
            onClick={() => setActiveTab("general")}
            style={{
              flex: 1, padding: "12px",
              background: activeTab === "general" ? "var(--surface)" : "transparent",
              color: activeTab === "general" ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
              borderBottom: activeTab === "general" ? "2px solid var(--primary)" : "2px solid transparent",
              fontWeight: activeTab === "general" ? 600 : 500,
              cursor: "pointer", fontSize: "14px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
            }}
          >
            <Archive size={16} strokeWidth={1.5} />
            <span>الأرشيف العام (المحذوفات)</span>
          </button>
          <button 
            className="tabular-nums"
            onClick={() => setActiveTab("graduates")}
            style={{
              flex: 1, padding: "12px",
              background: activeTab === "graduates" ? "var(--surface)" : "transparent",
              color: activeTab === "graduates" ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
              borderBottom: activeTab === "graduates" ? "2px solid var(--primary)" : "2px solid transparent",
              fontWeight: activeTab === "graduates" ? 600 : 500,
              cursor: "pointer", fontSize: "14px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
            }}
          >
            <GraduationCap size={16} strokeWidth={1.5} />
            <span>أرشيف الخريجين {graduates.length > 0 ? `(${graduates.length})` : ""}</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto", direction: "rtl" }}>
          {activeTab === "general" && (
            <>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px" }}>
                هنا تجد جميع العناصر (مقررات، غياب، درجات) التي قمت بحذفها. يمكنك استعادتها أو حذفها نهائياً.
              </p>

              {loading ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "50px" }}>جاري التحميل...</div>
              ) : archives.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-dim)", marginTop: "50px", fontSize: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <Inbox size={36} strokeWidth={1.5} style={{ opacity: 0.45 }} />
                  <span>الأرشيف العام فارغ</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {archives.map(item => (
                    <div key={item.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                      <div>
                        <h4 style={{ margin: "0 0 6px 0", color: "var(--text-primary)", fontSize: "15px", fontWeight: 600 }}>{item.description}</h4>
                        <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: "6px", display: "inline-block" }}>
                          {new Date(item.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button 
                          onClick={() => handleRestore(item)}
                          style={{ background: "var(--success)", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <RotateCcw size={14} strokeWidth={1.5} />
                          <span>استعادة</span>
                        </button>
                        <button 
                          onClick={() => handlePermanentDeleteClick(item.id)}
                          style={{ background: "transparent", color: "var(--error-ink)", border: "1px solid var(--error)", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                          <span>حذف نهائي</span>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "15px" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
                  الطلاب الذين اختفوا من شيت المزامنة وتم تحويلهم لخريجين/منقولين للحفاظ على أكوادهم القديمة وبياناتهم.
                </p>
                <button 
                  onClick={handleExportGraduatesCSV}
                  disabled={graduates.length === 0}
                  style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: graduates.length === 0 ? "not-allowed" : "pointer", opacity: graduates.length === 0 ? 0.5 : 1, fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Download size={14} strokeWidth={1.5} />
                  <span>تحميل أرشيف الخريجين CSV</span>
                </button>
              </div>

              {/* Search input for graduates */}
              <div style={{ marginBottom: "15px", position: "relative" }}>
                <Search size={15} strokeWidth={1.5} color="var(--text-dim)" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="بحث في الخريجين بالاسم أو الكود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 14px",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {loading ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "50px" }}>جاري التحميل...</div>
              ) : graduates.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-dim)", marginTop: "50px", fontSize: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <Inbox size={36} strokeWidth={1.5} style={{ opacity: 0.45 }} />
                  <span>لا يوجد خريجين في الأرشيف</span>
                </div>
              ) : (
                (() => {
                  const filtered = graduates.filter(g => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.trim().toLowerCase();
                    return (
                      (g.full_name && g.full_name.toLowerCase().includes(q)) ||
                      (g.student_code && String(g.student_code).includes(q)) ||
                      (g.academic_year && g.academic_year.includes(q))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "30px", fontSize: "14px" }}>
                        لم يتم العثور على نتائج مطابقة للبحث &quot;{searchQuery}&quot;
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                      {filtered.map(g => (
                        <div key={g.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
                          <h4 style={{ margin: "0 0 8px 0", color: "var(--text-primary)", fontSize: "14px", fontWeight: 600, lineHeight: "1.4" }}>{g.full_name}</h4>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                            <span>الكود: <strong className="tabular-nums" style={{ color: "var(--accent-ink)", fontWeight: 600, letterSpacing: "0.5px" }}>{g.student_code}</strong></span>
                            <span>الفرقة: {g.academic_year}</span>
                          </div>
                          <button 
                            onClick={() => handleRestoreGraduate(g.id)}
                            style={{ width: "100%", background: "rgba(16, 185, 129, 0.08)", color: "var(--success-ink)", border: "1px solid var(--success)", padding: "7px 10px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                          >
                            <RotateCcw size={13} strokeWidth={1.5} />
                            <span>تنشيط وإعادة للنظام</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()
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
