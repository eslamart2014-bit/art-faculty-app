import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. جلب السجلات من Supabase (البحث، سحب الكارت، الاستعلام)
    let logs: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('portal_audit_logs')
        .select('*')
        .in('action', ['student_search', 'download_card', 'view_card', 'student_lookup'])
        .order('created_at', { ascending: false })
        .limit(1000);
      logs = data || [];
    } catch (dbErr) {
      console.warn('Failed fetching logs from Supabase:', dbErr);
    }

    // دمج السجلات المحلية إن وجدت
    try {
      const localLogs = (localStore.getAuditLogs('') || [])
        .filter((l: any) => ['student_search', 'download_card', 'view_card', 'student_lookup'].includes(l.action));
      
      const existingIds = new Set(logs.map(l => l.id || `${l.student_code}_${l.created_at}`));
      localLogs.forEach((ll: any) => {
        const key = ll.id || `${ll.student_code}_${ll.created_at}`;
        if (!existingIds.has(key)) {
          logs.push(ll);
        }
      });
    } catch (e) {}

    // ترتيب السجلات تنازلياً بالأحدث
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 2. تحليل الأجهزة واكتشاف من بحث عن أكثر من طالب من نفس الموبايل
    // تتبع الطلاب وتواريخ ظهورهم على كل جهاز لتحديد صاحب الهاتف الأصلي (الأسبق زمنياً)
    interface DeviceStudentInfo {
      student_code: string;
      student_name: string;
      academic_year: string;
      section: string;
      firstSeenAt: string;
      lastSeenAt: string;
      count: number;
    }

    interface DeviceTrackingEntry {
      deviceId: string;
      userAgent: string;
      lastSeen: string;
      studentsMap: Map<string, DeviceStudentInfo>;
    }

    const deviceTrackingMap = new Map<string, DeviceTrackingEntry>();

    let totalSearches = 0;
    const qrDownloadedStudentCodes = new Set<string>();
    let totalQrDownloads = 0;

    // ضوابط الشك الذكي:
    // الجهاز يُعتبر مشبوهاً إذا:
    //   - بحث عن 3 طلاب مختلفين أو أكثر خلال 72 ساعة (3 أيام)، أو
    //   - بحث عن 5 طلاب مختلفين أو أكثر في أي وقت
    // الاستثناءات: السجلات الصادرة من المنسق/الأدمن (is_admin أو actor_role) لا تُحسب
    const SUSPICIOUS_MIN_STUDENTS_SHORT = 3;   // حد الخطر قصير المدى (72 ساعة)
    const SUSPICIOUS_WINDOW_HOURS = 72;         // نافذة الوقت بالساعات
    const SUSPICIOUS_MIN_STUDENTS_TOTAL = 5;   // حد الخطر الإجمالي (أي وقت)

    logs.forEach(log => {
      // استثناء سجلات الأدمن والمنسقين — هم يتصفحون حسابات متعددة بشكل طبيعي
      const isAdminAction = !!(
        log.details?.is_admin ||
        log.details?.actor_role === 'admin' ||
        log.details?.actor_role === 'coordinator' ||
        log.details?.impersonated_by ||
        log.details?.source === 'admin_portal' ||
        log.details?.source === 'coordinator_portal'
      );

      // التحقق الصارم من أن معرّف الجهاز حقيقي ومميز (مثل dev_XXXXX)
      const rawDevId = log.device_id;
      const isValidDevId = rawDevId &&
        rawDevId !== 'unknown_device' &&
        rawDevId !== 'server' &&
        rawDevId !== 'unknown' &&
        !rawDevId.startsWith('ua_') &&
        rawDevId.length >= 8;

      const devId = isValidDevId ? rawDevId : null;

      const sCode = log.student_code && !log.student_code.startsWith('query:') ? String(log.student_code).trim() : null;
      const sName = log.details?.student_name || null;

      if (log.action === 'student_search' || log.action === 'student_lookup') {
        totalSearches++;
      } else if (log.action === 'download_card') {
        totalQrDownloads++;
        if (sCode) qrDownloadedStudentCodes.add(sCode);
      }

      // لا نتتبع سجلات الأدمن أو السجلات بدون معرّف جهاز صالح أو كود طالب
      if (isAdminAction || !devId || !sCode) return;

      if (!deviceTrackingMap.has(devId)) {
        deviceTrackingMap.set(devId, {
          deviceId: devId,
          userAgent: log.user_agent || '',
          lastSeen: log.created_at,
          studentsMap: new Map<string, DeviceStudentInfo>()
        });
      }
      const devEntry = deviceTrackingMap.get(devId)!;
      if (!devEntry.userAgent && log.user_agent) devEntry.userAgent = log.user_agent;
      if (new Date(log.created_at).getTime() > new Date(devEntry.lastSeen).getTime()) {
        devEntry.lastSeen = log.created_at;
      }

      const logTime = log.created_at;
      if (!devEntry.studentsMap.has(sCode)) {
        devEntry.studentsMap.set(sCode, {
          student_code: sCode,
          student_name: sName || 'طالب غير محدد',
          academic_year: log.details?.academic_year || 'غير محدد',
          section: log.details?.section || 'عام',
          firstSeenAt: logTime,
          lastSeenAt: logTime,
          count: 1
        });
      } else {
        const st = devEntry.studentsMap.get(sCode)!;
        if (new Date(logTime).getTime() < new Date(st.firstSeenAt).getTime()) {
          st.firstSeenAt = logTime;
        }
        if (new Date(logTime).getTime() > new Date(st.lastSeenAt).getTime()) {
          st.lastSeenAt = logTime;
        }
        if (sName && (!st.student_name || st.student_name === 'طالب غير محدد')) {
          st.student_name = sName;
        }
        if (log.details?.academic_year && st.academic_year === 'غير محدد') {
          st.academic_year = log.details.academic_year;
        }
        if (log.details?.section && st.section === 'عام') {
          st.section = log.details.section;
        }
        st.count++;
      }
    });

    // 3. بناء قائمة الأجهزة المشبوهة وتحديد صاحب الجهاز الأصلي (الباحث الأول زمنياً)
    const suspiciousDevices: any[] = [];
    const devicePrimaryMap = new Map<string, {
      primaryStudent: DeviceStudentInfo;
      otherStudents: DeviceStudentInfo[];
      studentsList: DeviceStudentInfo[];
    }>();

    deviceTrackingMap.forEach((entry, devId) => {
      const studentsList = Array.from(entry.studentsMap.values());

      if (studentsList.length < 2) return; // جهاز واحد = لا شبهة

      // ترتيب تصاعدي زمني
      studentsList.sort((a, b) => new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime());

      // ✅ تطبيق ضوابط الشك الذكية:
      // الحالة 1: 5 طلاب أو أكثر في أي وقت = مشبوه بالتأكيد
      const isSuspiciousTotal = studentsList.length >= SUSPICIOUS_MIN_STUDENTS_TOTAL;

      // الحالة 2: 3 طلاب أو أكثر خلال 72 ساعة متتالية
      let isSuspiciousShortWindow = false;
      if (!isSuspiciousTotal && studentsList.length >= SUSPICIOUS_MIN_STUDENTS_SHORT) {
        const windowMs = SUSPICIOUS_WINDOW_HOURS * 60 * 60 * 1000;
        // فحص: هل يوجد 3 طلاب أو أكثر ضمن نافذة 72 ساعة؟
        for (let i = 0; i <= studentsList.length - SUSPICIOUS_MIN_STUDENTS_SHORT; i++) {
          const windowStart = new Date(studentsList[i].firstSeenAt).getTime();
          const windowEnd = windowStart + windowMs;
          let countInWindow = 0;
          for (const st of studentsList) {
            const t = new Date(st.firstSeenAt).getTime();
            if (t >= windowStart && t <= windowEnd) countInWindow++;
          }
          if (countInWindow >= SUSPICIOUS_MIN_STUDENTS_SHORT) {
            isSuspiciousShortWindow = true;
            break;
          }
        }
      }

      if (!isSuspiciousTotal && !isSuspiciousShortWindow) return; // لا شبهة كافية

      const primaryStudent = studentsList[0];
      const otherStudents = studentsList.slice(1);

      devicePrimaryMap.set(devId, {
        primaryStudent,
        otherStudents,
        studentsList
      });

      suspiciousDevices.push({
        deviceId: devId,
        studentCount: studentsList.length,
        suspicionReason: isSuspiciousTotal
          ? `بحث عن ${studentsList.length} طلاب مختلفين`
          : `بحث عن ${SUSPICIOUS_MIN_STUDENTS_SHORT}+ طلاب خلال ${SUSPICIOUS_WINDOW_HOURS} ساعة`,
        primaryStudent: {
          student_code: primaryStudent.student_code,
          student_name: primaryStudent.student_name,
          academic_year: primaryStudent.academic_year,
          section: primaryStudent.section,
          firstSeenAt: primaryStudent.firstSeenAt,
          searchCount: primaryStudent.count
        },
        otherStudents: otherStudents.map(s => ({
          student_code: s.student_code,
          student_name: s.student_name,
          academic_year: s.academic_year,
          section: s.section,
          firstSeenAt: s.firstSeenAt,
          searchCount: s.count
        })),
        studentCodes: studentsList.map(s => s.student_code),
        studentNames: studentsList.map(s => s.student_name),
        lastSeen: entry.lastSeen,
        userAgent: entry.userAgent
      });
    });

    // ترتيب الأجهزة المشبوهة بالأعلى عدداً
    suspiciousDevices.sort((a, b) => b.studentCount - a.studentCount);

    // 4. إثراء كل سجل في القائمة بمعلومات التحذير إذا كان الجهاز مشبوهاً مع عزل صاحب الجهاز الأصلي
    const formattedLogs = logs.map(log => {
      const rawDevId = log.device_id;
      const isValidDevId = rawDevId && 
        rawDevId !== 'unknown_device' && 
        rawDevId !== 'server' && 
        rawDevId !== 'unknown' &&
        !rawDevId.startsWith('ua_') &&
        rawDevId.length >= 8;

      const devId = isValidDevId ? rawDevId : null;
      const pData = devId ? devicePrimaryMap.get(devId) : null;
      const isSuspicious = !!pData;

      const sCode = log.student_code && !log.student_code.startsWith('query:') ? String(log.student_code).trim() : null;

      const isPrimaryOwner = isSuspicious && pData ? sCode === pData.primaryStudent.student_code : false;
      const primaryOwnerName = pData ? pData.primaryStudent.student_name : null;
      const primaryOwnerCode = pData ? pData.primaryStudent.student_code : null;

      const otherStudentsNames = isSuspicious && pData
        ? pData.studentsList.filter(s => s.student_code !== sCode).map(s => s.student_name)
        : [];

      return {
        id: log.id || Math.random().toString(36).substring(7),
        student_code: log.student_code,
        student_name: log.details?.student_name || 'طالب مجهول',
        academic_year: log.details?.academic_year || 'غير محدد',
        section: log.details?.section || 'عام',
        action: log.action,
        query: log.details?.query || null,
        device_id: log.device_id,
        user_agent: log.user_agent,
        ip: log.details?.ip,
        created_at: log.created_at,
        is_suspicious_device: isSuspicious,
        device_searched_count: pData ? pData.studentsList.length : 1,
        is_primary_device_owner: isPrimaryOwner,
        primary_owner_name: primaryOwnerName,
        primary_owner_code: primaryOwnerCode,
        other_students: otherStudentsNames,
        other_students_details: isSuspicious && isPrimaryOwner ? pData.otherStudents : []
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalLogsCount: logs.length,
        totalSearches,
        totalQrDownloads,
        uniqueQrStudentsCount: qrDownloadedStudentCodes.size,
        suspiciousDevicesCount: suspiciousDevices.length,
        primaryOwnersCount: suspiciousDevices.length
      },
      suspiciousDevices,
      logs: formattedLogs
    });
  } catch (err: any) {
    console.error('Error in search logs route:', err);
    return NextResponse.json({
      success: false,
      error: err.message,
      stats: {
        totalLogsCount: 0,
        totalSearches: 0,
        totalQrDownloads: 0,
        uniqueQrStudentsCount: 0,
        suspiciousDevicesCount: 0
      },
      suspiciousDevices: [],
      logs: []
    }, { status: 500 });
  }
}
