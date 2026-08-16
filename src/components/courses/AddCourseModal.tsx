"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onCourseAdded: () => void;
}

export default function AddCourseModal({ isOpen, onClose, user, onCourseAdded }: AddCourseModalProps) {
  const [courseName, setCourseName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [courseType, setCourseType] = useState<"sections" | "lectures">("sections");
  
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  
  const [loadingSections, setLoadingSections] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setCourseName("");
      setAcademicYear("");
      setCourseType("sections");
      setAvailableSections([]);
      setSelectedSections([]);
    }
  }, [isOpen]);

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
    // Fetch unique sections from students table for the selected year
    const { data, error } = await supabase
      .from("students")
      .select("section")
      .eq("academic_year", year);

    if (data && !error) {
      const unique = Array.from(new Set(data.map((d: any) => String(d.section).trim()))).filter(Boolean) as string[];
      unique.sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b, 'ar');
      });
      setAvailableSections(unique);
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
    const { error } = await supabase.from("courses").insert({
      name: courseName.trim(),
      academic_year: academicYear,
      course_type: courseType,
      sections: courseType === "sections" ? selectedSections : [],
      teacher_id: user.id
    });

    setSaving(false);
    if (error) {
      alert("حدث خطأ أثناء حفظ المقرر: " + error.message);
    } else {
      alert("تم حفظ المقرر بنجاح!");
      onCourseAdded();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(2px)" }}>
      <div className="card" style={{ width: "90%", maxWidth: "380px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <h3 style={{ marginTop: 0, textAlign: "center", color: "var(--primary)" }}>إضافة مقرر جديد</h3>
        
        <div style={{ flexGrow: 1, overflowY: "auto", paddingRight: "5px" }}>
          <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "4px", display: "block", textAlign: "right" }}>1. اسم المقرر:</label>
          <input 
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="مثال: الرسم والتصوير 1" 
            style={{ marginBottom: "12px" }}
          />
          
          <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "4px", display: "block", textAlign: "right" }}>2. الفرقة الدراسية:</label>
          <select 
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            style={{ marginBottom: "12px" }}
          >
            <option value="">-- اختر الفرقة --</option>
            <option value="الأولى">الفرقة الأولى</option>
            <option value="الثانية">الفرقة الثانية</option>
            <option value="الثالثة">الفرقة الثالثة</option>
            <option value="الرابعة">الفرقة الرابعة</option>
          </select>

          <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--warning)", marginBottom: "4px", display: "block", textAlign: "right" }}>3. طبيعة المقرر:</label>
          <select 
            value={courseType}
            onChange={(e) => setCourseType(e.target.value as "sections" | "lectures")}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--surface)", color: "#fff", border: "1px solid var(--border-light)", fontSize: "13px", marginBottom: "12px" }}
          >
            <option value="sections">سكاشن (تحديد السكاشن الخاصة بك)</option>
            <option value="lectures">محاضرات (كامل طلاب الفرقة أوتوماتيكياً)</option>
          </select>
          
          {courseType === "sections" && (
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "4px", display: "block", textAlign: "right" }}>4. السكاشن المتاحة:</label>
              
              {!academicYear ? (
                <div style={{ textAlign: "center", color: "#999", padding: "15px", border: "1px dashed #444", borderRadius: "8px" }}>اختر الفرقة أولاً</div>
              ) : loadingSections ? (
                <div style={{ textAlign: "center", color: "#999", padding: "15px", border: "1px dashed #444", borderRadius: "8px" }}>جاري تحميل السكاشن...</div>
              ) : availableSections.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--danger)", padding: "15px", border: "1px dashed #444", borderRadius: "8px" }}>لم يتم العثور على أي سكاشن في قاعدة بيانات هذه الفرقة. تأكد من رفع كشوف الطلاب أولاً.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px", maxHeight: "150px", overflowY: "auto" }}>
                  {availableSections.map(sec => {
                    const isActive = selectedSections.includes(sec);
                    return (
                      <div 
                        key={sec}
                        onClick={() => toggleSection(sec)}
                        style={{ 
                          padding: "10px 15px", 
                          borderRadius: "20px", 
                          border: `1px solid var(--primary)`, 
                          background: isActive ? "var(--primary)" : "var(--surface-hover)", 
                          textAlign: "center", 
                          fontSize: "14px", 
                          color: isActive ? "#fff" : "var(--primary)", 
                          cursor: "pointer", 
                          userSelect: "none", 
                          transition: "all 0.2s", 
                          flexGrow: 1, 
                          maxWidth: "80px",
                          boxShadow: isActive ? "0 2px 5px rgba(33, 150, 243, 0.3)" : "none"
                        }}
                      >
                        {sec}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div style={{ marginTop: "15px" }}>
          <button onClick={saveCourse} disabled={saving} style={{ marginBottom: "8px", background: "var(--primary)", fontWeight: "bold" }}>
            {saving ? "جاري الحفظ..." : "حفظ المقرر"}
          </button>
          <button className="secondary" onClick={onClose} disabled={saving}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
