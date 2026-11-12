"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/core/supabase";
import Papa from "papaparse";
import { generatePrintableHtml } from "@/lib/courses/pdfHelper";
import { downloadPdf } from "@/lib/courses/downloadPdf";
import { normalizeAcademicYear } from "@/lib/students/codeHelper";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Link2,
  Lock,
  RefreshCw,
  Search,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";

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

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (activeTab === "export") {
      fetchUniqueYears();
    }
  }, [activeTab]);

  const fetchUniqueYears = async () => {
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
      const set = new Set(all.map(d => d.academic_year).filter(Boolean));
      const preferred = ["الرابعة", "الثالثة", "الثانية", "الاولي"];
      const sorted = Array.from(set).sort((a, b) => {
        const ia = preferred.indexOf(a);
        const ib = preferred.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });
      setAvailableYears(sorted);
    }
  };

  const normalizeName = (name: string) => {
    if (!name) return "";
    return name
      .replace(/[\u064B-\u065F\u0640\uFEFF]/g, "") // Diacritics, Tatweel, BOM
      .replace(/[أإآء]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Helper to fetch all students with pagination (bypasses Supabase 1000 row default limit)
  const fetchAllStudentsPaginated = async (activeOnly: boolean = false) => {
    let all: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      let query = supabase.from("students").select("*");
      if (activeOnly) {
        query = query.eq("is_active", true);
      }
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMsg("جاري قراءة ملف CSV وتجهيز المطابقة...");
    Papa.parse(file, {
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

      // Preserve specific sheet tab (gid) if provided
      const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
      const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : "";
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;

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
      setMsg("جاري جلب كافة بيانات الطلاب النشطين من النظام (جميع الدفعات)...");
      // 1. Fetch ALL active students from DB with pagination
      const activeStudents = await fetchAllStudentsPaginated(true);

      setMsg("جاري فحص الطلاب وترفيع الفرق وتحديد الخريجين...");

      // 2. Build Candidate Maps for DB students
      const dbCodeMap = new Map<string, any>();
      const dbNameCandidates = new Map<string, any[]>();

      activeStudents.forEach(s => {
        if (s.student_code) {
          dbCodeMap.set(String(s.student_code).trim(), s);
        }
        const norm = normalizeName(s.full_name);
        if (norm) {
          if (!dbNameCandidates.has(norm)) {
            dbNameCandidates.set(norm, []);
          }
          dbNameCandidates.get(norm)!.push(s);
        }
      });

      // Flexible row value finder (handles BOM, synonyms, and spaces)
      const getRowVal = (row: any, keys: string[]) => {
        for (const k of Object.keys(row)) {
          const cleanKey = k.replace(/^\uFEFF/, "").trim();
          if (keys.includes(cleanKey)) {
            const val = row[k];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              return String(val).trim();
            }
          }
        }
        return "";
      };

      const updateListMap = new Map<string, any>(); // key = s.id
      const insertListMap = new Map<string, any>(); // key = normName
      const matchedDbStudentIds = new Set<string>();

      sheetData.forEach(row => {
        const rawName = getRowVal(row, ["اسم الطالب", "الاسم", "Name", "اسم_الطالب", "اسم الطالب بالكامل", "الاسم بالكامل"]);
        if (!rawName) return; // Skip empty names
        
        const normName = normalizeName(rawName);
        if (!normName) return;

        const rawYear = getRowVal(row, ["الفرقة", "Level", "السنة", "الفرقة الدراسية", "الفرقه", "السنه"]) || "الاولي";
        const year = normalizeAcademicYear(rawYear);
        const section = getRowVal(row, ["السكشن", "Section", "المجموعة", "المجموعه", "سكشن"]) || "عام";

        // Check if row has student code
        const rawCode = getRowVal(row, ["كود الطالب", "الكود", "Code", "student_code", "كود"]);
        const cleanCode = rawCode.replace(/[="']/g, '').trim();

        // 1) Match by Code first (if present)
        let existing: any = null;
        if (cleanCode && dbCodeMap.has(cleanCode)) {
          const cand = dbCodeMap.get(cleanCode);
          if (!matchedDbStudentIds.has(cand.id)) {
            existing = cand;
          }
        }

        // 2) Match by Normalized Name
        if (!existing && dbNameCandidates.has(normName)) {
          const candidates = dbNameCandidates.get(normName) || [];
          const available = candidates.filter(c => !matchedDbStudentIds.has(c.id));

          if (available.length === 1) {
            existing = available[0];
          } else if (available.length > 1) {
            // Smart promotion matching:
            // If incoming row is in 'الرابعة', prefer student previously in 'الثالثة'
            // If incoming row is in 'الثالثة', prefer student previously in 'الثانية'
            // If incoming row is in 'الثانية', prefer student previously in 'الاولي'
            const expectedPrevYear =
              year === "الرابعة" ? "الثالثة" :
              year === "الثالثة" ? "الثانية" :
              year === "الثانية" ? "الاولي" : "";

            existing = available.find(c => normalizeAcademicYear(c.academic_year) === expectedPrevYear) || available[0];
          }
        }

        if (existing) {
          // Continuing student: 100% PRESERVE ID AND PREVIOUS STUDENT CODE!
          matchedDbStudentIds.add(existing.id);
          updateListMap.set(existing.id, {
            ...existing,
            student_code: existing.student_code, // Unconditionally preserved!
            academic_year: year,
            section: section,
            is_active: true
          });
        } else {
          // New student
          if (!insertListMap.has(normName)) {
            insertListMap.set(normName, {
              full_name: rawName,
              academic_year: year,
              section: section,
              is_active: true
            });
          }
        }
      });

      const updateList = Array.from(updateListMap.values());
      const insertList = Array.from(insertListMap.values());
      // Archive = Any student active in DB who does NOT appear in the incoming promoted sheet.
      // (This automatically and accurately identifies the graduating 4th year batch!)
      const archiveList = activeStudents.filter(s => !matchedDbStudentIds.has(s.id));

      setPreviewData({ updateList, insertList, archiveList });
      setShowDetails(false);
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
      // 1. Process Archive in chunks of 200 (Sets graduating students to is_active: false)
      if (previewData.archiveList.length > 0) {
        const archiveIds = previewData.archiveList.map(s => s.id);
        for (let i = 0; i < archiveIds.length; i += 200) {
          const chunk = archiveIds.slice(i, i + 200);
          const { error: archiveErr } = await supabase
            .from("students")
            .update({ is_active: false })
            .in("id", chunk);
          if (archiveErr) throw new Error("خطأ أثناء أرشفة الخريجين: " + archiveErr.message);
        }
      }

      // 2. Process Updates in chunks of 200 (guaranteed 100% unique IDs, preserving student_code)
      if (previewData.updateList.length > 0) {
        const payload = previewData.updateList.map(s => ({
          id: s.id,
          student_code: s.student_code, // 100% Guaranteed preserved
          full_name: s.full_name,
          academic_year: s.academic_year,
          section: s.section,
          is_active: true,
          created_at: s.created_at
        }));

        for (let i = 0; i < payload.length; i += 200) {
          const chunk = payload.slice(i, i + 200);
          const { error: updateErr } = await supabase
            .from("students")
            .upsert(chunk, { onConflict: "id" });
          if (updateErr) throw new Error("خطأ أثناء تحديث بيانات الطلاب: " + updateErr.message);
        }
      }

      // 3. Process Inserts (Generate Codes) in chunks of 200
      if (previewData.insertList.length > 0) {
        // Fetch all student codes with pagination to find true max
        let maxCode = 0;
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data: codeChunk, error: codeErr } = await supabase
            .from("students")
            .select("student_code")
            .range(from, from + pageSize - 1);
          if (codeErr) throw codeErr;
          if (!codeChunk || codeChunk.length === 0) break;
          codeChunk.forEach(s => {
            if (s.student_code) {
              const num = parseInt(String(s.student_code).replace(/\D/g, ""), 10);
              if (!isNaN(num) && num > maxCode) maxCode = num;
            }
          });
          if (codeChunk.length < pageSize) break;
          from += pageSize;
        }

        const finalInsertData = previewData.insertList.map(s => {
          maxCode++;
          return {
            ...s,
            student_code: maxCode.toString().padStart(4, "0")
          };
        });

        for (let i = 0; i < finalInsertData.length; i += 200) {
          const chunk = finalInsertData.slice(i, i + 200);
          const { error: insertErr } = await supabase
            .from("students")
            .insert(chunk);
          if (insertErr) throw new Error("خطأ أثناء إضافة الطلاب الجدد: " + insertErr.message);
        }
      }

      setMsg(`تمت المزامنة بنجاح! تم أرشفة ${previewData.archiveList.length} (خريجين/منقولين)، وتحديث ${previewData.updateList.length} طالب مستمر (مع تثبيت كافة أكوادهم السابقة)، وإضافة ${previewData.insertList.length} طالب جديد.`);
      setPreviewData(null);
      setSheetUrl("");
    } catch (err: any) {
      setMsg(err.message);
    }
    setLoading(false);
  };

  const fetchStudentsForExport = async (year: string) => {
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("is_active", true)
        .eq("academic_year", year)
        .range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return all;
  };

  const handleExportPDF = async () => {
    if (!exportYear) {
      alert("الرجاء اختيار الفرقة أولاً");
      return;
    }
    setLoading(true);
    try {
      const students = await fetchStudentsForExport(exportYear);
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
    } catch (err: any) {
      alert("خطأ أثناء استخراج PDF: " + err.message);
    }
    setLoading(false);
  };

  const handleExportExcel = async () => {
    if (!exportYear) {
      alert("الرجاء اختيار الفرقة أولاً");
      return;
    }
    setLoading(true);
    try {
      const students = await fetchStudentsForExport(exportYear);
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
    } catch (err: any) {
      alert("خطأ أثناء استخراج Excel: " + err.message);
    }
    setLoading(false);
  };

  if (!activeModal) return null;

  return (
    <>
      {activeModal === "roster" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center", padding: "12px" }}>
          <div className="card" style={{ width: "95%", maxWidth: "540px", display: "flex", flexDirection: "column", maxHeight: "92vh", padding: 0, overflow: "hidden", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
            
            {/* Header Tabs */}
            <div style={{ display: "flex", alignItems: "center", background: "var(--bg-deep)", borderBottom: "1px solid var(--border)", padding: "0 10px 0 0" }}>
              <button onClick={() => setActiveTab("sync")} style={{ flex: 1, padding: "14px 10px", background: activeTab === "sync" ? "var(--surface)" : "transparent", color: activeTab === "sync" ? "var(--accent-ink)" : "var(--text-muted)", border: "none", borderBottom: activeTab === "sync" ? "2px solid var(--primary)" : "2px solid transparent", fontWeight: activeTab === "sync" ? 600 : 500, cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <RefreshCw size={15} strokeWidth={1.5} />
                <span>مزامنة وترفيع الدفعات</span>
              </button>
              <button onClick={() => setActiveTab("export")} style={{ flex: 1, padding: "14px 10px", background: activeTab === "export" ? "var(--surface)" : "transparent", color: activeTab === "export" ? "var(--accent-ink)" : "var(--text-muted)", border: "none", borderBottom: activeTab === "export" ? "2px solid var(--primary)" : "2px solid transparent", fontWeight: activeTab === "export" ? 600 : 500, cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <Download size={15} strokeWidth={1.5} />
                <span>تصدير الكشوف</span>
              </button>
              <button onClick={onClose} className="modal-close-btn" style={{ margin: "0 8px" }} title="إغلاق" aria-label="إغلاق">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ overflowY: "auto", padding: "20px", flexGrow: 1, direction: "rtl" }}>
              
              {activeTab === "sync" && (
                <>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "15px", textAlign: "center", lineHeight: "1.6" }}>
                    قم برفع الشيت متضمناً الدفعات المحدثة (الاسم، الفرقة، السكشن) <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>بدون أكواد</strong>.<br/>
                    يقوم النظام آلياً بـ <strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>تثبيت أكواد الطلاب المستمرين</strong>، وترفيع فرقهم وسكاشنهم، و<strong style={{ fontWeight: 600, color: "var(--text-primary)" }}>أرشفة الخريجين</strong> (الفرقة الرابعة السابقة) تلقائياً.
                  </p>

                  <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "15px", borderRadius: "12px", marginBottom: "15px", textAlign: "right" }}>
                    <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <Link2 size={14} strokeWidth={1.5} />
                      <span>خيار 1: رابط Google Sheets (أو تاب محدد):</span>
                    </label>
                    <input 
                      type="text" 
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..." 
                      style={{ marginBottom: "12px", fontSize: "12px", width: "100%", direction: "ltr", textAlign: "left", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "var(--surface)", color: "var(--text-primary)", boxSizing: "border-box" }} 
                      disabled={loading || !!previewData} 
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "5px 0 10px 0" }}>
                      <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
                      <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>أو مباشرة من جهازك</span>
                      <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
                    </div>

                    <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--success-ink)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <FileSpreadsheet size={14} strokeWidth={1.5} />
                      <span>خيار 2: رفع ملف CSV مباشر:</span>
                    </label>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept=".csv" 
                      onChange={handleFileUpload} 
                      disabled={loading || !!previewData}
                      style={{ display: "none" }} 
                    />
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={loading || !!previewData}
                      style={{ width: "100%", background: "var(--surface)", border: "1px dashed var(--border-light)", color: "var(--text-primary)", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
                    >
                      <Upload size={15} strokeWidth={1.5} />
                      <span>اختيار ملف CSV من الكمبيوتر</span>
                    </button>
                  </div>

                  {!previewData ? (
                    <button 
                      onClick={parseGoogleSheet} 
                      disabled={loading || !sheetUrl} 
                      style={{ background: "var(--primary)", fontSize: "14px", fontWeight: 600, width: "100%", padding: "12px", borderRadius: "8px", border: "none", color: "#fff", cursor: loading || !sheetUrl ? "not-allowed" : "pointer", opacity: loading || !sheetUrl ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                      <Search size={15} strokeWidth={1.5} />
                      <span>{loading ? "جاري المعالجة والفحص..." : "تحليل الشيت والمطابقة الذكية"}</span>
                    </button>
                  ) : (
                    <div style={{ background: "var(--bg-deep)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-light)", marginBottom: "10px" }}>
                      <h4 style={{ color: "var(--accent-ink)", margin: "0 0 12px 0", textAlign: "center", fontSize: "15px", fontWeight: 600 }}>
                        نتيجة المطابقة والترفيع الذكي
                      </h4>

                      {/* Security note */}
                      <div className="tabular-nums" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", padding: "10px", marginBottom: "14px", fontSize: "12px", color: "var(--success-ink)", lineHeight: "1.5", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <Lock size={15} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: "2px" }} />
                        <span>
                          <strong style={{ fontWeight: 600 }}>تثبيت الأكواد:</strong> كافة الطلاب المستمرين ({previewData.updateList.length} طالب) سيحتفظون بأكوادهم السابقة تماماً كما هي، وسيتم فقط ترفيع الفرق والسكاشن.
                        </span>
                      </div>

                      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0", fontSize: "13px", lineHeight: "2" }}>
                        <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "4px 0" }}>
                          <span style={{ color: "var(--accent-ink)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Users size={14} strokeWidth={1.5} />
                            <span>طلاب مستمرون (ترفيع واحتفاظ بالكود):</span>
                          </span> 
                          <strong className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{previewData.updateList.length} طالب</strong>
                        </li>
                        <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "4px 0" }}>
                          <span style={{ color: "var(--error-ink)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <GraduationCap size={14} strokeWidth={1.5} />
                            <span>خريجون / منقولون (للأرشيف):</span>
                          </span> 
                          <strong className="tabular-nums" style={{ color: "var(--error-ink)", fontWeight: 600 }}>{previewData.archiveList.length} طالب</strong>
                        </li>
                        <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                          <span style={{ color: "var(--success-ink)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <UserPlus size={14} strokeWidth={1.5} />
                            <span>طلاب مستجدون (أكواد جديدة):</span>
                          </span> 
                          <strong className="tabular-nums" style={{ color: "var(--success-ink)", fontWeight: 600 }}>{previewData.insertList.length} طالب</strong>
                        </li>
                      </ul>

                      {/* Details toggle */}
                      <button 
                        type="button" 
                        onClick={() => setShowDetails(!showDetails)}
                        style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border-light)", color: "var(--text-muted)", padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: 500, cursor: "pointer", marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        {showDetails ? (
                          <>
                            <ChevronUp size={14} strokeWidth={1.5} />
                            <span>إخفاء التفاصيل</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} strokeWidth={1.5} />
                            <span>عرض تفاصيل وعينات المطابقة</span>
                          </>
                        )}
                      </button>

                      {showDetails && (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", marginBottom: "14px", maxHeight: "180px", overflowY: "auto", fontSize: "11px" }}>
                          <div style={{ fontWeight: 600, color: "var(--error-ink)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                            <GraduationCap size={13} strokeWidth={1.5} />
                            <span>عينة من الخريجين المحولين للأرشيف (أول 5):</span>
                          </div>
                          {previewData.archiveList.slice(0, 5).map(s => (
                            <div key={s.id} className="tabular-nums" style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", padding: "2px 0" }}>
                              <span>{s.full_name}</span>
                              <span>كود: {s.student_code} ({s.academic_year})</span>
                            </div>
                          ))}

                          <div style={{ fontWeight: 600, color: "var(--accent-ink)", marginTop: "10px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                            <Users size={13} strokeWidth={1.5} />
                            <span>عينة من المستمرين المحتفظين بأكوادهم (أول 5):</span>
                          </div>
                          {previewData.updateList.slice(0, 5).map(s => (
                            <div key={s.id} className="tabular-nums" style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", padding: "2px 0" }}>
                              <span>{s.full_name}</span>
                              <span style={{ color: "var(--accent-ink)" }}>كود ثابت: {s.student_code} ← {s.academic_year} (س{s.section})</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <button 
                        onClick={executeSync} 
                        disabled={loading} 
                        style={{ background: "var(--success)", fontSize: "14px", fontWeight: 600, width: "100%", padding: "12px", borderRadius: "8px", border: "none", color: "#fff", marginBottom: "8px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <Check size={16} strokeWidth={1.5} />
                        <span>{loading ? "جاري الحفظ والأرشفة..." : "تأكيد وتنفيذ المزامنة والأرشفة"}</span>
                      </button>
                      <button 
                        onClick={() => { setPreviewData(null); setShowDetails(false); }} 
                        disabled={loading} 
                        style={{ background: "transparent", color: "var(--error-ink)", border: "1px solid var(--error)", width: "100%", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
                      >
                        إلغاء المعاينة
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === "export" && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px", lineHeight: "1.6" }}>
                    بعد إتمام المزامنة، يمكنك تحميل كشوف الطلاب متضمنة الأكواد التي تم الاحتفاظ بها آلياً أو توليدها.
                  </p>
                  <label style={{ display: "block", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500, fontSize: "13px" }}>اختر الفرقة المراد تصديرها:</label>
                  <select 
                    value={exportYear} 
                    onChange={e => setExportYear(e.target.value)}
                    style={{ width: "100%", padding: "10px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", borderRadius: "8px", marginBottom: "20px" }}
                  >
                    <option value="">-- اختر الفرقة --</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={handleExportPDF} disabled={loading} style={{ flex: 1, background: "var(--error)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <FileText size={15} strokeWidth={1.5} />
                      <span>تحميل PDF</span>
                    </button>
                    <button onClick={handleExportExcel} disabled={loading} style={{ flex: 1, background: "var(--success)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <FileSpreadsheet size={15} strokeWidth={1.5} />
                      <span>تحميل Excel</span>
                    </button>
                  </div>
                </div>
              )}

              {msg && (
                <div style={{ marginTop: "15px", fontSize: "13px", color: msg.includes("بنجاح") ? "var(--success-ink)" : "var(--warning-ink)", textAlign: "center", background: msg.includes("بنجاح") ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)", padding: "10px", borderRadius: "8px", border: `1px solid ${msg.includes("بنجاح") ? "var(--success)" : "var(--warning)"}` }}>
                  {msg}
                </div>
              )}
            </div>

            <div style={{ padding: "12px 20px", background: "var(--bg-deep)", borderTop: "1px solid var(--border)" }}>
              <button className="secondary" onClick={onClose} style={{ width: "100%", margin: 0, padding: "10px", borderRadius: "8px" }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
