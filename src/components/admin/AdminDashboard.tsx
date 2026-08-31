"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Papa from "papaparse";
import { generatePrintableHtml } from "@/lib/pdfHelper";
import { downloadPdf } from "@/lib/downloadPdf";

interface AdminDashboardProps {
  activeModal: "users" | "roster" | null;
  onClose: () => void;
}

export default function AdminDashboard({ activeModal, onClose }: AdminDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"sync" | "export">("sync");
  
  // Sync state
  const [sheetUrl, setSheetUrl] = useState("");
  const [previewData, setPreviewData] = useState<{
    updateList: any[],
    insertList: any[],
    archiveList: any[]
  } | null>(null);

  // Export state
  const [exportYear, setExportYear] = useState("");
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  useEffect(() => {
    if (activeTab === "export") {
      fetchUniqueYears();
    }
  }, [activeTab]);

  const fetchUniqueYears = async () => {
    const { data } = await supabase.from("students").select("academic_year").eq("is_active", true);
    if (data) {
      const years = Array.from(new Set(data.map(d => d.academic_year)));
      setAvailableYears(years.filter(Boolean));
    }
  };

  const normalizeName = (name: string) => {
    if (!name) return "";
    return name
      .replace(/أ|إ|آ/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .trim();
  };

  const parseGoogleSheet = async () => {
    if (!sheetUrl.includes("docs.google.com/spreadsheets")) {
      setMsg("الرابط غير صحيح. تأكد أنه رابط Google Sheets.");
      return;
    }

    setLoading(true);
    setMsg("جاري تحميل الشيت ومعالجة البيانات...");

    try {
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) throw new Error("لا يمكن استخراج معرف الشيت.");
      const sheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error("فشل تحميل الشيت. تأكد أنه 'Anyone with link can view'.");
      
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as any[];
          await analyzeData(data);
        },
        error: (err: any) => {
          setMsg("خطأ في قراءة الملف: " + err.message);
          setLoading(false);
        }
      });
    } catch (err: any) {
      setMsg("خطأ: " + err.message);
      setLoading(false);
    }
  };

  const analyzeData = async (sheetData: any[]) => {
    try {
      // 1. Fetch active students
      const { data: activeStudents, error } = await supabase.from("students").select("*").eq("is_active", true);
      if (error) throw error;

      // 2. Build DB Map for matching
      const dbMap = new Map();
      (activeStudents || []).forEach(s => dbMap.set(normalizeName(s.full_name), s));

      // 3. Diffing logic
      const updateList: any[] = [];
      const insertList: any[] = [];
      const sheetActiveKeys = new Set();

      sheetData.forEach(row => {
        const rawName = row["اسم الطالب"] || row["Name"] || row["الاسم"];
        if (!rawName) return; // Skip empty names
        
        const normName = normalizeName(rawName);
        const year = row["الفرقة"] || row["Level"] || row["السنة"] || "الأولى";
        const section = row["السكشن"] || row["Section"] || row["المجموعة"] || "عام";

        const existing = dbMap.get(normName);
        if (existing) {
          updateList.push({ ...existing, academic_year: year, section: section });
          sheetActiveKeys.add(normName);
        } else {
          insertList.push({ full_name: rawName, academic_year: year, section: section, is_active: true });
        }
      });

      const archiveList = (activeStudents || []).filter(s => !sheetActiveKeys.has(normalizeName(s.full_name)));

      setPreviewData({ updateList, insertList, archiveList });
      setMsg("");
    } catch (err: any) {
      setMsg("خطأ في تحليل البيانات: " + err.message);
    }
    setLoading(false);
  };

  const executeSync = async () => {
    if (!previewData) return;
    setLoading(true);
    setMsg("جاري تنفيذ العمليات، يرجى عدم إغلاق الشاشة...");

    try {
      // 1. Process Archive
      if (previewData.archiveList.length > 0) {
        const archiveIds = previewData.archiveList.map(s => s.id);
        const { error: archiveErr } = await supabase.from("students").update({ is_active: false }).in("id", archiveIds);
        if (archiveErr) throw new Error("خطأ أثناء الأرشفة: " + archiveErr.message);
      }

      // 2. Process Updates
      if (previewData.updateList.length > 0) {
        const { error: updateErr } = await supabase.from("students").upsert(
          previewData.updateList.map(s => ({
            id: s.id,
            student_code: s.student_code,
            full_name: s.full_name,
            academic_year: s.academic_year,
            section: s.section,
            is_active: s.is_active,
            created_at: s.created_at
          })), 
          { onConflict: "id" }
        );
        if (updateErr) throw new Error("خطأ أثناء التحديث: " + updateErr.message);
      }

      // 3. Process Inserts (Generate Codes)
      if (previewData.insertList.length > 0) {
        // Fetch all student codes to find max
        const { data: allCodes } = await supabase.from("students").select("student_code");
        let maxCode = 0;
        (allCodes || []).forEach(s => {
          if (s.student_code) {
            const num = parseInt(s.student_code, 10);
            if (!isNaN(num) && num > maxCode) maxCode = num;
          }
        });

        const finalInsertData = previewData.insertList.map(s => {
          maxCode++;
          s.student_code = maxCode.toString().padStart(4, "0");
          return s;
        });

        // Insert in batches of 1000 if necessary, but assume <1000 inserts per year
        const { error: insertErr } = await supabase.from("students").insert(finalInsertData);
        if (insertErr) throw new Error("خطأ أثناء الإضافة: " + insertErr.message);
      }

      setMsg(`تمت المزامنة بنجاح! تم إضافة ${previewData.insertList.length} وتحديث ${previewData.updateList.length} وأرشفة ${previewData.archiveList.length} طالب.`);
      setPreviewData(null);
      setSheetUrl("");
    } catch (err: any) {
      setMsg(err.message);
    }
    setLoading(false);
  };

  const handleExportPDF = async () => {
    if (!exportYear) {
      alert("الرجاء اختيار الفرقة أولاً");
      return;
    }
    setLoading(true);
    const { data: students } = await supabase.from("students").select("*").eq("is_active", true).eq("academic_year", exportYear);
    if (!students || students.length === 0) {
      alert("لا يوجد طلاب نشطين في هذه الفرقة.");
      setLoading(false);
      return;
    }

    // Group by section
    const grouped: any = {};
    students.forEach(s => {
      if (!grouped[s.section]) grouped[s.section] = [];
      grouped[s.section].push(s);
    });

    // Sort sections numerically
    const sortedSections = Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));

    let tableHtml = "";
    sortedSections.forEach((section, index) => {
      const sectionStudents = grouped[section].sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
      tableHtml += `
        <div style="${index > 0 ? 'page-break-before: always;' : ''}">
          <h3 style="text-align: right; margin-top: 20px;">السكشن: ${section} (العدد: ${sectionStudents.length})</h3>
          <table>
            <thead>
              <tr>
                <th>م</th>
                <th>اسم الطالب</th>
                <th>الكود</th>
              </tr>
            </thead>
            <tbody>
              ${sectionStudents.map((s: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${s.full_name}</td>
                  <td style="font-weight: bold; letter-spacing: 2px;">${s.student_code}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    });

    await downloadPdf(`student_codes_${exportYear}.pdf`, "", "كشف أكواد الطلاب", `الفرقة: ${exportYear}`, tableHtml, "الإدارة");

    setLoading(false);
  };

  const handleExportExcel = async () => {
    if (!exportYear) {
      alert("الرجاء اختيار الفرقة أولاً");
      return;
    }
    setLoading(true);
    const { data: students } = await supabase.from("students").select("*").eq("is_active", true).eq("academic_year", exportYear);
    if (!students || students.length === 0) {
      alert("لا يوجد طلاب.");
      setLoading(false);
      return;
    }

    let csvContent = "\uFEFFالاسم,الكود,السكشن\n"; // \uFEFF for Arabic Excel support
    students.forEach(s => {
      csvContent += `${s.full_name},="${s.student_code}",${s.section}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `أكواد_الفرقة_${exportYear.replace(/\s+/g, '_')}.csv`;
    link.click();
    setLoading(false);
  };

  if (!activeModal) return null;

  return (
    <>
      {activeModal === "roster" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(2px)" }}>
          <div className="card" style={{ width: "90%", maxWidth: "500px", display: "flex", flexDirection: "column", maxHeight: "90vh", padding: 0, overflow: "hidden" }}>
            
            {/* Header Tabs */}
            <div style={{ display: "flex", background: "#1e1e1e", borderBottom: "1px solid #333" }}>
              <button onClick={() => setActiveTab("sync")} style={{ flex: 1, padding: "15px", background: activeTab === "sync" ? "#333" : "transparent", color: activeTab === "sync" ? "#fff" : "#888", border: "none", borderBottom: activeTab === "sync" ? "2px solid #2196F3" : "none", fontWeight: "bold", cursor: "pointer" }}>مزامنة ذكية 🤖</button>
              <button onClick={() => setActiveTab("export")} style={{ flex: 1, padding: "15px", background: activeTab === "export" ? "#333" : "transparent", color: activeTab === "export" ? "#fff" : "#888", border: "none", borderBottom: activeTab === "export" ? "2px solid #2196F3" : "none", fontWeight: "bold", cursor: "pointer" }}>تصدير الكشوف 📥</button>
            </div>

            <div style={{ overflowY: "auto", padding: "20px", flexGrow: 1 }}>
              
              {activeTab === "sync" && (
                <>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px", textAlign: "center", lineHeight: "1.6" }}>
                    قم برفع الشيت (الاسم، الفرقة، السكشن) <b>بدون أكواد</b>.<br/>سيقوم النظام آلياً بالاحتفاظ بأكواد الطلاب المستمرين وتوليد أكواد للمستجدين وأرشفة الخريجين.
                  </p>

                  <div style={{ background: "#1e1e1e", border: "1px solid var(--primary)", padding: "15px", borderRadius: "10px", marginBottom: "15px", textAlign: "right" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--primary)", display: "block", marginBottom: "5px" }}>رابط شيت جوجل (Anyone with link can view):</label>
                    <input 
                      type="text" 
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..." 
                      style={{ marginBottom: "10px", fontSize: "12px", width: "100%", direction: "ltr", textAlign: "left", padding: "10px", borderRadius: "5px", border: "1px solid #444", background: "#111", color: "#fff" }} 
                      disabled={loading || !!previewData} 
                    />
                  </div>

                  {!previewData ? (
                    <button onClick={parseGoogleSheet} disabled={loading || !sheetUrl} style={{ background: "#2196F3", fontSize: "14px", fontWeight: "bold", width: "100%", padding: "12px", borderRadius: "5px", border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}>
                      {loading ? "جاري المعالجة..." : "تحليل الشيت والمطابقة 🔍"}
                    </button>
                  ) : (
                    <div style={{ background: "#111", padding: "15px", borderRadius: "10px", border: "1px solid #4CAF50", marginBottom: "10px" }}>
                      <h4 style={{ color: "#4CAF50", margin: "0 0 15px 0", textAlign: "center" }}>نتيجة المطابقة الذكية</h4>
                      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px 0", fontSize: "14px", lineHeight: "2" }}>
                        <li style={{ display: "flex", justifyContent: "space-between" }}><span>🟢 طلاب مستجدين (أكواد جديدة):</span> <b>{previewData.insertList.length}</b></li>
                        <li style={{ display: "flex", justifyContent: "space-between" }}><span>🔵 طلاب مستمرين (تحديث فرقة):</span> <b>{previewData.updateList.length}</b></li>
                        <li style={{ display: "flex", justifyContent: "space-between", color: "#f44336" }}><span>🔴 خريجين/منقولين (للأرشيف):</span> <b>{previewData.archiveList.length}</b></li>
                      </ul>
                      
                      <button onClick={executeSync} disabled={loading} style={{ background: "#4CAF50", fontSize: "14px", fontWeight: "bold", width: "100%", padding: "12px", borderRadius: "5px", border: "none", color: "#fff", marginBottom: "10px", cursor: loading ? "not-allowed" : "pointer" }}>
                        {loading ? "جاري الحفظ..." : "تأكيد وتنفيذ المزامنة ✅"}
                      </button>
                      <button onClick={() => setPreviewData(null)} disabled={loading} style={{ background: "transparent", color: "#f44336", border: "1px solid #f44336", width: "100%", padding: "10px", borderRadius: "5px", cursor: "pointer" }}>
                        إلغاء
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === "export" && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px", lineHeight: "1.6" }}>
                    بعد إتمام المزامنة، يمكنك تحميل كشوف الطلاب متضمنة الأكواد التي تم توليدها أو الاحتفاظ بها آلياً.
                  </p>
                  <label style={{ display: "block", color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>اختر الفرقة المراد تصديرها:</label>
                  <select 
                    value={exportYear} 
                    onChange={e => setExportYear(e.target.value)}
                    style={{ width: "100%", padding: "10px", background: "#111", border: "1px solid #555", color: "#fff", borderRadius: "5px", marginBottom: "20px" }}
                  >
                    <option value="">-- اختر الفرقة --</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={handleExportPDF} disabled={loading} style={{ flex: 1, background: "#F44336", color: "#fff", border: "none", padding: "12px", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>
                      تحميل PDF 📄
                    </button>
                    <button onClick={handleExportExcel} disabled={loading} style={{ flex: 1, background: "#4CAF50", color: "#fff", border: "none", padding: "12px", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>
                      تحميل Excel 📊
                    </button>
                  </div>
                </div>
              )}

              {msg && (
                <div style={{ marginTop: "15px", fontSize: "13px", color: msg.includes("بنجاح") ? "var(--success)" : "var(--warning)", textAlign: "center", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px" }}>
                  {msg}
                </div>
              )}
            </div>

            <div style={{ padding: "15px", background: "#1e1e1e", borderTop: "1px solid #333" }}>
              <button className="secondary" onClick={onClose} style={{ width: "100%", margin: 0 }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
