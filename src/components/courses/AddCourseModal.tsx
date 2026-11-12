"use client";

import { useState, useEffect } from "react";
import { BookOpen, Check, X } from "lucide-react";
import { supabase } from "@/lib/core/supabase";

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onCourseAdded: () => void;
}

export default function AddCourseModal({ isOpen, onClose, user, onCourseAdded }: AddCourseModalProps) {
  useEffect(() => {
    window.history.pushState({ modal: true }, "");
  }, []);

  const [courseName, setCourseName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [courseType, setCourseType] = useState<"sections" | "lectures">("sections");
  
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  
  const [loadingSections, setLoadingSections] = useState(false);
  const [saving, setSaving] = useState(false);

  const [availableYears, setAvailableYears] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setCourseName("");
      setAcademicYear("");
      setCourseType("sections");
      setAvailableSections([]);
      setSelectedSections([]);
      fetchAvailableYears();
    }
  }, [isOpen]);

  const fetchAvailableYears = async () => {
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("students")
        .select("academic_year")
        .eq("is_active", true)
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }

    if (all.length > 0) {
      const uniqueYears = Array.from(new Set(all.map((d: any) => d.academic_year))).filter(Boolean) as string[];
      // Sort them roughly
      const sortOrder: Record<string, number> = { "الأولى": 1, "الاولي": 1, "الثانية": 2, "الثالثة": 3, "الرابعة": 4 };
      uniqueYears.sort((a, b) => (sortOrder[a] || 99) - (sortOrder[b] || 99));
      setAvailableYears(uniqueYears);
    }
  };

  useEffect(() => {
    if (academicYear) {
      fetchAvailableSections(academicYear);
    } else {
      setAvailableSections([]);
      setSelectedSections([]);
    }
  }, [academicYear]);

  const fetchAvailableSections = async (year: string) => {
    setLoadingSections(true);
    let all: any[] = [];
    let from = 0;

    // 1. First fetch active students in this academic year with pagination
    while (true) {
      const { data, error } = await supabase
        .from("students")
        .select("section")
        .eq("academic_year", year)
        .eq("is_active", true)
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }

    // 2. Fallback if no active students found yet for this year
    if (all.length === 0) {
      from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("students")
          .select("section")
          .eq("academic_year", year)
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
    }

    if (all.length > 0) {
      const unique = Array.from(new Set(all.map((d: any) => String(d.section).trim()))).filter(Boolean) as string[];
      unique.sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b, 'ar');
      });
      setAvailableSections(unique);
    } else {
      setAvailableSections([]);
    }
    setLoadingSections(false);
  };

  const toggleSection = (sec: string) => {
    if (selectedSections.includes(sec)) {
      setSelectedSections(prev => prev.filter(s => s !== sec));
    } else {
      setSelectedSections(prev => [...prev, sec]);
    }
  };

  const selectAllSections = () => {
    setSelectedSections([...availableSections]);
  };

  const deselectAllSections = () => {
    setSelectedSections([]);
  };

  const saveCourse = async () => {
    if (!courseName.trim()) {
      alert("الرجاء إدخال اسم المقرر");
      return;
    }
    if (!academicYear) {
      alert("الرجاء اختيار الفرقة الدراسية");
      return;
    }
    if (courseType === "sections" && selectedSections.length === 0) {
      alert("الرجاء تحديد سكشن واحد على الأقل أو تغيير نوع المقرر إلى محاضرات");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/courses/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: courseName.trim(),
          academic_year: academicYear,
          course_type: courseType,
          sections: courseType === "sections" ? selectedSections : [],
          teacher_id: user?.id || null
        })
      });

      const data = await res.json();
      setSaving(false);

      if (!res.ok || !data.success) {
        alert("حدث خطأ أثناء حفظ المقرر: " + (data.message || "خطأ غير معروف في السيرفر"));
      } else {
        alert("تم حفظ المقرر بنجاح!");
        onCourseAdded();
        onClose();
      }
    } catch (err: any) {
      setSaving(false);
      alert("فشل الاتصال بالسيرفر لحفظ المقرر: " + (err.message || "تأكد من اتصالك بالإنترنت"));
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.72)", zIndex: 300, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: "400px", maxHeight: "86vh", display: "flex", flexDirection: "column", position: "relative", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "20px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", paddingBottom: "14px", marginBottom: "16px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={18} strokeWidth={1.5} color="var(--accent-ink)" />
            <span>إضافة مقرر جديد</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="btn-compact"
            title="إغلاق"
            style={{ width: "30px", height: "30px", padding: 0, borderRadius: "8px", background: "var(--surface-hover)", border: "1px solid var(--border-light)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: 0 }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flexGrow: 1, overflowY: "auto", paddingLeft: "2px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px", display: "block", textAlign: "right" }}>
            1. اسم المقرر
          </label>
          <input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="مثال: الرسم والتصوير 1"
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-deep)", color: "var(--text)", border: "1px solid var(--border-light)", fontSize: "13px", marginBottom: "14px", boxSizing: "border-box", outline: "none" }}
          />

          <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px", display: "block", textAlign: "right" }}>
            2. الفرقة الدراسية
          </label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-deep)", color: "var(--text)", border: "1px solid var(--border-light)", fontSize: "13px", marginBottom: "14px", boxSizing: "border-box", outline: "none" }}
          >
            <option value="">-- اختر الفرقة --</option>
            {availableYears.map(y => (
              <option key={y} value={y}>الفرقة {y}</option>
            ))}
          </select>

          <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px", display: "block", textAlign: "right" }}>
            3. طبيعة المقرر
          </label>
          <select
            value={courseType}
            onChange={(e) => setCourseType(e.target.value as "sections" | "lectures")}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-deep)", color: "var(--text)", border: "1px solid var(--border-light)", fontSize: "13px", marginBottom: "14px", boxSizing: "border-box", outline: "none" }}
          >
            <option value="sections">سكاشن (تحديد السكاشن الخاصة بك)</option>
            <option value="lectures">محاضرات (كامل طلاب الفرقة تلقائياً)</option>
          </select>

          {courseType === "sections" && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
                <label className="tabular-nums" style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", margin: 0, textAlign: "right" }}>
                  4. السكاشن المتاحة {availableSections.length > 0 && `(${availableSections.length} سكشن)`}
                </label>
                {availableSections.length > 0 && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="btn-compact"
                      onClick={selectAllSections}
                      style={{ background: "rgba(37, 99, 235, 0.14)", color: "var(--accent-ink)", border: "1px solid rgba(56, 189, 248, 0.35)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, cursor: "pointer", margin: 0 }}
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      className="btn-compact"
                      onClick={deselectAllSections}
                      style={{ background: "var(--bg-deep)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, cursor: "pointer", margin: 0 }}
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>

              {!academicYear ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "16px", border: "1px dashed var(--border-light)", borderRadius: "8px" }}>
                  اختر الفرقة أولاً
                </div>
              ) : loadingSections ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "16px", border: "1px dashed var(--border-light)", borderRadius: "8px" }}>
                  جاري تحميل كافة السكاشن...
                </div>
              ) : availableSections.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--error-ink)", fontSize: "12px", padding: "16px", border: "1px dashed rgba(239, 68, 68, 0.35)", borderRadius: "8px", background: "rgba(239, 68, 68, 0.06)" }}>
                  لم يتم العثور على أي سكاشن في قاعدة بيانات هذه الفرقة. تأكد من رفع كشوف الطلاب أولاً.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px", maxHeight: "168px", overflowY: "auto" }}>
                  {availableSections.map(sec => {
                    const isActive = selectedSections.includes(sec);
                    return (
                      <button
                        type="button"
                        key={sec}
                        onClick={() => toggleSection(sec)}
                        className="tabular-nums btn-compact"
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: isActive ? "1px solid var(--primary)" : "1px solid var(--border-light)",
                          background: isActive ? "var(--primary)" : "var(--bg-deep)",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: isActive ? "#ffffff" : "var(--text-secondary)",
                          cursor: "pointer",
                          userSelect: "none",
                          transition: "background 0.15s var(--ease-out), border-color 0.15s var(--ease-out)",
                          flexGrow: 1,
                          minWidth: "60px",
                          maxWidth: "88px",
                          margin: 0
                        }}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            onClick={saveCourse}
            disabled={saving}
            style={{ width: "100%", padding: "11px 16px", borderRadius: "8px", background: "var(--primary)", border: "1px solid var(--primary)", color: "#ffffff", fontWeight: 500, fontSize: "14px", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", margin: 0 }}
          >
            <Check size={16} strokeWidth={1.5} />
            <span>{saving ? "جاري الحفظ..." : "حفظ المقرر"}</span>
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={saving}
            style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", fontWeight: 500, fontSize: "13px", margin: 0 }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
