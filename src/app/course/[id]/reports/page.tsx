"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generatePrintableHtml } from "@/lib/pdfHelper";
import { downloadPdf } from "@/lib/downloadPdf";
import { getTermAndWeekInfo } from "@/lib/termHelper";
import { getCurrentWeekRange } from "@/lib/dateHelpers";

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"attendance" | "single_project" | "all_projects" | "raw" | "grading">("attendance");

  // Local-first synchronous load
  const initialCourse = typeof window !== 'undefined'
    ? (() => {
        try {
          const attCache = localStorage.getItem(`cache_attendance_${resolvedParams.id}`);
          if (attCache) {
            const p = JSON.parse(attCache);
            if (p.course) return p.course;
          }
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("cached_courses_")) {
              const list = JSON.parse(localStorage.getItem(k) || "[]");
              const found = list.find((c: any) => c.id === resolvedParams.id);
              if (found) return found;
            }
          }
        } catch(e) {}
        return null;
      })()
    : null;

  const [course, setCourse] = useState<any>(() => initialCourse);
  const [students, setStudents] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const attCache = localStorage.getItem(`cache_attendance_${resolvedParams.id}`);
        if (attCache) {
          const p = JSON.parse(attCache);
          if (p.students && p.students.length > 0) return p.students;
        }
      } catch(e) {}
    }
    return [];
  });
  const [attendance, setAttendance] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>(() => {
    if (initialCourse?.custom_week_names?.__projects__) {
      return initialCourse.custom_week_names.__projects__.filter((p: any) => !p.is_archived);
    }
    return [];
  });
  const [evaluations, setEvaluations] = useState<any[]>([]);

  const [weeks, setWeeks] = useState<{ key: string; name: string; subtitle: string; start: Date; end: Date }[]>([]);
  const [instructorName, setInstructorName] = useState<string>("........................");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");

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
    if (!initialCourse && !course) setLoading(true);

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

    // Generate Weeks List based on official term start date from system_settings
    if (courseData) {
      const { data: systemTerms } = await supabase
        .from("system_settings")
        .select("term1_start, term2_start, term1_end, term2_end")
        .eq("id", 1)
        .maybeSingle();

      const arabicNumbers = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"];
      
      let termStartDateStr: string | null = null;
      const courseCreatedAt = courseData.created_at ? new Date(courseData.created_at) : new Date();

      if (systemTerms) {
        const t2s = systemTerms.term2_start;
        const t1s = systemTerms.term1_start;
        if (t2s && (courseCreatedAt >= new Date(t2s + "T00:00:00") || new Date() >= new Date(t2s + "T00:00:00"))) {
          termStartDateStr = t2s;
        } else if (t1s) {
          termStartDateStr = t1s;
        }
      }

      let startRefDate: Date;
      if (termStartDateStr) {
        const [y, m, d] = termStartDateStr.split('-').map(Number);
        startRefDate = new Date(y, m - 1, d, 0, 0, 0);
      } else {
        startRefDate = courseData.created_at ? new Date(courseData.created_at) : new Date();
      }

      const dayOfWeek = startRefDate.getDay();
      const daysToSubtract = (dayOfWeek + 1) % 7; 
      const termStart = new Date(startRefDate);
      termStart.setDate(startRefDate.getDate() - daysToSubtract);
      termStart.setHours(0,0,0,0);

      const { startOfWeek: currentWeekStart } = getCurrentWeekRange();

      let maxAttDate = new Date(currentWeekStart);
      (attData || []).forEach((a: any) => {
        if (a.date) {
          const [ay, am, ad] = a.date.split('-').map(Number);
          const d = new Date(ay, am - 1, ad);
          const dow = d.getDay();
          const sub = (dow + 1) % 7;
          const s = new Date(d);
          s.setDate(d.getDate() - sub);
          s.setHours(0, 0, 0, 0);
          if (s > maxAttDate) maxAttDate = s;
        }
      });

      const weeksList = [];
      let current = new Date(termStart);
      let index = 0;
      
      if (current > maxAttDate) {
        current = new Date(maxAttDate);
      }

      while (current <= maxAttDate) {
        const key = current.toISOString().split('T')[0];
        const end = new Date(current);
        end.setDate(current.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        
        const sDay = current.getDate();
        const sMonth = current.getMonth() + 1;
        const eDay = end.getDate();
        const eMonth = end.getMonth() + 1;
        const subtitle = sMonth === eMonth
          ? `من ${sDay} إلى ${eDay} / ${eMonth}`
          : `من ${sDay}/${sMonth} إلى ${eDay}/${eMonth}`;

        const defaultName = `الأسبوع ${arabicNumbers[index] || (index + 1)}`;
        const name = courseData.custom_week_names?.[key] || defaultName;

        weeksList.push({
          key,
          name,
          subtitle,
          start: new Date(current),
          end: new Date(end)
        });
        
        current.setDate(current.getDate() + 7);
        index++;
      }

      if (weeksList.length === 0) {
        const key = current.toISOString().split('T')[0];
        const end = new Date(current);
        end.setDate(current.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        const sDay = current.getDate();
        const sMonth = current.getMonth() + 1;
        const eDay = end.getDate();
        const eMonth = end.getMonth() + 1;
        const subtitle = sMonth === eMonth
          ? `من ${sDay} إلى ${eDay} / ${eMonth}`
          : `من ${sDay}/${sMonth} إلى ${eDay}/${eMonth}`;
        weeksList.push({
          key,
          name: "الأسبوع الأول",
          subtitle,
          start: new Date(current),
          end: new Date(end)
        });
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

  // --- Report 1: Detailed Attendance (Landscape & Partitioned by Section) ---
  const printDetailedAttendance = async () => {
    const termInfo = await getTermAndWeekInfo();

    // 1. Filter students by selected section (or all)
    const targetStudents = selectedSectionFilter === "all"
      ? students
      : students.filter(s => (s.section ? String(s.section).trim() : "تخلفات") === selectedSectionFilter);

    if (!targetStudents || targetStudents.length === 0) {
      alert("لا يوجد طلاب مسجلين في هذا السكشن للطباعة.");
      return;
    }

    // 2. Group students by section
    const sectionsMap = new Map<string, any[]>();
    targetStudents.forEach(s => {
      const secKey = s.section ? String(s.section).trim() : "تخلفات";
      if (!sectionsMap.has(secKey)) {
        sectionsMap.set(secKey, []);
      }
      sectionsMap.get(secKey)!.push(s);
    });

    // 3. Sort sections numerically, then non-numeric
    const sortedSecKeys = Array.from(sectionsMap.keys()).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return a.localeCompare(b, 'ar');
    });

    // Helper: format actual attendance date
    const formatActualDate = (att: any) => {
      if (att.date) {
        const parts = att.date.split('-');
        if (parts.length === 3) {
          const day = parseInt(parts[2], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[0], 10);
          return `${day}/${month}/${year}`;
        }
      }
      if (att.created_at) {
        const d = new Date(att.created_at);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      }
      return '';
    };

    let allSectionsHtml = `
      <style>
        .att-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          table-layout: fixed;
          page-break-inside: auto;
        }
        .att-table thead {
          display: table-header-group;
        }
        .att-table tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        .att-table th, .att-table td {
          border: 1px solid #000 !important;
          padding: 5px 3px;
          text-align: center;
          vertical-align: middle;
          box-sizing: border-box;
        }
        .att-table th {
          background-color: #f1f5f9 !important;
          font-weight: bold;
        }
        .section-sheet {
          box-sizing: border-box;
          width: 100%;
        }
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .section-sheet {
            page-break-after: always;
            break-after: page;
          }
        }
      </style>
    `;

    sortedSecKeys.forEach((secKey, secIdx) => {
      const secStudents = sectionsMap.get(secKey)!;
      // Sort alphabetically by full name
      secStudents.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));

      const secTitleBadge = secKey === 'تخلفات' ? 'طلاب الباقين للإعادة / التخلفات' : `سكشن (${secKey})`;

      let tableRows = '';
      secStudents.forEach((s, idx) => {
        let rowHtml = `
          <tr>
            <td style="width: 32px; text-align: center; font-weight: bold; font-size: 11px; background-color: #fafafa;">${idx + 1}</td>
            <td style="width: 180px; text-align: right; font-weight: bold; white-space: nowrap; padding-right: 8px; font-size: 12px; color: #000;">
              ${s.full_name}
            </td>
        `;

        weeks.forEach(w => {
          // Find attendance for student in this week
          const studentWeekAtts = attendance.filter(a => {
            if (String(a.student_id) !== String(s.id)) return false;
            if (a.date === w.key) return true;
            if (w.start && w.end && a.date) {
              const [ay, am, ad] = a.date.split('-').map(Number);
              const aDate = new Date(ay, am - 1, ad, 12, 0, 0);
              return aDate >= w.start && aDate <= w.end;
            }
            return false;
          });

          const presentAtt = studentWeekAtts.find(a => a.status === 'حاضر');
          const excuseAtt = studentWeekAtts.find(a => a.status === 'غياب بعذر');
          const att = presentAtt || excuseAtt || studentWeekAtts[0];

          if (att) {
            const actualDate = formatActualDate(att);
            if (att.status === 'غياب بعذر') {
              // Shaded fully red with excuse
              rowHtml += `
                <td style="background-color: #f8d7da !important; color: #842029 !important; border: 1px solid #dc3545 !important; padding: 4px 2px;">
                  <div style="font-size: 11px; font-weight: bold; line-height: 1.2;">عذر</div>
                  <div style="font-size: 9px; line-height: 1.1; margin-top: 1px; max-width: 90px; margin-left: auto; margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${att.note || ''}">${att.note || 'غياب بعذر'}</div>
                  <div style="font-size: 8px; opacity: 0.85; margin-top: 1px;">${actualDate}</div>
                </td>
              `;
            } else {
              // Shaded fully green with actual date
              rowHtml += `
                <td style="background-color: #d1e7dd !important; color: #0f5132 !important; border: 1px solid #198754 !important; padding: 4px 2px;">
                  <div style="font-size: 11px; font-weight: bold; line-height: 1.2;">${actualDate}</div>
                  <div style="font-size: 8.5px; font-weight: 600; color: #155724; margin-top: 1px;">حاضر</div>
                </td>
              `;
            }
          } else {
            // Absent without excuse - unshaded empty cell with clean dash
            rowHtml += `
              <td style="background-color: #ffffff !important; border: 1px solid #000000 !important; color: #ccc;">
                -
              </td>
            `;
          }
        });

        rowHtml += `</tr>`;
        tableRows += rowHtml;
      });

      const isLast = secIdx === sortedSecKeys.length - 1;

      allSectionsHtml += `
        <div class="section-sheet" style="${!isLast ? 'page-break-after: always; break-after: page;' : ''}">
          <!-- الترويسة الرسمية للسكشن -->
          <div class="report-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; font-weight: bold; font-size: 13.5px; line-height: 1.5; border-bottom: 2px solid #000; padding-bottom: 8px; padding-top: 4px;">
            <div style="text-align: right; width: 28%;">
              جامعة قنا<br/>
              كلية التربية النوعية<br/>
              قسم التربية الفنية
            </div>
            <div style="text-align: center; width: 44%;">
              <div style="font-size: 19px; font-weight: bold; margin-bottom: 2px;">كشف الحضور والغياب التفصيلي</div>
              <div style="font-size: 12.5px; color: #222; font-weight: bold;">
                مقرر: ${course?.name || ''} &nbsp;|&nbsp; الفرقة: ${course?.academic_year || ''}
              </div>
              <div style="margin-top: 5px;">
                <span style="background: #0f172a; color: #ffffff; padding: 3px 18px; border-radius: 6px; font-size: 14px; font-weight: bold; display: inline-block;">
                  ${secTitleBadge}
                </span>
              </div>
            </div>
            <div style="text-align: left; width: 28%; font-size: 13px; line-height: 1.5;">
              أستاذ المقرر: <b>${instructorName}</b><br/>
              ${termInfo ? `<span style="font-size: 11px; color: #444;">${termInfo}</span><br/>` : ''}
              <span style="font-size: 11.5px; color: #000;">إجمالي طلاب السكشن: <b>${secStudents.length} طالب</b></span>
            </div>
          </div>

          <!-- جدول الحضور التفصيلي الخاص بالسكشن -->
          <table class="att-table">
            <thead>
              <tr>
                <th style="width: 32px; text-align: center; font-size: 12px;">م</th>
                <th style="width: 180px; text-align: right; font-size: 12px; padding-right: 8px;">اسم الطالب</th>
                ${weeks.map(w => `
                  <th style="text-align: center; vertical-align: middle; padding: 4px 2px;">
                    <div style="font-weight: bold; font-size: 11px; white-space: nowrap;">${w.name}</div>
                    <div style="font-size: 8.5px; font-weight: normal; color: #333; margin-top: 2px; white-space: nowrap;">${w.subtitle}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <!-- التوقيعات وتذييل السكشن -->
          <div style="margin-top: 15px; padding-top: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; padding: 0 30px; margin-bottom: 12px;">
              <div>توقيع أستاذ المادة: .................................</div>
              <div>توقيع رئيس القسم: .................................</div>
              <div>عميد الكلية: .................................</div>
            </div>
            <div class="page-footer" style="font-size: 10px; text-align: center; color: #555; border-top: 1px dashed #aaa; padding-top: 4px;">
              تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} &nbsp;&nbsp;|&nbsp;&nbsp; منظومة قسم التربية الفنية &nbsp;&nbsp;|&nbsp;&nbsp; مبرمج ومطور النظام: <span style="font-size: 11px; color: #000; font-weight: bold;">إسلام عبداللطيف</span>
            </div>
          </div>
        </div>
        ${!isLast ? '<div class="html2pdf__page-break" style="page-break-after: always; break-after: page;"></div>' : ''}
      `;
    });

    const filename = selectedSectionFilter === 'all'
      ? `${course?.name || 'course'}_attendance_detailed_all_sections.pdf`
      : `${course?.name || 'course'}_attendance_section_${selectedSectionFilter}.pdf`;

    await downloadPdf(
      filename,
      course?.name || "",
      "كشف الحضور التفصيلي",
      "",
      allSectionsHtml,
      instructorName,
      "landscape",
      true
    );
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
    await downloadPdf("report.pdf", course?.name || "", "كشف الطلاب غير المقيمين", `المشروع: ${proj?.name || ''} | ${termInfo}`, tableHtml, instructorName);
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
    await downloadPdf("report.pdf", course?.name || "", "كشف رصد درجات مشروع", `المشروع: ${proj?.name || ''} | ${termInfo}`, tableHtml, instructorName);
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

  const printAllProjectsUnevaluated = async () => {
    const { completelyUnevaluated } = getAllProjectsStats();
    let tableRows = '';
    completelyUnevaluated.forEach((s, i) => {
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${s.full_name}</td><td>${s.section || 'تخلفات'}</td><td>لم يقدم أي مشروع</td></tr>`;
    });
    const tableHtml = `<table><thead><tr><th style="width: 50px;">م</th><th>اسم الطالب</th><th style="width: 100px;">السكشن</th><th style="width: 150px;">الحالة</th></tr></thead><tbody>${tableRows}</tbody></table>`;
    await downloadPdf("report.pdf", course?.name || "", "كشف الطلاب المحرومين", "الطلاب الذين لم يقدموا أو يُقيّموا في أي مشروع نهائياً.", tableHtml, instructorName);
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
    await downloadPdf("report.pdf", course?.name || "", "كشف إجمالي درجات التقييمات", `إجمالي الدرجات التي حصل عليها الطالب في جميع المشاريع المقيمة. | ${termInfo}`, tableHtml, instructorName);
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

    await downloadPdf("report.pdf", course?.name || "", "كشف درجات أعمال السنة (تجميعي)", `يعرض درجات الغياب، المشاريع، والميدتيرم مجمعة. | ${termInfo}`, tableHtml, instructorName);
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

    await downloadPdf("report.pdf", course?.name || "", "كشف النتيجة النهائية المجمع (الكنترول)", `تمت معالجة وتحجيم الدرجات وتقريبها حسب إعدادات الكنترول المطلوبة. | ${termInfo}`, tableHtml, instructorName);
  };

  const availableSections = Array.from(
    new Set(students.map(s => s.section ? String(s.section).trim() : 'تخلفات'))
  ).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b, 'ar');
  });

  // UI Tabs Definition
  const tabs = [
    { id: "attendance", label: "الحضور التفصيلي", icon: "📅" },
    { id: "single_project", label: "تقييم مشروع", icon: "📊" },
    { id: "all_projects", label: "الشامل للمشاريع", icon: "📑" },
    { id: "raw", label: "التقرير الخام", icon: "📋" },
    { id: "grading", label: "التجميع (الكنترول)", icon: "⚙️" },
  ];

  if (loading && !course) {
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ color: "#4CAF50", margin: 0 }}>📅 كشف الحضور والغياب التفصيلي (بالعرض - مقسم بالسكاشن)</h3>
              <span style={{ fontSize: "12px", background: "rgba(76, 175, 80, 0.15)", color: "#4CAF50", padding: "4px 12px", borderRadius: "20px", fontWeight: "bold", border: "1px solid rgba(76, 175, 80, 0.3)" }}>
                صفحة بالعرض (Landscape)
              </span>
            </div>

            <p style={{ color: "#aaa", fontSize: "14px", lineHeight: "1.6" }}>
              يُنشئ هذا الكشف جدولاً أفقياً بالعرض (Landscape)، ويقسم كل سكشن تلقائياً في ورقة أو ورقتين مع كتابة اسم ورقم السكشن والترويسة الرسمية في أعلى كل ورقة. يتم تظليل خانات الحضور بالكامل باللون الأخضر مع التاريخ الفعلي للتسجيل، بينما تُظلل خانات الأعذار باللون الأحمر مع كتابة سبب العذر.
            </p>

            {/* Section Selection */}
            <div style={{ background: "#1e1e1e", padding: "16px 20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px", color: "#e2e8f0", fontSize: "14px", fontWeight: "bold" }}>
                🗂️ نطاق تصدير السكاشن:
              </label>
              <select 
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#2a2a2a",
                  border: "1px solid #555",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "15px",
                  outline: "none",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                <option value="all">📁 جميع السكاشن (مقسمة تلقائياً: كل سكشن في ورقة/صفحات مستقلة)</option>
                {availableSections.map(sec => (
                  <option key={sec} value={sec}>
                    {sec === "تخلفات" ? "طلاب الباقين للإعادة / التخلفات" : `سكشن (${sec}) فقط`}
                  </option>
                ))}
              </select>

              {/* Sections Badges List */}
              <div style={{ marginTop: "15px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {availableSections.map(sec => {
                  const secCount = students.filter(s => (s.section ? String(s.section).trim() : 'تخلفات') === sec).length;
                  const isSelected = selectedSectionFilter === 'all' || selectedSectionFilter === sec;
                  return (
                    <span 
                      key={sec}
                      onClick={() => setSelectedSectionFilter(sec)}
                      style={{
                        fontSize: "12px",
                        padding: "5px 12px",
                        borderRadius: "8px",
                        background: selectedSectionFilter === sec ? "#4CAF50" : (isSelected ? "#333" : "#222"),
                        color: selectedSectionFilter === sec ? "#fff" : "#ccc",
                        border: selectedSectionFilter === sec ? "1px solid #4CAF50" : "1px solid #444",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <b>{sec === 'تخلفات' ? 'تخلفات' : `س${sec}`}</b>
                      <span style={{ opacity: 0.8, fontSize: "11px" }}>({secCount} طالب)</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Quick Stats Box */}
            <div style={{ background: "#1e1e1e", padding: "16px 20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#aaa" }}>إجمالي الأسابيع المدرجة:</span>
                <span style={{ color: "#fff", fontWeight: "bold" }}>{weeks.length} أسابيع</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#aaa" }}>إجمالي طلاب الكشف الحالي:</span>
                <span style={{ color: "#4CAF50", fontWeight: "bold" }}>
                  {selectedSectionFilter === 'all' ? students.length : students.filter(s => (s.section ? String(s.section).trim() : 'تخلفات') === selectedSectionFilter).length} طالب
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#aaa" }}>تخطيط الصفحة:</span>
                <span style={{ color: "#38bdf8", fontWeight: "bold" }}>أفقي بالعرض (Landscape) - A4</span>
              </div>
            </div>

            <button 
              onClick={printDetailedAttendance} 
              style={{ 
                width: "100%", 
                background: "#4CAF50", 
                color: "#fff", 
                border: "none", 
                padding: "16px", 
                borderRadius: "12px", 
                fontSize: "17px", 
                fontWeight: "bold", 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                gap: "10px",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(76, 175, 80, 0.3)"
              }}
            >
              <span style={{ fontSize: "20px" }}>🖨️</span> طباعة وتحميل كشف الحضور التفصيلي (بالعرض)
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
