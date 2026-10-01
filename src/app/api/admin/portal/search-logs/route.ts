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

    // الجهاز يُعتبر مشبوهاً إذا بحث عن طالبين مختلفين أو أكثر بنفس الـ deviceId الفريد
    // (الـ deviceId مخزّن في localStorage — فريد لكل جهاز/متصفح)
    // الاستثناء: سجلات الأدمن/المنسق لا تُحسب لأنهم يبحثون عن طلاب متعددين بشكل طبيعي

    logs.forEach(log => {
      // استثناء سجلات الأدمن والمنسقين
      const isAdminAction = !!(
        log.details?.is_admin ||
        log.details?.actor_role === 'admin' ||
        log.details?.actor_role === 'coordinator' ||
        log.details?.impersonated_by ||
        log.details?.source === 'admin_portal' ||
        log.details?.source === 'coordinator_portal'
      );

      // نقبل فقط الـ deviceId الحقيقي المُولَّد من localStorage (يبدأ بـ dev_ وطوله ≥ 8)
      // نرفض تماماً أي fallback بالـ User-Agent أو القيم المجهولة
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

    // 3. بناء قائمة الأجهزة المشبوهة: أي جهاز بحث عن طالبين مختلفين أو أكثر = مشبوه
    const suspiciousDevices: any[] = [];
    const devicePrimaryMap = new Map<string, {
      primaryStudent: DeviceStudentInfo;
      otherStudents: DeviceStudentInfo[];
      studentsList: DeviceStudentInfo[];
    }>();

    deviceTrackingMap.forEach((entry, devId) => {
      const studentsList = Array.from(entry.studentsMap.values());

      // جهاز بحث عن طالب واحد فقط = طبيعي
      if (studentsList.length < 2) return;

      // ترتيب تصاعدي زمني: الأسبق = صاحب الهاتف
      studentsList.sort((a, b) => new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime());

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
        suspicionReason: `بحث عن ${studentsList.length} طلاب مختلفين من نفس الجهاز`,
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
