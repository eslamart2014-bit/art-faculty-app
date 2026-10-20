"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generatePrintableHtml } from "@/lib/pdfHelper";
import { downloadPdf } from "@/lib/downloadPdf";
import { getTermAndWeekInfo } from "@/lib/termHelper";
import { getCurrentWeekRange } from "@/lib/dateHelpers";
import { getStudentTag } from "@/lib/studentTagsHelper";
import { formatInstructorTitle } from "@/lib/academicHelper";

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
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [paperSavingMode, setPaperSavingMode] = useState<boolean>(true);

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

    // Fast cache load for instant render while network loads
    if (typeof window !== 'undefined' && !students.length) {
      try {
        const attCacheStr = localStorage.getItem(`cache_attendance_${resolvedParams.id}`);
        if (attCacheStr) {
          const attCached = JSON.parse(attCacheStr);
          if (attCached?.students?.length > 0) setStudents(attCached.students);
          if (attCached?.course) setCourse(attCached.course);
        }
      } catch(e) {}
    }

    try {
      const [courseRes, userRes, attRes, evalRes, systemTermsRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', resolvedParams.id).single(),
        supabase.auth.getUser(),
        supabase.from('attendance').select('student_id, date, status, course_id, id').eq('course_id', resolvedParams.id),
        supabase.from('evaluations').select('*').eq('course_id', resolvedParams.id),
        supabase.from('system_settings').select('term1_start, term2_start, term1_end, term2_end').eq('id', 1).maybeSingle(),
      ]);
      const courseData = courseRes.data;
      if (courseData) setCourse(courseData);

      const [studentsRes, makeupRes, profileRes] = await Promise.all([
        courseData
          ? supabase.from('students').select('id, full_name, student_code, academic_year, section, is_active').eq('academic_year', courseData.academic_year).eq('is_active', true)
          : Promise.resolve({ data: [] }),
        courseData?.makeup_students?.length > 0
          ? supabase.from('students').select('id, full_name, student_code, academic_year, section, is_active').in('id', courseData.makeup_students).eq('is_active', true)
          : Promise.resolve({ data: [] }),
        userRes.data?.user
          ? supabase.from('profiles').select('full_name, degree, role').eq('id', userRes.data.user.id).single()
          : Promise.resolve({ data: null }),
      ]);

      const makeupIds = courseData?.makeup_students || [];
      const excluded = courseData?.excluded_students || [];
      const courseSections = Array.isArray(courseData?.sections) && courseData.sections.length > 0 
        ? courseData.sections.map((s: string) => String(s).trim()) 
        : null;

      const allStudents = [...(studentsRes.data || []), ...(makeupRes.data || [])]
        .filter((s: any, index: number, self: any[]) => {
          if (s.is_active === false) return false;
          if (excluded.includes(s.id)) return false;
          if (index !== self.findIndex((t) => t.id === s.id)) return false;
          if (courseSections && !makeupIds.includes(s.id)) {
            const sSec = s.section ? String(s.section).trim() : '';
            if (!courseSections.includes(sSec)) return false;
          }
          return true;
        })
        .sort((a, b) => {
          const secA = parseInt(a.section) || 999;
          const secB = parseInt(b.section) || 999;
          if (secA !== secB) return secA - secB;
          return a.full_name.localeCompare(b.full_name, 'ar');
        });
      
      setStudents(allStudents);

      // Initialize selected sections with all available sections by default
      const uniqueSecs = Array.from(
        new Set(allStudents.map((s: any) => s.section ? String(s.section).trim() : 'تخلفات'))
      ).sort((a: any, b: any) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return a.localeCompare(b, 'ar');
      }) as string[];
      setSelectedSections(uniqueSecs);

      // Instructor Name from profiles table
      if (userRes.data?.user) {
        const profile = profileRes.data;
        if (profile && profile.full_name) {
          setInstructorName(formatInstructorTitle(profile));
        } else {
          setInstructorName(userRes.data.user.email || "........................");
        }
      }

      // Attendance
      const attData = attRes.data;
      setAttendance(attData || []);

      // Projects
      const projData = courseData?.custom_week_names?.__projects__ || [];
      setProjects(projData);

      // Evaluations
      const evalData = evalRes.data;
      setEvaluations(evalData || []);

      // Generate Weeks List based on official term start date from system_settings
      if (courseData) {
        const systemTerms = systemTermsRes.data;

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
    } catch (err) {
      console.error("Error fetching reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Format Student Name with badges (Teacher eyes only: ⭐ Distinguished / ⚠️ Uncommitted / [تخلفات] Makeup)
  const formatStudentNameWithBadges = (s: any) => {
    const tag = getStudentTag(s, course?.teacher_id);
    const isMakeup = s.section === 'تخلفات' || (!s.section && course?.makeup_students?.includes(s.id)) || (course?.makeup_students && course.makeup_students.includes(s.id));
    let badgeMarker = '';
    if (tag === 'distinguished') {
      badgeMarker = ' <span style="color: #b45309; font-size: 11px;" title="طالب متميز">⭐</span>';
    } else if (tag === 'uncommitted') {
      badgeMarker = ' <span style="color: #b91c1c; font-size: 11px;" title="طالب غير ملتزم">⚠️</span>';
    }
    if (isMakeup && s.section !== 'تخلفات') {
      badgeMarker += ' <span style="color: #0284c7; font-size: 9px; font-weight: bold;">[تخلفات]</span>';
    }
    return `${s.full_name}${badgeMarker}`;
  };

  // --- Report 1: Detailed Attendance (Landscape & Partitioned or Compact by Section) ---
  const printDetailedAttendance = async () => {
    const termInfo = await getTermAndWeekInfo();

    if (selectedSections.length === 0) {
      alert("يرجى تحديد سكشن واحد على الأقل لطباعة الكشف.");
      return;
    }

    // 1. Filter students by selected sections
    const targetStudents = students.filter(s => {
      const secKey = s.section ? String(s.section).trim() : "تخلفات";
      return selectedSections.includes(secKey);
    });

    if (!targetStudents || targetStudents.length === 0) {
      alert("لا يوجد طلاب مسجلين في السكاشن المحددة للطباعة.");
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

    let allSectionsHtml = '';

    if (paperSavingMode) {
      // ==========================================
      // وضع توفير الورق الذكي (Compact Continuous Table)
      // ==========================================
      const sectionsLabel = sortedSecKeys.map(k => k === 'تخلفات' ? 'تخلفات' : `سكشن ${k}`).join(' ، ');

      let tableBodyHtml = '';
      sortedSecKeys.forEach((secKey) => {
        const secStudents = sectionsMap.get(secKey)!;
        secStudents.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
        const secTitleBadge = secKey === 'تخلفات' ? 'طلاب الباقين للإعادة / التخلفات' : `سكشن (${secKey})`;

        // Section header banner row inside the table
        tableBodyHtml += `
          <tr class="sec-header-row" style="page-break-after: avoid; page-break-inside: avoid;">
            <td colspan="${weeks.length + 4}" style="background-color: #0f172a !important; color: #ffffff !important; font-weight: bold; font-size: 11px; padding: 4px 10px; text-align: right; border: 1.5px solid #000 !important;">
              🔰 ${secTitleBadge} &nbsp;&mdash;&nbsp; إجمالي طلاب السكشن: <b>${secStudents.length} طالب</b>
            </td>
          </tr>
        `;

        secStudents.forEach((s, idx) => {
          let rowHtml = `
            <tr style="page-break-inside: avoid;">
              <td style="width: 28px; text-align: center; font-weight: bold; font-size: 10.5px; background-color: #fafafa !important;">${idx + 1}</td>
              <td style="text-align: right; font-weight: bold; white-space: nowrap; padding-right: 6px; font-size: 11px; color: #000;">
                ${formatStudentNameWithBadges(s)}
              </td>
          `;

          let presentCount = 0;
          let excuseCount = 0;

          weeks.forEach(w => {
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
                excuseCount++;
                rowHtml += `
                  <td style="background-color: #f8d7da !important; color: #842029 !important; border: 1px solid #dc3545 !important; padding: 2.5px 1px;">
                    <div style="font-size: 10px; font-weight: bold; line-height: 1.1;">عذر</div>
                    <div style="font-size: 8px; line-height: 1.1; margin-top: 1px; max-width: 80px; margin-left: auto; margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${att.note || ''}">${att.note || 'غياب بعذر'}</div>
                    <div style="font-size: 7.5px; opacity: 0.85; margin-top: 1px;">${actualDate}</div>
                  </td>
                `;
              } else {
                presentCount++;
                rowHtml += `
                  <td style="background-color: #d1e7dd !important; color: #0f5132 !important; border: 1px solid #198754 !important; padding: 2.5px 1px;">
                    <div style="font-size: 10px; font-weight: bold; line-height: 1.1;">${actualDate}</div>
                    <div style="font-size: 8px; font-weight: 600; color: #155724; margin-top: 1px;">حاضر</div>
                  </td>
                `;
              }
            } else {
              rowHtml += `
                <td style="background-color: #ffffff !important; border: 1px solid #000000 !important; color: #94a3b8; font-size: 11px;">
                  -
                </td>
              `;
            }
          });

          const effectiveWeeks = weeks.length || 1;
          const rate = Math.round((presentCount / effectiveWeeks) * 100);

          rowHtml += `
              <td style="font-weight: bold; font-size: 10.5px; background-color: #f8fafc !important; text-align: center; border: 1px solid #000 !important;">
                ${presentCount}/${weeks.length}
              </td>
              <td style="font-weight: bold; font-size: 10px; text-align: center; border: 1px solid #000 !important; color: ${rate >= 75 ? '#0f5132' : rate >= 50 ? '#856404' : '#842029'} !important; background-color: ${rate >= 75 ? '#d1e7dd' : rate >= 50 ? '#fff3cd' : '#f8d7da'} !important;">
                ${rate}%
              </td>
            </tr>
          `;

          tableBodyHtml += rowHtml;
        });
      });

      allSectionsHtml = `
        <style>
          @media print {
            @page {
              size: landscape;
              margin: 7mm 6mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: #fff !important;
            }
            .att-table {
              page-break-inside: auto;
            }
            .att-table tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
          .att-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
            margin-bottom: 5px;
            table-layout: auto;
            border: 1.5px solid #000 !important;
          }
          .att-table thead {
            display: table-header-group;
          }
          .att-table tr {
            page-break-inside: avoid;
          }
          .att-table th, .att-table td {
            border: 1px solid #000 !important;
            padding: 2.5px 2px;
            text-align: center;
            vertical-align: middle;
            box-sizing: border-box;
          }
          .att-table th {
            background-color: #f1f5f9 !important;
            font-weight: bold;
            font-size: 10px;
          }
        </style>

        <!-- الترويسة الرسمية الموحدة -->
        <div class="report-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; font-weight: bold; font-size: 12.5px; line-height: 1.4; border-bottom: 2px solid #000; padding-bottom: 6px; padding-top: 2px;">
          <div style="text-align: right; width: 28%;">
            جامعة قنا<br/>
            كلية التربية النوعية<br/>
            قسم التربية الفنية
          </div>
          <div style="text-align: center; width: 44%;">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 2px;">كشف الحضور والغياب التفصيلي</div>
            <div style="font-size: 12px; color: #222; font-weight: bold;">
              مقرر: ${course?.name || ''} &nbsp;|&nbsp; الفرقة: ${course?.academic_year || ''}
            </div>
            <div style="margin-top: 4px;">
              <span style="background: #0f172a; color: #ffffff; padding: 2px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; display: inline-block;">
                السكاشن: ${sectionsLabel}
              </span>
            </div>
          </div>
          <div style="text-align: left; width: 28%; font-size: 12px; line-height: 1.4;">
            أستاذ المقرر: <b>${instructorName}</b><br/>
            ${termInfo ? `<span style="font-size: 10.5px; color: #444;">${termInfo}</span><br/>` : ''}
            <span style="font-size: 11px; color: #000;">إجمالي الطلاب بالكشف: <b>${targetStudents.length} طالب</b></span>
          </div>
        </div>

        <!-- جدول الحضور الشامل الموفر للورق -->
        <table class="att-table">
          <thead>
            <tr>
              <th style="width: 28px; text-align: center; font-size: 10.5px;">م</th>
              <th style="min-width: 140px; text-align: right; font-size: 10.5px; padding-right: 6px;">اسم الطالب</th>
              ${weeks.map(w => `
                <th style="text-align: center; vertical-align: middle; padding: 3px 2px;">
                  <div style="font-weight: bold; font-size: 9.5px; white-space: nowrap;">${w.name}</div>
                  <div style="font-size: 7.5px; font-weight: normal; color: #333; margin-top: 1px; white-space: nowrap;">${w.subtitle}</div>
                </th>
              `).join('')}
              <th style="width: 38px; text-align: center; vertical-align: middle; padding: 3px 2px; font-size: 9.5px;">
                <div>إجمالي</div><div>الحضور</div>
              </th>
              <th style="width: 38px; text-align: center; vertical-align: middle; padding: 3px 2px; font-size: 9.5px;">
                <div>النسبة</div><div>%</div>
              </th>
            </tr>
          </thead>
          <tbody>
            ${tableBodyHtml}
          </tbody>
        </table>

        <!-- التوقيعات وتذييل التقرير -->
        <div style="margin-top: 12px; padding-top: 6px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: bold; padding: 0 30px; margin-bottom: 8px;">
            <div>توقيع أستاذ المادة: .................................</div>
            <div>توقيع رئيس القسم: .................................</div>
            <div>عميد الكلية: .................................</div>
          </div>
          <div class="page-footer" style="font-size: 9.5px; text-align: center; color: #555; border-top: 1px dashed #aaa; padding-top: 4px;">
            تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} &nbsp;&nbsp;|&nbsp;&nbsp; منظومة قسم التربية الفنية &nbsp;&nbsp;|&nbsp;&nbsp; مبرمج ومطور النظام: <span style="font-size: 10.5px; color: #000; font-weight: bold;">إسلام عبداللطيف</span>
          </div>
        </div>
      `;
    } else {
      // ==========================================
      // وضع الفصل (Per-Section Sheets with Compact Fitting)
      // ==========================================
      allSectionsHtml = `
        <style>
          @media print {
            @page {
              size: landscape;
              margin: 7mm 6mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: #fff !important;
            }
            .section-sheet {
              page-break-after: always;
              break-after: page;
            }
          }
          .att-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
            margin-bottom: 5px;
            table-layout: auto;
            border: 1.5px solid #000 !important;
          }
          .att-table thead {
            display: table-header-group;
          }
          .att-table tr {
            page-break-inside: avoid;
          }
          .att-table th, .att-table td {
            border: 1px solid #000 !important;
            padding: 2.5px 2px;
            text-align: center;
            vertical-align: middle;
            box-sizing: border-box;
          }
          .att-table th {
            background-color: #f1f5f9 !important;
            font-weight: bold;
            font-size: 10px;
          }
          .section-sheet {
            box-sizing: border-box;
            width: 100%;
          }
        </style>
      `;

      sortedSecKeys.forEach((secKey, secIdx) => {
        const secStudents = sectionsMap.get(secKey)!;
        secStudents.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
        const secTitleBadge = secKey === 'تخلفات' ? 'طلاب الباقين للإعادة / التخلفات' : `سكشن (${secKey})`;

        let tableRows = '';
        secStudents.forEach((s, idx) => {
          let rowHtml = `
            <tr style="page-break-inside: avoid;">
              <td style="width: 28px; text-align: center; font-weight: bold; font-size: 10.5px; background-color: #fafafa !important;">${idx + 1}</td>
              <td style="text-align: right; font-weight: bold; white-space: nowrap; padding-right: 6px; font-size: 11px; color: #000;">
                ${formatStudentNameWithBadges(s)}
              </td>
          `;

          let presentCount = 0;
          let excuseCount = 0;

          weeks.forEach(w => {
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
                excuseCount++;
                rowHtml += `
                  <td style="background-color: #f8d7da !important; color: #842029 !important; border: 1px solid #dc3545 !important; padding: 2.5px 1px;">
                    <div style="font-size: 10px; font-weight: bold; line-height: 1.1;">عذر</div>
                    <div style="font-size: 8px; line-height: 1.1; margin-top: 1px; max-width: 80px; margin-left: auto; margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${att.note || ''}">${att.note || 'غياب بعذر'}</div>
                    <div style="font-size: 7.5px; opacity: 0.85; margin-top: 1px;">${actualDate}</div>
                  </td>
                `;
              } else {
                presentCount++;
                rowHtml += `
                  <td style="background-color: #d1e7dd !important; color: #0f5132 !important; border: 1px solid #198754 !important; padding: 2.5px 1px;">
                    <div style="font-size: 10px; font-weight: bold; line-height: 1.1;">${actualDate}</div>
                    <div style="font-size: 8px; font-weight: 600; color: #155724; margin-top: 1px;">حاضر</div>
                  </td>
                `;
              }
            } else {
              rowHtml += `
                <td style="background-color: #ffffff !important; border: 1px solid #000000 !important; color: #94a3b8; font-size: 11px;">
                  -
                </td>
              `;
            }
          });

          const effectiveWeeks = weeks.length || 1;
          const rate = Math.round((presentCount / effectiveWeeks) * 100);

          rowHtml += `
              <td style="font-weight: bold; font-size: 10.5px; background-color: #f8fafc !important; text-align: center; border: 1px solid #000 !important;">
                ${presentCount}/${weeks.length}
              </td>
              <td style="font-weight: bold; font-size: 10px; text-align: center; border: 1px solid #000 !important; color: ${rate >= 75 ? '#0f5132' : rate >= 50 ? '#856404' : '#842029'} !important; background-color: ${rate >= 75 ? '#d1e7dd' : rate >= 50 ? '#fff3cd' : '#f8d7da'} !important;">
                ${rate}%
              </td>
            </tr>
          `;

          tableRows += rowHtml;
        });

        const isLast = secIdx === sortedSecKeys.length - 1;

        allSectionsHtml += `
          <div class="section-sheet" style="${!isLast ? 'page-break-after: always; break-after: page;' : ''}">
            <!-- الترويسة الرسمية للسكشن -->
            <div class="report-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; font-weight: bold; font-size: 12.5px; line-height: 1.4; border-bottom: 2px solid #000; padding-bottom: 6px; padding-top: 2px;">
              <div style="text-align: right; width: 28%;">
                جامعة قنا<br/>
                كلية التربية النوعية<br/>
                قسم التربية الفنية
              </div>
              <div style="text-align: center; width: 44%;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 2px;">كشف الحضور والغياب التفصيلي</div>
                <div style="font-size: 12px; color: #222; font-weight: bold;">
                  مقرر: ${course?.name || ''} &nbsp;|&nbsp; الفرقة: ${course?.academic_year || ''}
                </div>
                <div style="margin-top: 4px;">
                  <span style="background: #0f172a; color: #ffffff; padding: 2px 16px; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block;">
                    ${secTitleBadge}
                  </span>
                </div>
              </div>
              <div style="text-align: left; width: 28%; font-size: 12px; line-height: 1.4;">
                أستاذ المقرر: <b>${instructorName}</b><br/>
                ${termInfo ? `<span style="font-size: 10.5px; color: #444;">${termInfo}</span><br/>` : ''}
                <span style="font-size: 11px; color: #000;">إجمالي طلاب السكشن: <b>${secStudents.length} طالب</b></span>
              </div>
            </div>

            <!-- جدول الحضور التفصيلي الخاص بالسكشن -->
            <table class="att-table">
              <thead>
                <tr>
                  <th style="width: 28px; text-align: center; font-size: 10.5px;">م</th>
                  <th style="min-width: 140px; text-align: right; font-size: 10.5px; padding-right: 6px;">اسم الطالب</th>
                  ${weeks.map(w => `
                    <th style="text-align: center; vertical-align: middle; padding: 3px 2px;">
                      <div style="font-weight: bold; font-size: 9.5px; white-space: nowrap;">${w.name}</div>
                      <div style="font-size: 7.5px; font-weight: normal; color: #333; margin-top: 1px; white-space: nowrap;">${w.subtitle}</div>
                    </th>
                  `).join('')}
                  <th style="width: 38px; text-align: center; vertical-align: middle; padding: 3px 2px; font-size: 9.5px;">
                    <div>إجمالي</div><div>الحضور</div>
                  </th>
                  <th style="width: 38px; text-align: center; vertical-align: middle; padding: 3px 2px; font-size: 9.5px;">
                    <div>النسبة</div><div>%</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <!-- التوقيعات وتذييل السكشن -->
            <div style="margin-top: 12px; padding-top: 6px; page-break-inside: avoid;">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: bold; padding: 0 30px; margin-bottom: 8px;">
                <div>توقيع أستاذ المادة: .................................</div>
                <div>توقيع رئيس القسم: .................................</div>
                <div>عميد الكلية: .................................</div>
              </div>
              <div class="page-footer" style="font-size: 9.5px; text-align: center; color: #555; border-top: 1px dashed #aaa; padding-top: 4px;">
                تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} &nbsp;&nbsp;|&nbsp;&nbsp; منظومة قسم التربية الفنية &nbsp;&nbsp;|&nbsp;&nbsp; مبرمج ومطور النظام: <span style="font-size: 10.5px; color: #000; font-weight: bold;">إسلام عبداللطيف</span>
              </div>
            </div>
          </div>
          ${!isLast ? '<div class="html2pdf__page-break" style="page-break-after: always; break-after: page;"></div>' : ''}
        `;
      });
    }

    const filename = selectedSections.length === availableSections.length
      ? `${course?.name || 'course'}_attendance_all_sections.pdf`
      : selectedSections.length === 1
        ? `${course?.name || 'course'}_attendance_section_${selectedSections[0]}.pdf`
        : `${course?.name || 'course'}_attendance_sections_${selectedSections.join('_')}.pdf`;

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
    const proj = projects.find(p => p.id === selectedProjectId);
    const projectEvals = evaluations.filter(e => 
      (e.project_id && e.project_id === selectedProjectId) ||
      (proj && (e.project_name === proj.name || (e.project_name && proj.name && e.project_name.trim() === proj.name.trim())))
    );
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
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${formatStudentNameWithBadges(s)}</td><td>${s.section || 'تخلفات'}</td><td>لم يقيم</td></tr>`;
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
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${formatStudentNameWithBadges(s)}</td><td>${s.section || 'تخلفات'}</td><td><strong>${ev?.score || 0}</strong> / ${proj?.max_score}</td></tr>`;
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
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${formatStudentNameWithBadges(s)}</td><td>${s.section || 'تخلفات'}</td><td>لم يقدم أي مشروع</td></tr>`;
    });
    const tableHtml = `<table><thead><tr><th style="width: 50px;">م</th><th>اسم الطالب</th><th style="width: 100px;">السكشن</th><th style="width: 150px;">الحالة</th></tr></thead><tbody>${tableRows}</tbody></table>`;
    await downloadPdf("report.pdf", course?.name || "", "كشف الطلاب المحرومين", "الطلاب الذين لم يقدموا أو يُقيّموا في أي مشروع نهائياً.", tableHtml, instructorName);
  };

  const printAllProjectsEvaluated = async () => {
    const termInfo = await getTermAndWeekInfo();
    const { evaluatedSomehow } = getAllProjectsStats();
    let tableRows = '';
    evaluatedSomehow.forEach((s, i) => {
      tableRows += `<tr><td>${i + 1}</td><td style="text-align: right;">${formatStudentNameWithBadges(s)}</td><td>${s.section || 'تخلفات'}</td><td><strong>${s.evalCount}</strong> مشاريع</td></tr>`;
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
      let rowHtml = `<tr><td>${i + 1}</td><td style="text-align: right; white-space: nowrap;">${formatStudentNameWithBadges(s)}</td><td><strong>${presences}</strong></td>`;
      
      let totalRawScore = 0;
      sortedProjects.forEach(p => {
        const ev = evaluations.find(e => e.student_id === s.id && (
          (e.project_id && e.project_id === p.id) ||
          (e.project_name === p.name || (e.project_name && p.name && e.project_name.trim() === p.name.trim()))
        ));
        const score = ev && ev.score !== null && ev.score !== undefined ? ev.score : 0;
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
      
      let rowHtml = `<tr><td>${i + 1}</td><td style="text-align: right;">${formatStudentNameWithBadges(s)}</td>`;
      rowHtml += `<td><strong>${presences}</strong></td>`;
      
      let attScoreStr = attendanceScoreRaw;
      if (roundingMethod === 'integer') attScoreStr = Math.round(attendanceScoreRaw);
      else if (roundingMethod === 'decimal') attScoreStr = Math.round(attendanceScoreRaw * 10) / 10;
      
      rowHtml += `<td>${attScoreStr}</td>`;

      let totalProjectsScore = 0;
      sortedProjects.forEach(p => {
        const ev = evaluations.find(e => e.student_id === s.id && (
          (e.project_id && e.project_id === p.id) ||
          (e.project_name === p.name || (e.project_name && p.name && e.project_name.trim() === p.name.trim()))
        ));
        const rawScore = ev && ev.score !== null && ev.score !== undefined ? ev.score : 0;
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

  useEffect(() => {
    if (availableSections.length > 0 && selectedSections.length === 0) {
      setSelectedSections(availableSections);
    }
  }, [availableSections.length]);

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

            {/* Multi-Section Selection Box */}
            <div style={{ background: "#1e1e1e", padding: "18px 20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", color: "#e2e8f0", fontSize: "14px", fontWeight: "bold" }}>
                    🗂️ تحديد السكاشن للطباعة (تحديد متعدد):
                  </label>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    انقر على أي سكشن لاختياره أو استبعاده من التقرير (يمكنك تحديد سكشنين أو أكثر)
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedSections([...availableSections])}
                    style={{
                      background: "#334155",
                      color: "#38bdf8",
                      border: "1px solid #475569",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      transition: "all 0.2s"
                    }}
                  >
                    ✓ تحديد الكل ({availableSections.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSections([])}
                    style={{
                      background: "#334155",
                      color: "#f87171",
                      border: "1px solid #475569",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      transition: "all 0.2s"
                    }}
                  >
                    ✕ إلغاء التحديد
                  </button>
                </div>
              </div>

              {/* Sections Grid Selection */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", marginTop: "14px" }}>
                {availableSections.map(sec => {
                  const secCount = students.filter(s => (s.section ? String(s.section).trim() : 'تخلفات') === sec).length;
                  const isChecked = selectedSections.includes(sec);
                  return (
                    <div
                      key={sec}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedSections(selectedSections.filter(x => x !== sec));
                        } else {
                          setSelectedSections([...selectedSections, sec]);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        background: isChecked ? "rgba(76, 175, 80, 0.16)" : "#262626",
                        border: isChecked ? "2px solid #4CAF50" : "1px solid #444",
                        cursor: "pointer",
                        userSelect: "none",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        style={{ width: "17px", height: "17px", accentColor: "#4CAF50", cursor: "pointer" }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontSize: "13px", fontWeight: "bold", color: isChecked ? "#4CAF50" : "#eee", whiteSpace: "nowrap" }}>
                          {sec === 'تخلفات' ? 'تخلفات' : `سكشن ${sec}`}
                        </span>
                        <span style={{ fontSize: "11px", color: isChecked ? "#a5d6a7" : "#888" }}>
                          {secCount} طالب
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status Message */}
              <div style={{ marginTop: "14px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ color: "#aaa" }}>
                  السكاشن المحددة: <b style={{ color: selectedSections.length > 0 ? "#4CAF50" : "#f87171" }}>{selectedSections.length} من أصل {availableSections.length}</b>
                </span>
                <span style={{ color: "#aaa" }}>
                  إجمالي طلاب السكاشن المحددة: <b style={{ color: "#38bdf8" }}>{students.filter(s => selectedSections.includes(s.section ? String(s.section).trim() : 'تخلفات')).length} طالب</b>
                </span>
              </div>
            </div>

            {/* Paper Saving & Print Mode Options */}
            <div style={{ background: "#1e1e1e", padding: "16px 20px", borderRadius: "15px", border: "1px solid #333", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", color: "#e2e8f0", fontSize: "14px", fontWeight: "bold" }}>
                    📄 خيارات توفير الورق وتخطيط الطباعة:
                  </label>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    اختر النمط المناسب لتقليل عدد الأوراق المطبوعة وضمان عدم تقطيع الجداول
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setPaperSavingMode(true)}
                    style={{
                      background: paperSavingMode ? "#059669" : "#262626",
                      color: paperSavingMode ? "#fff" : "#94a3b8",
                      border: paperSavingMode ? "2px solid #10b981" : "1px solid #444",
                      padding: "7px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span>🌱</span> توفير الورق الذكي (مُوصى به)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSavingMode(false)}
                    style={{
                      background: !paperSavingMode ? "#2563eb" : "#262626",
                      color: !paperSavingMode ? "#fff" : "#94a3b8",
                      border: !paperSavingMode ? "2px solid #3b82f6" : "1px solid #444",
                      padding: "7px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span>📑</span> سكشن منفصل لكل ورقة
                  </button>
                </div>
              </div>

              <div style={{ padding: "10px 14px", background: paperSavingMode ? "rgba(16, 185, 129, 0.1)" : "rgba(59, 130, 246, 0.1)", borderRadius: "8px", borderRight: paperSavingMode ? "3px solid #10b981" : "3px solid #3b82f6" }}>
                <p style={{ margin: 0, fontSize: "12.5px", color: paperSavingMode ? "#6ee7b7" : "#93c5fd", lineHeight: "1.5" }}>
                  {paperSavingMode
                    ? "✓ وضع توفير الورق الذكي نشط: يدمج السكاشن المحددة في تدفق مستمر ويضغط المسافات وحجم الخطوط بحيث تتسع الورقة الواحدة حتى 30-35 طالباً، مما يخفض عدد الأوراق المطبوعة لأكثر من النصف ويمنع وجود أوراق شبه فارغة."
                    : "• وضع الفصل نشط: يطبع كل سكشن في صفحة منفصلة خاصة به مع ترويسته وتوقيعاته المستقلة، مع المحافظة على التنسيق المضغوط لمنع انشطار السكشن الواحد."}
                </p>
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
                <span style={{ color: selectedSections.length > 0 ? "#4CAF50" : "#f87171", fontWeight: "bold" }}>
                  {students.filter(s => selectedSections.includes(s.section ? String(s.section).trim() : 'تخلفات')).length} طالب
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ color: "#aaa" }}>تخطيط الصفحة:</span>
                <span style={{ color: "#38bdf8", fontWeight: "bold" }}>أفقي بالعرض (Landscape) - A4</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#aaa" }}>نمط استهلاك الورق:</span>
                <span style={{ color: paperSavingMode ? "#34d399" : "#60a5fa", fontWeight: "bold" }}>
                  {paperSavingMode ? "🌱 توفير الورق الذكي (مدمج ومكثف)" : "📑 سكشن مستقل لكل ورقة"}
                </span>
              </div>
            </div>

            {selectedSections.length === 0 && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "10px", padding: "12px", color: "#fca5a5", fontSize: "14px", marginBottom: "15px", textAlign: "center", fontWeight: "bold" }}>
                ⚠️ يرجى تحديد سكشن واحد على الأقل من القائمة أعلاه لتتمكن من إنشاء التقرير.
              </div>
            )}

            <button 
              onClick={printDetailedAttendance} 
              disabled={selectedSections.length === 0}
              style={{ 
                width: "100%", 
                background: selectedSections.length > 0 ? "#4CAF50" : "#555", 
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
                cursor: selectedSections.length > 0 ? "pointer" : "not-allowed",
                boxShadow: selectedSections.length > 0 ? "0 4px 15px rgba(76, 175, 80, 0.3)" : "none",
                opacity: selectedSections.length > 0 ? 1 : 0.6
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
