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

  useEffect(() => {
    if (activeModal === "users") {
      fetchUsers();
    }
  }, [activeModal]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (!error && data) {
      setUsers(data);
    }
  };

  const handleGoogleSheetSync = async () => {
    if (!sheetUrl.trim()) {
      setMsg("الرجاء إدخال رابط Google Sheet أولاً.");
      return;
    }

    // Extract Sheet ID
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      setMsg("الرابط غير صحيح، يرجى التأكد من نسخ رابط Google Sheet الصحيح.");
      return;
    }

    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    setLoading(true);
    setMsg("جاري الاتصال بسيرفرات جوجل وسحب البيانات...");

    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          
          const studentsToInsert = data.map((row) => {
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

          if (studentsToInsert.length === 0) {
            setMsg("لم يتم العثور على بيانات صالحة. تأكد من تطابق أسماء الأعمدة (اسم الطالب، كود الطالب، الفرقة).");
            setLoading(false);
            return;
          }

          // Deduplicate by student_code to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
          const uniqueStudentsMap = new Map();
          studentsToInsert.forEach((student: any) => {
            uniqueStudentsMap.set(student.student_code, student);
          });
          const uniqueStudents = Array.from(uniqueStudentsMap.values());

          setMsg(`تم سحب ${uniqueStudents.length} طالب، جاري الحفظ في النظام...`);

          const { error } = await supabase.from("students").upsert(
            uniqueStudents, 
            { onConflict: "student_code" }
          );

          if (error) {
            setMsg("حدث خطأ أثناء الحفظ: " + error.message);
          } else {
            setMsg(`✅ تم تحديث بيانات ${uniqueStudents.length} طالب بنجاح وتمت المزامنة!`);
          }
        } catch (err: any) {
          setMsg("حدث خطأ أثناء معالجة البيانات: " + err.message);
        }
        setLoading(false);
      },
      error: (error) => {
        setMsg("حدث خطأ في الاتصال بجوجل: تأكد أن الشيت متاح للجميع (Anyone with the link can view).");
        setLoading(false);
      }
    });
  };

  if (!activeModal) return null;

  return (
    <>

      {activeModal === "roster" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(2px)" }}>
          <div className="card" style={{ width: "90%", maxWidth: "420px", textAlign: "center", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
            <h3 style={{ color: "var(--success)", marginTop: 0 }}>📋 إدارة كشوف الطلاب</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "15px" }}>تحديث قاعدة بيانات الطلاب لحظياً عبر Google Sheets</p>

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

              <button 
                onClick={handleGoogleSheetSync} 
                disabled={loading}
                style={{ background: "var(--success)", fontSize: "14px", fontWeight: "bold", margin: 0, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", padding: "12px" }}
              >
                {loading ? <div className="loader-circle" style={{ width: "16px", height: "16px", borderWidth: "2px" }}></div> : "🔄"} 
                {loading ? "جاري المزامنة..." : "سحب وتحديث البيانات الآن"}
              </button>

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
