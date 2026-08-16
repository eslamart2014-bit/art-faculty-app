"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generatePrintableHtml } from "@/lib/pdfHelper";
import { getTermAndWeekInfo } from "@/lib/termHelper";

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"attendance" | "single_project" | "all_projects" | "raw" | "grading">("attendance");

  const [course, setCourse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);

  const [weeks, setWeeks] = useState<{ key: string; name: string; subtitle: string; start: Date; end: Date }[]>([]);
  const [instructorName, setInstructorName] = useState<string>("........................");

  // Tab 2 State
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Tab 5 State (Grading Engine)
  const [attendancePoints, setAttendancePoints] = useState<number>(1);
  const [mergeAttendance, setMergeAttendance] = useState<boolean>(true);
  const [projectWeights, setProjectWeights] = useState<{ [key: string]: number }>({});
  const [roundingMethod, setRoundingMethod] = useState<"integer" | "decimal" | "none">("integer");

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch Course
    const { data: courseData } = await supabase.from("courses").select("*").eq("id", resolvedParams.id).single();
    if (courseData) setCourse(courseData);

    // Fetch Students (including makeup)
    const { data: studentsData } = await supabase.from("students").select("*").eq("academic_year", courseData?.academic_year);
    const makeupIds = courseData?.makeup_students || [];
    const { data: makeupData } = makeupIds.length > 0 
      ? await supabase.from("students").select("*").in("id", makeupIds) 
      : { data: [] };
    
    const excluded = courseData?.excluded_students || [];
    const allStudents = [...(studentsData || []), ...(makeupData || [])]
      .filter((s: any, index: number, self: any[]) => 
        !excluded.includes(s.id) && index === self.findIndex((t) => t.id === s.id)
      )
      .sort((a, b) => {
        const secA = parseInt(a.section) || 999;
        const secB = parseInt(b.section) || 999;
        if (secA !== secB) return secA - secB;
        return a.full_name.localeCompare(b.full_name, 'ar');
      });
    
    setStudents(allStudents);

    // Fetch Instructor Name from profiles table
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: profile } = await supabase.from("profiles").select("full_name, degree").eq("id", userData.user.id).single();
      if (profile && profile.full_name) {
        const title = profile.degree ? `${profile.degree}/` : '';
        setInstructorName(`${title}${profile.full_name}`);
      } else {
        setInstructorName(userData.user.email || "........................");
      }
    }

    // Fetch Attendance
    const { data: attData } = await supabase.from("attendance").select("*").eq("course_id", resolvedParams.id);
    setAttendance(attData || []);

    // Fetch Projects (saved in courseData.custom_week_names.__projects__)
    const projData = courseData?.custom_week_names?.__projects__ || [];
    setProjects(projData);

    // Fetch Evaluations
    const { data: evalData } = await supabase.from("evaluations").select("*").eq("course_id", resolvedParams.id);
    setEvaluations(evalData || []);

    // Generate Weeks List based on Course Created_at
    if (courseData) {
      // Logic for weeks (omitted from modification block for brevity, keeping existing)
      const arabicNumbers = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر"];
      const startCourseDate = new Date(courseData.created_at || new Date());
      const dayOfWeek = startCourseDate.getDay();
      const daysToSubtract = (dayOfWeek + 1) % 7; 
      const termStart = new Date(startCourseDate);
      termStart.setDate(startCourseDate.getDate() - daysToSubtract);
      termStart.setHours(0,0,0,0);

      const now = new Date();
      const currentDaysToSubtract = (now.getDay() + 1) % 7;
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - currentDaysToSubtract);
      currentWeekStart.setHours(0,0,0,0);

      const weeksList = [];
      let current = new Date(termStart);
      let index = 0;
      
      if (current > currentWeekStart) {
        current = new Date(currentWeekStart);
      }

      while (current <= currentWeekStart) {
        const key = current.toISOString().split('T')[0];
        const end = new Date(current);
        end.setDate(current.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        
        const startStr = current.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
        const endStr = end.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
        const defaultName = `الأسبوع ${arabicNumbers[index] || (index + 1)}`;
        const name = courseData.custom_week_names?.[key] || defaultName;

        weeksList.push({
          key,
          name,
          subtitle: `${startStr} - ${endStr}`,
          start: new Date(current),
          end: new Date(end)
        });
        
        current.setDate(current.getDate() + 7);
        index++;
      }
      setWeeks(weeksList);
    }

    // Initialize weights for Grading Engine
    if (projData) {
      const initialWeights: any = {};
      projData.forEach((p: any) => { initialWeights[p.id] = p.max_score; });
      setProjectWeights(initialWeights);
    }

    setLoading(false);
  };

  // --- Report 1: Detailed Attendance (PDF) ---
  const printDetailedAttendance = async () => {
    const termInfo = await getTermAndWeekInfo();
    let tableRows = '';
    students.forEach((s, i) => {
      let rowHtml = `<tr><td>${i + 1}</td><td style="text-align: right; white-space: nowrap;">${s.full_name}</td><td>${s.section || 'تخلفات'}</td>`;
      weeks.forEach(w => {
        // Find attendance in this week
        const att = attendance.find(a => a.student_id === s.id && new Date(a.date) >= w.start && new Date(a.date) <= w.end);
        if (att) {
          const dateStr = new Date(att.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
          rowHtml += `<td style="background-color: #d4edda !important; color: #155724; font-weight: bold; font-size: 11px;">${dateStr}</td>`;
        } else {
          rowHtml += `<td></td>`;
        }
      });
      rowHtml += `</tr>`;
      tableRows += rowHtml;
    });

    const tableHtml = `
      <style>
        .att-table th, .att-table td { padding: 4px; font-size: 11px; }
        .week-header { font-size: 10px; display: flex; flex-direction: column; }
        .week-dates { font-size: 8px; font-weight: normal; color: #555; }
        @media print {
          .att-table td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
      <table class="att-table">
        <thead>
          <tr>
            <th style="width: 30px;">م</th>
            <th style="width: 150px;">اسم الطالب</th>
            <th style="width: 50px;">السكشن</th>
            ${weeks.map(w => `
              <th>
                <div class="week-header">
                  <span>${w.name}</span>
                  <span class="week-dates">${w.subtitle}</span>
                </div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    const html = generatePrintableHtml(course?.name || "", "كشف الغياب والحضور التفصيلي بالتاريخ", `يعرض تواريخ حضور كل طالب بدقة. ${termInfo}`, tableHtml, instructorName);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // --- Report 2: Single Project ---
  const getSingleProjectStats = () => {
    if (!selectedProjectId) return { evaluated: [], unevaluated: [], projectEvals: [] as any[] };
    const projectEvals = evaluations.filter(e => e.project_id === selectedProjectId);
    const evaluated = students.filter(s => projectEvals.some(e => e.student_id === s.id));
    const unevaluated = students.filter(s => !projectEvals.some(e => e.student_id === s.id));
    return { evaluated, unevaluated, projectEvals };
  };

  const printSingleProjectUnevaluated = async () => {
    const termInfo = await getTermAndWeekInfo();
    const { unevaluated } = getSingleProjectStats();
    const proj = projects.find(p => p.id === selectedProjectId);
    
    let tableRows = '';
    unevaluated.forEach((s, i) => {
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${s.full_name}</td><td>${s.section || 'تخلفات'}</td><td>لم يقيم</td></tr>`;
    });

    const tableHtml = `
      <table>
        <thead><tr><th style="width: 50px;">م</th><th>اسم الطالب</th><th style="width: 100px;">السكشن</th><th style="width: 100px;">الحالة</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
    const html = generatePrintableHtml(course?.name || "", "كشف الطلاب غير المقيمين", `المشروع: ${proj?.name || ''} | ${termInfo}`, tableHtml, instructorName);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const printSingleProjectEvaluated = async () => {
    const termInfo = await getTermAndWeekInfo();
    const { evaluated, projectEvals } = getSingleProjectStats();
    const proj = projects.find(p => p.id === selectedProjectId);
    
    let tableRows = '';
    evaluated.forEach((s, i) => {
      const ev = projectEvals.find(e => e.student_id === s.id);
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${s.full_name}</td><td>${s.section || 'تخلفات'}</td><td><strong>${ev?.score || 0}</strong> / ${proj?.max_score}</td></tr>`;
    });

    const tableHtml = `
      <table>
        <thead><tr><th style="width: 50px;">م</th><th>اسم الطالب</th><th style="width: 100px;">السكشن</th><th style="width: 100px;">الدرجة</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
    const html = generatePrintableHtml(course?.name || "", "كشف رصد درجات مشروع", `المشروع: ${proj?.name || ''} | ${termInfo}`, tableHtml, instructorName);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // --- Report 3: All Projects Summary ---
  const getAllProjectsStats = () => {
    const studentStats = students.map(s => {
      const sEvals = evaluations.filter(e => e.student_id === s.id);
      return { ...s, evalCount: sEvals.length };
    });
    
    const completelyUnevaluated = studentStats.filter(s => s.evalCount === 0);
    const evaluatedSomehow = studentStats.filter(s => s.evalCount > 0);
    return { completelyUnevaluated, evaluatedSomehow };
  };

  const printAllProjectsUnevaluated = () => {
    const { completelyUnevaluated } = getAllProjectsStats();
    let tableRows = '';
    completelyUnevaluated.forEach((s, i) => {
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${s.full_name}</td><td>${s.section || 'تخلفات'}</td><td>لم يقدم أي مشروع</td></tr>`;
    });
    const tableHtml = `<table><thead><tr><th style="width: 50px;">م</th><th>اسم الطالب</th><th style="width: 100px;">السكشن</th><th style="width: 150px;">الحالة</th></tr></thead><tbody>${tableRows}</tbody></table>`;
    const html = generatePrintableHtml(course?.name || "", "كشف الطلاب المحرومين", "الطلاب الذين لم يقدموا أو يُقيّموا في أي مشروع نهائياً.", tableHtml, instructorName);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const printAllProjectsEvaluated = async () => {
    const termInfo = await getTermAndWeekInfo();
    const { evaluatedSomehow } = getAllProjectsStats();
    let tableRows = '';
    evaluatedSomehow.forEach((s, i) => {
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${s.full_name}</td><td>${s.section || 'تخلفات'}</td><td><strong>${s.evalCount}</strong> مشاريع</td></tr>`;
    });
    const tableHtml = `<table><thead><tr><th style="width: 50px;">م</th><th>اسم الطالب</th><th style="width: 100px;">السكشن</th><th style="width: 150px;">المشاريع المقيمة</th></tr></thead><tbody>${tableRows}</tbody>      </table>
    `;
    const html = generatePrintableHtml(course?.name || "", "كشف إجمالي درجات التقييمات", `إجمالي الدرجات التي حصل عليها الطالب في جميع المشاريع المقيمة. | ${termInfo}`, tableHtml, instructorName);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // --- Report 4: Comprehensive Raw Report ---
  const printRawReport = async () => {
    const termInfo = await getTermAndWeekInfo();
    let tableRows = '';
    
    const sortedProjects = [...projects].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    students.forEach((s, i) => {
      const presences = attendance.filter(a => a.student_id === s.id).length;
      let rowHtml = `<tr><td>${i + 1}</td><td style="text-align: right; white-space: nowrap;">${s.full_name}</td><td><strong>${presences}</strong></td>`;
      
      let totalRawScore = 0;
      sortedProjects.forEach(p => {
        const ev = evaluations.find(e => e.student_id === s.id && e.project_id === p.id);
        const score = ev ? ev.score : 0;
        totalRawScore += score;
        rowHtml += `<td>${score}</td>`;
      });
      
      rowHtml += `<td style="background:#f0f0f0;"><strong>${totalRawScore}</strong></td></tr>`;
      tableRows += rowHtml;
    });

    const tableHtml = `
      <style>
        .raw-table th, .raw-table td { padding: 4px; font-size: 11px; }
      </style>
      <table class="raw-table">
        <thead>
          <tr>
            <th style="width: 30px;">م</th>
            <th style="width: 150px;">اسم الطالب</th>
            <th style="width: 60px;">مرات الحضور</th>
            ${sortedProjects.map(p => `<th>${p.name} <br/><span style="font-size:9px; color:#555;">(من ${p.max_score})</span></th>`).join('')}
            <th style="width: 60px;">الإجمالي الخام</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    const html = generatePrintableHtml(course?.name || "", "كشف درجات أعمال السنة (تجميعي)", `يعرض درجات الغياب، المشاريع، والميدتيرم مجمعة. | ${termInfo}`, tableHtml, instructorName);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };


  // --- Report 4: Midterm ---
  const printMidtermReport = async () => {
    const termInfo = await getTermAndWeekInfo();
    let tableRows = '';
    const sortedProjects = [...projects].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    students.forEach((s, i) => {
      const presences = attendance.filter(a => a.student_id === s.id).length;

      // ... rest of implementation logic for midterm report ...
    });
  };

  // --- Report 5: Grading Engine ---
  const printGradingReport = async () => {
    const termInfo = await getTermAndWeekInfo();
    let tableRows = '';
    const sortedProjects = [...projects].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    students.forEach((s, i) => {
      const presences = attendance.filter(a => a.student_id === s.id).length;
      let attendanceScoreRaw = presences * attendancePoints;
      
      let rowHtml = `<tr><td>${i + 1}</td><td style="text-align: right;">${s.full_name}</td>`;
      rowHtml += `<td><strong>${presences}</strong></td>`;
      
      let attScoreStr = attendanceScoreRaw;
      if (roundingMethod === 'integer') attScoreStr = Math.round(attendanceScoreRaw);
      else if (roundingMethod === 'decimal') attScoreStr = Math.round(attendanceScoreRaw * 10) / 10;
      
      rowHtml += `<td>${attScoreStr}</td>`;

      let totalProjectsScore = 0;
      sortedProjects.forEach(p => {
        const ev = evaluations.find(e => e.student_id === s.id && e.project_id === p.id);
        const rawScore = ev ? ev.score : 0;
        const maxScore = p.max_score || 1;
        const trueWeight = projectWeights[p.id] !== undefined ? projectWeights[p.id] : maxScore;
        let weightedScore = (rawScore / maxScore) * trueWeight;
        
        let displayScore = weightedScore;
        if (roundingMethod === 'integer') displayScore = Math.round(displayScore);
        else if (roundingMethod === 'decimal') displayScore = Math.round(displayScore * 10) / 10;
        
        totalProjectsScore += weightedScore;
        rowHtml += `<td>${displayScore}</td>`;
      });
      
      let yearWorkScore = totalProjectsScore;
      if (roundingMethod === 'integer') yearWorkScore = Math.round(yearWorkScore);
      else if (roundingMethod === 'decimal') yearWorkScore = Math.round(yearWorkScore * 10) / 10;

      if (mergeAttendance) {
        let finalScore = attendanceScoreRaw + totalProjectsScore;
        if (roundingMethod === 'integer') finalScore = Math.round(finalScore);
        else if (roundingMethod === 'decimal') finalScore = Math.round(finalScore * 10) / 10;
        
        rowHtml += `<td style="background:#f0f0f0;"><strong>${finalScore}</strong></td>`;
      } else {
        rowHtml += `<td style="background:#f0f0f0;"><strong>${yearWorkScore}</strong></td>`;
      }
      
      rowHtml += `</tr>`;
      tableRows += rowHtml;
    });

    const tableHtml = `
      <style>.grad-table th, .grad-table td { padding: 4px; font-size: 11px; text-align: center; border: 1px solid #000; }</style>
      <table class="grad-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="width: 30px;">م</th>
            <th style="width: 150px;">اسم الطالب</th>
            <th style="width: 40px;">مرات الحضور</th>
            <th style="width: 40px;">درجة الحضور</th>
            ${sortedProjects.map(p => `<th>${p.name}<br/><span style="font-size:9px;color:#555;">(من ${projectWeights[p.id] !== undefined ? projectWeights[p.id] : p.max_score})</span></th>`).join('')}
            ${mergeAttendance ? `<th style="width: 60px;">الإجمالي المجمع</th>` : `<th style="width: 60px;">مجموع المشاريع</th>`}
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;

    const html = generatePrintableHtml(course?.name || "", "كشف النتيجة النهائية المجمع (الكنترول)", `تمت معالجة وتحجيم الدرجات وتقريبها حسب إعدادات الكنترول المطلوبة. | ${termInfo}`, tableHtml, instructorName);
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // UI Tabs Definition
  const tabs = [
    { id: "attendance", label: "الحضور التفصيلي", icon: "📅" },
    { id: "single_project", label: "تقييم مشروع", icon: "📊" },
    { id: "all_projects", label: "الشامل للمشاريع", icon: "📑" },
    { id: "raw", label: "التقرير الخام", icon: "📋" },
    { id: "grading", label: "التجميع (الكنترول)", icon: "⚙️" },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column" }}>
        <div className="loader-circle"></div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0", maxWidth: "900px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", direction: "rtl", background: "#121212", color: "#fff" }}>
      
      {/* Header */}
      <div style={{ padding: "15px 20px", background: "var(--surface)", borderBottom: "1px solid #333", display: "flex", alignItems: "center", gap: "15px" }}>
        <button className="hide-on-mobile" onClick={() => router.back()} style={{ background: "transparent", border: "1px solid #555", color: "#fff", padding: "5px 15px", borderRadius: "10px", cursor: "pointer" }}>🡲 عودة</button>
        <h2 style={{ margin: 0, fontSize: "18px", color: "var(--primary)" }}>التقارير - {course?.name}</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", overflowX: "auto", padding: "10px", gap: "10px", background: "#1a1a1a", borderBottom: "1px solid #333" }}>
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: "10px 15px",
              background: activeTab === t.id ? "var(--primary)" : "transparent",
              border: activeTab === t.id ? "none" : "1px solid #444",
              color: "#fff",
              borderRadius: "10px",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontWeight: activeTab === t.id ? "bold" : "normal"
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flexGrow: 1, overflowY: "auto", padding: "20px" }}>
        
        {/* --- Tab 1: Detailed Attendance --- */}
        {activeTab === "attendance" && (
          <div>
            <h3 style={{ color: "#4CAF50", marginTop: 0 }}>📅 كشف الحضور التفصيلي بالتاريخ</h3>
            <p style={{ color: "#aaa", fontSize: "14px" }}>هذا التقرير يستخرج جدولاً يحتوي على كافة أسابيع الفصل الدراسي، ويوضح بدقة اليوم والشهر الذي تم تحضير الطالب فيه. إذا غاب الطالب تظل الخانة فارغة.</p>
            
            <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#aaa" }}>إجمالي الأسابيع:</span>
                <span style={{ color: "#fff", fontWeight: "bold" }}>{weeks.length} أسابيع</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#aaa" }}>إجمالي الطلاب المتاحين:</span>
                <span style={{ color: "#fff", fontWeight: "bold" }}>{students.length} طالب</span>
              </div>
            </div>

            <button onClick={printDetailedAttendance} style={{ width: "100%", background: "#4CAF50", color: "#fff", border: "none", padding: "15px", borderRadius: "10px", fontSize: "16px", fontWeight: "bold", display: "flex", justifyContent: "center", gap: "10px" }}>
              <span>🖨️</span> طباعة كشف الحضور PDF
            </button>
          </div>
        )}

        {/* --- Tab 2: Single Project --- */}
        {activeTab === "single_project" && (
          <div>
            <h3 style={{ color: "#2196F3", marginTop: 0 }}>📊 كشف تقييم مشروع محدد</h3>
            
            <select 
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ width: "100%", padding: "12px", background: "#1e1e1e", border: "1px solid #444", borderRadius: "10px", color: "#fff", marginBottom: "20px", fontSize: "16px", outline: "none" }}
            >
              <option value="">-- اختر المشروع --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} (من {p.max_score})</option>
              ))}
            </select>

            {selectedProjectId && (() => {
              const { evaluated, unevaluated } = getSingleProjectStats();
              return (
                <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
                    <span style={{ color: "#aaa" }}>إجمالي طلاب المقرر:</span>
                    <span style={{ color: "#fff", fontWeight: "bold" }}>{students.length} طالب</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                    <span style={{ color: "#aaa" }}>من تم تقييمه:</span>
                    <span style={{ color: "#4CAF50", fontWeight: "bold" }}>{evaluated.length} طالب</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                    <span style={{ color: "#aaa" }}>من لم يُقيَّم:</span>
                    <span style={{ color: "#F44336", fontWeight: "bold" }}>{unevaluated.length} طالب</span>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={printSingleProjectEvaluated} style={{ flex: 1, background: "#4CAF50", color: "#fff", border: "none", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>
                      طباعة المقيمين
                    </button>
                    <button onClick={printSingleProjectUnevaluated} style={{ flex: 1, background: "#F44336", color: "#fff", border: "none", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>
                      طباعة من لم يُقيَّم
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* --- Tab 3: All Projects Summary --- */}
        {activeTab === "all_projects" && (() => {
          const { evaluatedSomehow, completelyUnevaluated } = getAllProjectsStats();
          return (
            <div>
              <h3 style={{ color: "#9C27B0", marginTop: 0 }}>📑 كشف التقييمات الشامل (إحصاء المشاريع)</h3>
              
              <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
                  <span style={{ color: "#aaa" }}>إجمالي طلاب المقرر:</span>
                  <span style={{ color: "#fff", fontWeight: "bold" }}>{students.length} طالب</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                  <span style={{ color: "#aaa" }}>قام بتقييم مشروع واحد على الأقل:</span>
                  <span style={{ color: "#4CAF50", fontWeight: "bold" }}>{evaluatedSomehow.length} طالب</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                  <span style={{ color: "#aaa" }}>لم يقم بأي مشروع إطلاقاً (محرومين):</span>
                  <span style={{ color: "#F44336", fontWeight: "bold" }}>{completelyUnevaluated.length} طالب</span>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={printAllProjectsEvaluated} style={{ flex: 1, background: "#9C27B0", color: "#fff", border: "none", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>
                    طباعة إحصاء التقييمات
                  </button>
                  <button onClick={printAllProjectsUnevaluated} style={{ flex: 1, background: "#F44336", color: "#fff", border: "none", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}>
                    طباعة المحرومين
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- Tab 4: Raw Report --- */}
        {activeTab === "raw" && (
          <div>
            <h3 style={{ color: "#FF9800", marginTop: 0 }}>📋 التقرير الشامل الخام</h3>
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px" }}>
              هذا التقرير يقوم بتجميع البيانات الأولية كما هي بدون أي معالجة. يعرض إجمالي عدد مرات الحضور لكل طالب، ودرجاته في كل مشروع، والمجموع الخام للدرجات. 
            </p>
            
            <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "24px", marginBottom: "10px" }}>{students.length} طالب</div>
              <div style={{ color: "#888", fontSize: "13px" }}>جاهز للطباعة والاستخراج في كشف مجمع</div>
            </div>

            <button onClick={printRawReport} style={{ width: "100%", background: "#FF9800", color: "#fff", border: "none", padding: "15px", borderRadius: "10px", fontSize: "16px", fontWeight: "bold", display: "flex", justifyContent: "center", gap: "10px" }}>
              <span>🖨️</span> طباعة التقرير الخام PDF
            </button>
          </div>
        )}

        {/* --- Tab 5: Grading Engine --- */}
        {activeTab === "grading" && (
          <div>
            <h3 style={{ color: "#E91E63", marginTop: 0 }}>⚙️ التجميع والكنترول (محرك الدرجات)</h3>
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px" }}>
              هذا المحرك يتيح لك وضع "الدرجة الحقيقية" لكل مشروع. سيقوم النظام تلقائياً بمعادلة الدرجات الكبيرة (مثلاً 30) وتحجيمها لتناسب الدرجة الحقيقية (مثلاً 15).
            </p>
            
            <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 15px 0", color: "#fff", borderBottom: "1px solid #333", paddingBottom: "10px" }}>إعدادات الحضور</h4>
              
              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={{ display: "block", color: "#aaa", fontSize: "14px", marginBottom: "8px" }}>قيمة كل مرة حضور (درجات):</label>
                  <input 
                    type="number" 
                    step="0.25"
                    value={attendancePoints}
                    onChange={(e) => setAttendancePoints(parseFloat(e.target.value) || 0)}
                    style={{ width: "100%", padding: "12px", background: "#121212", border: "1px solid #444", borderRadius: "10px", color: "#fff", fontSize: "16px", outline: "none" }}
                  />
                </div>
                
                <div style={{ flex: 1, minWidth: "200px", display: "flex", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "#fff" }}>
                    <input 
                      type="checkbox" 
                      checked={mergeAttendance}
                      onChange={(e) => setMergeAttendance(e.target.checked)}
                      style={{ width: "20px", height: "20px", accentColor: "#E91E63" }}
                    />
                    <span>دمج الحضور مع أعمال السنة</span>
                  </label>
                </div>
              </div>
            </div>

            <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 15px 0", color: "#fff", borderBottom: "1px solid #333", paddingBottom: "10px" }}>إعدادات أوزان المشاريع</h4>
              
              {projects.length === 0 ? (
                <div style={{ color: "#888", textAlign: "center", padding: "10px" }}>لا يوجد مشاريع حتى الآن</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  {projects.map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#121212", padding: "10px 15px", borderRadius: "10px", border: "1px solid #2a2a2a" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#fff", fontWeight: "bold" }}>{p.name}</div>
                        <div style={{ color: "#888", fontSize: "12px" }}>المسجلة حالياً من: {p.max_score}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ color: "#aaa", fontSize: "13px" }}>الدرجة الحقيقية:</span>
                        <input 
                          type="number" 
                          step="0.5"
                          value={projectWeights[p.id] !== undefined ? projectWeights[p.id] : p.max_score}
                          onChange={(e) => setProjectWeights(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                          style={{ width: "80px", padding: "8px", background: "#222", border: "1px solid #444", borderRadius: "8px", color: "#E91E63", fontWeight: "bold", textAlign: "center", outline: "none" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 15px 0", color: "#fff", borderBottom: "1px solid #333", paddingBottom: "10px" }}>إعدادات التقريب النهائي</h4>
              <div style={{ display: "flex", gap: "15px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", color: "#fff", cursor: "pointer" }}>
                  <input type="radio" name="rounding" checked={roundingMethod === 'integer'} onChange={() => setRoundingMethod('integer')} style={{ accentColor: "#E91E63" }} />
                  لأقرب عدد صحيح (مثال: 15)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", color: "#fff", cursor: "pointer" }}>
                  <input type="radio" name="rounding" checked={roundingMethod === 'decimal'} onChange={() => setRoundingMethod('decimal')} style={{ accentColor: "#E91E63" }} />
                  علامة عشرية (مثال: 14.5)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", color: "#fff", cursor: "pointer" }}>
                  <input type="radio" name="rounding" checked={roundingMethod === 'none'} onChange={() => setRoundingMethod('none')} style={{ accentColor: "#E91E63" }} />
                  بدون تقريب
                </label>
              </div>
            </div>

            <button onClick={printGradingReport} style={{ width: "100%", background: "#E91E63", color: "#fff", border: "none", padding: "18px", borderRadius: "10px", fontSize: "18px", fontWeight: "bold", display: "flex", justifyContent: "center", gap: "10px", boxShadow: "0 4px 15px rgba(233, 30, 99, 0.4)" }}>
              <span>🚀</span> معالجة واستخراج تقرير الكنترول
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
