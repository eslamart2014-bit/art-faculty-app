"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";

const LEVELS = ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة", "الكل"];

export default function StudentPortal() {
  const [level, setLevel] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const browserIdRef = useRef<string>("");

  useEffect(() => {
    // Generate or get browser_id
    if (typeof window !== 'undefined') {
      let bId = localStorage.getItem('portal_browser_id');
      if (!bId) {
        bId = 'br_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('portal_browser_id', bId);
      }
      browserIdRef.current = bId;
    }
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchStudents();
      } else {
        setStudents([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, level]);

  const trackEvent = (eventType: 'search' | 'qr_view', academicYear: string, studentName?: string) => {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event_type: eventType, 
        academic_year: academicYear,
        browser_id: browserIdRef.current,
        student_name: studentName
      })
    }).catch(console.error);
  };

  const searchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(searchQuery)}&level=${encodeURIComponent(level)}`);
      const data = await res.json();
      if (data.students) {
        setStudents(data.students);
        if (data.students.length > 0) {
          trackEvent('search', level); // track search with the selected level filter
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (selectedStudent) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", direction: "rtl", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: "20px", width: "100%", maxWidth: "380px", padding: "30px 20px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)", position: "relative", textAlign: "center" }}>
          
          <button 
            onClick={() => setSelectedStudent(null)}
            style={{ position: "absolute", top: "15px", right: "15px", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: "35px", height: "35px", borderRadius: "50%", cursor: "pointer", fontSize: "18px" }}
          >
            ✕
          </button>

          <h2 style={{ color: "#2196F3", marginTop: "10px", marginBottom: "30px", fontSize: "22px", fontFamily: "monospace" }}>QR Code</h2>

          <div style={{ background: "#fff", padding: "15px", borderRadius: "15px", display: "inline-block", marginBottom: "20px" }}>
            <QRCode 
              value={`اسم الطالب: ${selectedStudent.full_name}\nكود الطالب: ${selectedStudent.student_code}\nالفرقة: ${selectedStudent.academic_year}\nالسكشن: ${selectedStudent.section || 'عام'}`} 
              size={200} 
            />
          </div>

          <h3 style={{ color: "#fff", margin: "10px 0 5px 0", fontSize: "20px" }}>{selectedStudent.full_name}</h3>
          
          <div style={{ display: "inline-block", background: "#222", color: "#4CAF50", padding: "5px 15px", borderRadius: "20px", fontSize: "14px", fontWeight: "bold", marginBottom: "10px" }}>
            {selectedStudent.academic_year}
          </div>
          
          <div style={{ color: "#aaa", fontSize: "14px", marginBottom: "30px" }}>
            الكود: <span style={{ color: "#fff", fontWeight: "bold", fontFamily: "monospace", fontSize: "16px" }}>{selectedStudent.student_code}</span>
          </div>

          <div style={{ background: "rgba(255, 152, 0, 0.1)", border: "1px dashed #FF9800", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
            <p style={{ margin: 0, color: "#FF9800", fontSize: "13px", lineHeight: "1.6" }}>
              📸 <b>يرجى التقاط لقطة شاشة (Screenshot)</b> لهذه البطاقة والاحتفاظ بها. ستحتاجها يومياً لتسجيل حضورك وتقييماتك في المحاضرات.
            </p>
          </div>

          <div style={{ borderTop: "1px solid #333", paddingTop: "15px", marginTop: "20px" }}>
            <div style={{ color: "#666", fontSize: "11px" }}>نظام التربية الفنية الجديد</div>
            <div style={{ color: "#555", fontSize: "10px", marginTop: "3px" }}>مطور النظام: د/ إسلام عبد اللطيف حسن</div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", direction: "rtl", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ background: "#111", border: "1px solid #333", borderRadius: "20px", width: "100%", maxWidth: "400px", padding: "30px 20px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)", textAlign: "center" }}>
        
        <div style={{ fontSize: "50px", marginBottom: "10px" }}>🎓</div>
        <h1 style={{ color: "#fff", margin: "0 0 10px 0", fontSize: "24px" }}>بوابة الطلاب</h1>
        <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "30px" }}>يرجى البحث عن اسمك للحصول على بطاقة الـ QR الخاصة بك</p>

        <div style={{ textAlign: "right", marginBottom: "15px" }}>
          <label style={{ display: "block", color: "#888", marginBottom: "8px", fontSize: "13px" }}>الفرقة الدراسية:</label>
          <select 
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            style={{ width: "100%", padding: "14px", background: "#222", border: "1px solid #444", color: "#fff", borderRadius: "10px", fontSize: "15px", outline: "none", appearance: "none" }}
          >
            {LEVELS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div style={{ textAlign: "right", marginBottom: "20px", position: "relative" }}>
          <label style={{ display: "block", color: "#888", marginBottom: "8px", fontSize: "13px" }}>بحث بالاسم:</label>
          <input 
            type="text" 
            placeholder="اكتب حروف من اسمك..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "14px", background: "#222", border: "1px solid #444", color: "#fff", borderRadius: "10px", fontSize: "15px", outline: "none" }}
          />
          {loading && (
            <div style={{ position: "absolute", left: "15px", top: "42px", color: "#2196F3", fontSize: "12px" }}>جاري البحث...</div>
          )}
        </div>

        {students.length > 0 && (
          <div style={{ background: "#222", borderRadius: "10px", border: "1px solid #444", maxHeight: "250px", overflowY: "auto", textAlign: "right" }}>
            {students.map(student => (
              <div 
                key={student.id}
                onClick={() => {
                  setSelectedStudent(student);
                  trackEvent('qr_view', student.academic_year, student.full_name);
                }}
                style={{ padding: "15px", borderBottom: "1px solid #333", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>{student.full_name}</div>
                  <div style={{ color: "#888", fontSize: "11px" }}>{student.academic_year} - {student.section}</div>
                </div>
                <div style={{ color: "#2196F3", fontSize: "18px" }}>←</div>
              </div>
            ))}
          </div>
        )}

        {searchQuery.length >= 2 && students.length === 0 && !loading && (
          <div style={{ padding: "20px", color: "#f44336", background: "rgba(244, 67, 54, 0.1)", borderRadius: "10px", fontSize: "14px" }}>
            لم يتم العثور على أي طالب بهذا الاسم!
          </div>
        )}

      </div>
    </div>
  );
}
