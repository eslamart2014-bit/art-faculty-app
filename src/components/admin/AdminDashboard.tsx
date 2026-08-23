"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Papa from "papaparse";

interface AdminDashboardProps {
  activeModal: "users" | "roster" | null;
  onClose: () => void;
}

export default function AdminDashboard({ activeModal, onClose }: AdminDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  
  const [parsedStudents, setParsedStudents] = useState<any[] | null>(null);

  useEffect(() => {
    if (activeModal === "users") {
      fetchUsers();
    }
    // reset on open
    setParsedStudents(null);
    setMsg("");
  }, [activeModal]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (!error && data) {
      setUsers(data);
    }
  };

  const parseGoogleSheet = async () => {
    if (!sheetUrl.trim()) {
      setMsg("الرجاء إدخال رابط Google Sheet أولاً.");
      return;
    }

    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      setMsg("الرابط غير صحيح، يرجى التأكد من نسخ رابط Google Sheet الصحيح.");
      return;
    }

    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    setLoading(true);
    setMsg("جاري فحص الشيت واستخراج البيانات...");

    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data as any[];
          const toInsert = data.map((row) => {
            const name = row["اسم الطالب"] || row["Name"] || row["الاسم"];
            const code = row["كود الطالب"] || row["Code"] || row["الكود"] || row["رقم الجلوس"];
            const level = row["الفرقة"] || row["Level"] || row["السنة"];
            const section = row["السكشن"] || row["Section"] || row["المجموعة"] || "عام";

            if (name && code && level) {
              return {
                student_code: String(code).trim(),
                full_name: String(name).trim(),
                academic_year: String(level).trim(),
                section: String(section).trim(),
              };
            }
            return null;
          }).filter(Boolean);

          if (toInsert.length === 0) {
            setMsg("لم يتم العثور على بيانات صالحة. تأكد من تطابق أسماء الأعمدة.");
            setLoading(false);
            return;
          }

          const uniqueStudentsMap = new Map();
          toInsert.forEach((student: any) => {
            uniqueStudentsMap.set(student.student_code, student);
          });
          const uniqueStudents = Array.from(uniqueStudentsMap.values());

          setParsedStudents(uniqueStudents);
          setMsg(`✅ تم العثور على ${uniqueStudents.length} طالب جاهز للتحديث.`);
        } catch (err: any) {
          setMsg("حدث خطأ أثناء فحص البيانات: " + err.message);
        }
        setLoading(false);
      },
      error: () => {
        setMsg("تعذر الوصول للشيت. تأكد أن إعدادات المشاركة هي Anyone with the link can view.");
        setLoading(false);
      }
    });
  };

  const handleUpdateOnly = async () => {
    if (!parsedStudents) return;
    setLoading(true);
    setMsg("جاري تحديث بيانات الطلاب (تحديث القديم وإضافة الجديد)...");

    const { error } = await supabase.from("students").upsert(
      parsedStudents, 
      { onConflict: "student_code" }
    );

    if (error) {
      setMsg("حدث خطأ أثناء الحفظ: " + error.message);
    } else {
      setMsg(`✅ تم تحديث بيانات ${parsedStudents.length} طالب بنجاح!`);
      setParsedStudents(null);
    }
    setLoading(false);
  };

  const handleRenewData = async () => {
    if (!parsedStudents) return;
    const confirmDelete = window.confirm("تحذير خطير: هذا الخيار سيقوم بحذف أي طالب موجود في النظام وغير موجود في هذا الشيت! سيؤدي هذا إلى حذف كل درجاتهم وغيابهم السابقة. هل أنت متأكد من رغبتك في إحلال وتجديد البيانات بالكامل؟");
    if (!confirmDelete) return;

    setLoading(true);
    setMsg("جاري إحلال وتجديد البيانات بالكامل...");

    // 1. Get all existing student codes
    const { data: existingStudents, error: fetchErr } = await supabase.from("students").select("student_code");
    
    if (fetchErr) {
      setMsg("خطأ في جلب الطلاب الحاليين: " + fetchErr.message);
      setLoading(false);
      return;
    }

    const newCodesSet = new Set(parsedStudents.map(s => s.student_code));
    const codesToDelete = existingStudents.filter(s => !newCodesSet.has(s.student_code)).map(s => s.student_code);

    // 2. Delete students not in the sheet
    if (codesToDelete.length > 0) {
      setMsg(`جاري حذف ${codesToDelete.length} طالب قديم...`);
      // Delete in batches of 1000 if necessary, but assuming small DB
      const { error: delErr } = await supabase.from("students").delete().in("student_code", codesToDelete);
      if (delErr) {
        console.error(delErr);
      }
    }

    // 3. Upsert the new data
    setMsg(`جاري إضافة/تحديث ${parsedStudents.length} طالب...`);
    const { error: upsertErr } = await supabase.from("students").upsert(
      parsedStudents, 
      { onConflict: "student_code" }
    );

    if (upsertErr) {
      setMsg("حدث خطأ أثناء التحديث: " + upsertErr.message);
    } else {
      setMsg(`✅ تمت عملية الإحلال والتجديد بنجاح! (حُذف ${codesToDelete.length} وحُدّث ${parsedStudents.length})`);
      setParsedStudents(null);
    }
    
    setLoading(false);
  };


  if (!activeModal) return null;

  return (
    <>
      {activeModal === "roster" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(2px)" }}>
          <div className="card" style={{ width: "90%", maxWidth: "420px", textAlign: "center", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <h3 style={{ color: "var(--success)", marginTop: 0 }}>📋 إدارة كشوف الطلاب المتقدمة</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "15px" }}>تحديث وإحلال قاعدة بيانات الطلاب عبر Google Sheets</p>

            <div style={{ overflowY: "auto", flexGrow: 1 }}>
              
              <div style={{ background: "#1e1e1e", border: "1px solid var(--primary)", padding: "15px", borderRadius: "10px", marginBottom: "15px", textAlign: "right" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--primary)", display: "block", marginBottom: "5px" }}>1. رابط شيت جوجل المفتوح:</label>
                <p style={{ fontSize: "11px", color: "#bbb", margin: "0 0 10px 0" }}>قم بنسخ رابط الشيت وضعه هنا (تأكد أن إعدادات المشاركة Anyone with link can view).</p>
                <input 
                  type="text" 
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..." 
                  style={{ marginBottom: "10px", fontSize: "12px", width: "100%", direction: "ltr", textAlign: "left" }} 
                  disabled={loading} 
                />
              </div>

              {!parsedStudents ? (
                <button 
                  onClick={parseGoogleSheet} 
                  disabled={loading}
                  style={{ background: "#2196F3", fontSize: "14px", fontWeight: "bold", margin: 0, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", padding: "12px" }}
                >
                  {loading ? <div className="loader-circle" style={{ width: "16px", height: "16px", borderWidth: "2px" }}></div> : "🔍"} 
                  {loading ? "جاري الفحص..." : "فحص البيانات أولاً"}
                </button>
              ) : (
                <div style={{ background: "#111", padding: "15px", borderRadius: "10px", border: "1px solid #4CAF50", marginBottom: "10px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "bold", color: "#4CAF50", marginBottom: "15px" }}>
                    تم التعرف على {parsedStudents.length} طالب في الشيت
                  </div>
                  
                  <button 
                    onClick={handleUpdateOnly} 
                    disabled={loading}
                    style={{ background: "#4CAF50", fontSize: "14px", fontWeight: "bold", marginBottom: "10px", width: "100%", padding: "12px" }}
                  >
                    🔄 تحديث البيانات فقط (آمن)
                  </button>
                  <p style={{ fontSize: "10px", color: "#888", marginBottom: "15px", textAlign: "right" }}>* سيتم تحديث بيانات الطلاب الحاليين وإضافة الطلاب الجدد، ولن يتم حذف أي طالب قديم من النظام.</p>

                  <button 
                    onClick={handleRenewData} 
                    disabled={loading}
                    style={{ background: "#F44336", fontSize: "14px", fontWeight: "bold", margin: 0, width: "100%", padding: "12px" }}
                  >
                    ⚠️ إحلال وتجديد كلي (خطر)
                  </button>
                  <p style={{ fontSize: "10px", color: "#888", marginTop: "5px", textAlign: "right" }}>* سيتم مسح أي طالب موجود في النظام وغير موجود في الشيت تماماً (بكل درجاته وحضوره)، واعتماد الشيت الجديد كلياً.</p>

                  <button onClick={() => setParsedStudents(null)} style={{ background: "transparent", color: "#888", border: "none", fontSize: "12px", marginTop: "15px", textDecoration: "underline" }}>
                    إلغاء الفحص
                  </button>
                </div>
              )}

              {msg && (
                <div style={{ marginTop: "15px", fontSize: "13px", color: msg.includes("✅") ? "var(--success)" : "var(--warning)", textAlign: "center", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px" }}>
                  {msg}
                </div>
              )}
            </div>

            <button className="secondary" onClick={onClose} style={{ width: "100%", marginTop: "15px" }}>إغلاق</button>
          </div>
        </div>
      )}
    </>
  );
}
