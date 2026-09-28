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
        .limit(300);
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
    // خريطة: device_id -> Set of student_codes
    const deviceStudentsMap = new Map<string, { codes: Set<string>; names: Set<string>; lastSeen: string; userAgent: string }>();

    let totalSearches = 0;
    const qrDownloadedStudentCodes = new Set<string>();
    let totalQrDownloads = 0;

    logs.forEach(log => {
      const devId = log.device_id && log.device_id !== 'unknown_device' && log.device_id !== 'server' 
        ? log.device_id 
        : (log.user_agent ? `ua_${log.user_agent.slice(0, 30)}` : 'unknown');

      const sCode = log.student_code && !log.student_code.startsWith('query:') ? log.student_code : null;
      const sName = log.details?.student_name || null;

      if (log.action === 'student_search' || log.action === 'student_lookup') {
        totalSearches++;
      } else if (log.action === 'download_card') {
        totalQrDownloads++;
        if (sCode) qrDownloadedStudentCodes.add(sCode);
      }

      if (devId !== 'unknown' && sCode) {
        if (!deviceStudentsMap.has(devId)) {
          deviceStudentsMap.set(devId, {
            codes: new Set<string>(),
            names: new Set<string>(),
            lastSeen: log.created_at,
            userAgent: log.user_agent || ''
          });
        }
        const devEntry = deviceStudentsMap.get(devId)!;
        devEntry.codes.add(sCode);
        if (sName) devEntry.names.add(sName);
      }
    });

    // 3. بناء قائمة الأجهزة المشبوهة (التي بحثت عن أكثر من طالب)
    const suspiciousDevices: any[] = [];
    deviceStudentsMap.forEach((entry, devId) => {
      if (entry.codes.size > 1) {
        suspiciousDevices.push({
          deviceId: devId,
          studentCount: entry.codes.size,
          studentCodes: Array.from(entry.codes),
          studentNames: Array.from(entry.names),
          lastSeen: entry.lastSeen,
          userAgent: entry.userAgent
        });
      }
    });

    // ترتيب الأجهزة المشبوهة بالأعلى عدداً
    suspiciousDevices.sort((a, b) => b.studentCount - a.studentCount);

    // 4. إثراء كل سجل في القائمة بمعلومات التحذير إذا كان الجهاز مشبوهاً
    const formattedLogs = logs.map(log => {
      const devId = log.device_id && log.device_id !== 'unknown_device' && log.device_id !== 'server' 
        ? log.device_id 
        : (log.user_agent ? `ua_${log.user_agent.slice(0, 30)}` : 'unknown');

      const deviceData = deviceStudentsMap.get(devId);
      const isSuspicious = deviceData ? deviceData.codes.size > 1 : false;
      const otherStudents = deviceData && isSuspicious
        ? Array.from(deviceData.names).filter(n => n !== log.details?.student_name)
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
        device_searched_count: deviceData ? deviceData.codes.size : 1,
        other_students: otherStudents
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalLogsCount: logs.length,
        totalSearches,
        totalQrDownloads,
        uniqueQrStudentsCount: qrDownloadedStudentCodes.size,
        suspiciousDevicesCount: suspiciousDevices.length
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
