import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCoordinator, noStoreJson } from '@/lib/serverAuth';
import { formatStudentCode, getStudentCodeVariants } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';
import { safeUpdateStudentAccounts } from '@/lib/studentAccountHelper';

export const dynamic = 'force-dynamic';

function parseDeviceModel(userAgent: string): string {
  if (!userAgent) return 'هاتف ذكي';
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone')) {
    if (ua.includes('iphone os 18') || ua.includes('iphone os 17')) return 'Apple iPhone (حديث)';
    return 'Apple iPhone';
  }
  if (ua.includes('ipad')) return 'Apple iPad';
  if (ua.includes('samsung') || ua.includes('sm-')) return 'Samsung Galaxy';
  if (ua.includes('redmi') || ua.includes('xiaomi')) return 'Xiaomi / Redmi';
  if (ua.includes('oppo')) return 'Oppo Mobile';
  if (ua.includes('vivo')) return 'Vivo Mobile';
  if (ua.includes('realme')) return 'Realme Mobile';
  if (ua.includes('huawei') || ua.includes('honor')) return 'Huawei / Honor';
  if (ua.includes('artedustudentapp') || ua.includes('wv') || ua.includes('version/')) return 'تطبيق أندرويد (APK)';
  if (ua.includes('android')) return 'هاتف أندرويد';
  if (ua.includes('windows')) return 'كمبيوتر (Windows)';
  if (ua.includes('macintosh')) return 'كمبيوتر (Mac)';
  return 'متصفح هاتف';
}

function parseActionLabel(action: string, details?: any): string {
  if (!action) return 'تصفح البوابة';
  switch (action) {
    case 'login':
    case 'student_login':
      return 'تسجيل دخول للبوابة';
    case 'apk_install':
      return 'تثبيت تطبيق الأندرويد';
    case 'apk_download':
      return 'تحميل ملف التطبيق APK';
    case 'qr_view':
    case 'download_qr':
      return 'استعراض/تحميل بطاقة QR';
    case 'submit_project':
      return 'تسليم عمل فني';
    case 'search':
    case 'search_code':
      return 'بحث واستعلام عن حساب';
    case 'register':
    case 'student_register':
      return 'تسجيل حساب جديد';
    case 'verify_pin':
      return 'تأكيد الرمز السري';
    default:
      return action;
  }
}

export async function GET(request: Request) {
  const guard = await requireCoordinator(request);
  if (!guard.ok) return guard.response;

  try {
    // 1. استعلام متوازي لجلب الطلاب، الحسابات، توكنات التطبيق، وسجلات النشاط
    const [
      { data: studentsList },
      { data: accountsList },
      { data: tokenRows },
      { data: auditLogs }
    ] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, student_code, full_name, academic_year, section, telegram_browser_id, created_at'),
      supabaseAdmin
        .from('student_accounts')
        .select('*'),
      supabaseAdmin
        .from('device_tokens')
        .select('student_code, updated_at'),
      supabaseAdmin
        .from('portal_audit_logs')
        .select('student_code, action, details, created_at')
        .order('created_at', { ascending: false })
        .limit(1500)
    ]);

    // 2. خريطة الطلاب من جدول students
    const studentMap = new Map<string, any>();
    (studentsList || []).forEach((st: any) => {
      if (st.student_code) {
        const clean = formatStudentCode(st.student_code);
        studentMap.set(clean, st);
        studentMap.set(st.student_code, st);
      }
    });

    // 3. خريطة الحسابات (student_accounts مدمجة مع telegram_browser_id)
    const accountsMap = new Map<string, any>();

    (accountsList || []).forEach((acc: any) => {
      if (acc.student_code) {
        const clean = formatStudentCode(acc.student_code);
        accountsMap.set(clean, acc);
        accountsMap.set(acc.student_code, acc);
      }
    });

    // دمج الحسابات من telegram_browser_id للطلاب الذين ليس لديهم سجل في student_accounts
    (studentsList || []).forEach((st: any) => {
      if (st.student_code && st.telegram_browser_id) {
        const clean = formatStudentCode(st.student_code);
        let parsed: any = null;
        try { parsed = JSON.parse(st.telegram_browser_id); } catch {}
        if (parsed) {
          const existing = accountsMap.get(clean) || accountsMap.get(st.student_code);
          if (existing) {
            // دمج الباسورد ورقم الهاتف والأجهزة إن لم تكن متوفرة
            if (!existing.pin_code && parsed.pin_code) existing.pin_code = parsed.pin_code;
            if (!existing.mobile && (parsed.mobile || parsed.phone)) existing.mobile = parsed.mobile || parsed.phone;
            if ((!existing.devices || existing.devices.length === 0) && parsed.devices) existing.devices = parsed.devices;
            if (!existing.bound_device_id && parsed.bound_device_id) existing.bound_device_id = parsed.bound_device_id;
          } else {
            accountsMap.set(clean, {
              student_code: st.student_code,
              full_name: st.full_name,
              pin_code: parsed.pin_code || '',
              mobile: parsed.mobile || parsed.phone || '',
              status: parsed.status || (parsed.is_pin_used ? 'active' : 'pending'),
              devices: parsed.devices || [],
              bound_device_id: parsed.bound_device_id || null,
              created_at: parsed.created_at || st.created_at,
              last_login_at: parsed.last_login_at || null
            });
          }
        }
      }
    });

    // 4. خريطة النشاط الأحدث لكل طالب (من portal_audit_logs)
    const latestActivityMap = new Map<string, any>();
    (auditLogs || []).forEach((log: any) => {
      if (log.student_code) {
        const clean = formatStudentCode(log.student_code);
        if (!latestActivityMap.has(clean)) {
          latestActivityMap.set(clean, log);
        }
      }
    });

    // =========================================================================
    // التاب 1: الطلاب الذين ثبتوا التطبيق (Installed Students)
    // =========================================================================
    const installDateMap = new Map<string, string>();
    (tokenRows || []).forEach((tr: any) => {
      if (tr.student_code) {
        const clean = formatStudentCode(tr.student_code);
        installDateMap.set(clean, tr.updated_at || new Date().toISOString());
      }
    });
    (auditLogs || []).forEach((lg: any) => {
      if (lg.student_code && lg.action === 'apk_install') {
        const clean = formatStudentCode(lg.student_code);
        if (!installDateMap.has(clean)) {
          installDateMap.set(clean, lg.created_at || new Date().toISOString());
        }
      }
    });

    const installedStudents = Array.from(installDateMap.keys()).map((code) => {
      const st = studentMap.get(code) || {};
      const acc = accountsMap.get(code) || localStore.getAccount(code) || {};
      const pin = acc.pin_code || '';
      const phone = acc.mobile || acc.phone || '';

      return {
        student_code: code,
        full_name: st.full_name || acc.full_name || 'طالب مسجل',
        academic_year: st.academic_year || acc.academic_year || '',
        section: st.section || acc.section || '',
        pin_code: pin,
        phone: phone,
        installed_at: installDateMap.get(code) || new Date().toISOString(),
        status: acc.status || 'active',
        is_pin_used: Boolean(acc.is_pin_used || acc.status === 'active')
      };
    }).sort((a, b) => new Date(b.installed_at).getTime() - new Date(a.installed_at).getTime());

    // =========================================================================
    // التاب 2: سجل نشاط الطلاب (آخر ظهور لكل طالب)
    // =========================================================================
    // نجمع جميع الطلاب المسجلين ولهم نشاط
    const activityStudents: any[] = [];
    const seenActivityCodes = new Set<string>();

    // أولاً من سجلات الأوديت
    latestActivityMap.forEach((log, code) => {
      seenActivityCodes.add(code);
      const st = studentMap.get(code) || {};
      const acc = accountsMap.get(code) || localStore.getAccount(code) || {};
      const details = log.details || {};
      const userAgent = details?.userAgent || (acc.devices?.[0]?.userAgent) || '';
      const platform = details?.platform === 'apk' || userAgent.includes('ArtEduStudentApp')
        ? 'تطبيق أندرويد (APK)'
        : userAgent.includes('iPhone')
          ? 'آيفون (iOS Safari)'
          : userAgent.includes('Android')
            ? 'متصفح أندرويد'
            : 'متصفح الويب';

      activityStudents.push({
        student_code: code,
        full_name: st.full_name || acc.full_name || 'طالب',
        academic_year: st.academic_year || acc.academic_year || '',
        section: st.section || acc.section || '',
        pin_code: acc.pin_code || '',
        phone: acc.mobile || acc.phone || '',
        last_seen: log.created_at,
        last_action: parseActionLabel(log.action, details),
        platform: platform,
        status: acc.status || 'active'
      });
    });

    // إضافة بقية الطلاب المسجلين بحساباتهم إن لم يظهروا في الأوديت
    accountsMap.forEach((acc, code) => {
      const clean = formatStudentCode(code);
      if (!seenActivityCodes.has(clean) && acc.last_login_at) {
        seenActivityCodes.add(clean);
        const st = studentMap.get(clean) || {};
        activityStudents.push({
          student_code: clean,
          full_name: st.full_name || acc.full_name || 'طالب',
          academic_year: st.academic_year || acc.academic_year || '',
          section: st.section || acc.section || '',
          pin_code: acc.pin_code || '',
          phone: acc.mobile || acc.phone || '',
          last_seen: acc.last_login_at,
          last_action: 'تسجيل دخول سابق',
          platform: acc.bound_device_platform === 'apk' ? 'تطبيق أندرويد (APK)' : 'متصفح الويب',
          status: acc.status || 'active'
        });
      }
    });

    activityStudents.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());

    // =========================================================================
    // التاب 3: فاقدو جلسات الكوكيز (سجلوا ولكن جلستهم منتهية / مفقودة)
    // =========================================================================
    // الطلاب الذين تم تفعيل حسابهم ولكن لم يسجلوا أي دخول حديث في آخر 7 أيام
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lostSessionStudents: any[] = [];

    accountsMap.forEach((acc, code) => {
      const clean = formatStudentCode(code);
      const isRegistered = acc.status === 'active' || acc.is_pin_used || acc.pin_code;
      if (!isRegistered) return;

      const act = latestActivityMap.get(clean);
      const lastSeenTime = act ? new Date(act.created_at) : (acc.last_login_at ? new Date(acc.last_login_at) : null);

      // إذا كان مسجلاً ولكن لا يوجد أي ظهور له في آخر أسبوع أو جلسته فقدت
      if (!lastSeenTime || lastSeenTime < sevenDaysAgo) {
        const st = studentMap.get(clean) || {};
        lostSessionStudents.push({
          student_code: clean,
          full_name: st.full_name || acc.full_name || 'طالب مسجل',
          academic_year: st.academic_year || acc.academic_year || '',
          section: st.section || acc.section || '',
          pin_code: acc.pin_code || '',
          phone: acc.mobile || acc.phone || '',
          registered_at: acc.created_at || st.created_at || '—',
          last_login_at: lastSeenTime ? lastSeenTime.toISOString() : null,
          status: 'جلسة كوكيز مفقودة / غير متصل'
        });
      }
    });

    lostSessionStudents.sort((a, b) => {
      const timeA = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
      const timeB = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
      return timeB - timeA;
    });

    // =========================================================================
    // التاب 4: الحسابات المشكوك بأمرها (تم فتحها على أكثر من هاتف)
    // =========================================================================
    const suspiciousAccounts: any[] = [];

    accountsMap.forEach((acc, code) => {
      const clean = formatStudentCode(code);
      let devices = Array.isArray(acc.devices) ? acc.devices : [];

      // تصفية الأجهزة الفريدة حسب معرّف الجهاز deviceId
      const uniqueDeviceIds = new Set<string>();
      const parsedDevices: any[] = [];

      devices.forEach((d: any) => {
        const dId = d.deviceId || d.id;
        if (dId && dId !== 'unknown' && !uniqueDeviceIds.has(dId)) {
          uniqueDeviceIds.add(dId);
          parsedDevices.push({
            deviceId: dId,
            phoneModel: parseDeviceModel(d.userAgent || ''),
            userAgent: d.userAgent || '',
            screen: d.screen || '',
            firstSeen: d.firstSeen || acc.created_at,
            lastSeen: d.lastSeen || acc.last_login_at || d.firstSeen
          });
        }
      });

      // إذا كان الحساب قد فُتح على أكثر من هاتف / جهاز (أكثر من معرّف فريد)
      if (parsedDevices.length > 1) {
        const st = studentMap.get(clean) || {};
        suspiciousAccounts.push({
          student_code: clean,
          full_name: st.full_name || acc.full_name || 'طالب',
          academic_year: st.academic_year || acc.academic_year || '',
          section: st.section || acc.section || '',
          pin_code: acc.pin_code || '',
          phone: acc.mobile || acc.phone || '',
          devices_count: parsedDevices.length,
          devices: parsedDevices,
          bound_device_id: acc.bound_device_id,
          reason: `تم فتح الحساب وتسجيل الدخول من (${parsedDevices.length}) هواتف مختلفة`,
          status: acc.status || 'active'
        });
      }
    });

    suspiciousAccounts.sort((a, b) => b.devices_count - a.devices_count);

    return noStoreJson({
      success: true,
      stats: {
        installed_count: installedStudents.length,
        active_count: activityStudents.length,
        lost_session_count: lostSessionStudents.length,
        suspicious_count: suspiciousAccounts.length
      },
      installed_students: installedStudents,
      activity_students: activityStudents,
      lost_session_students: lostSessionStudents,
      suspicious_accounts: suspiciousAccounts
    });
  } catch (err: any) {
    console.error('[advanced-students API error]:', err);
    return noStoreJson({ success: false, error: err?.message || 'Failed to fetch advanced students' }, { status: 500 });
  }
}

/**
 * إجراءات إدارية: فك قيد الأجهزة للحسابات المشكوك بأمرها أو فك القفل
 */
export async function POST(request: Request) {
  const guard = await requireCoordinator(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { action, student_code } = body;

    if (!student_code) {
      return noStoreJson({ error: 'كود الطالب مطلوب' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(student_code);

    if (action === 'reset_devices') {
      // 1. تصفير الأجهزة في student_accounts
      await safeUpdateStudentAccounts((q) => q.eq('student_code', cleanCode), {
        devices: [],
        bound_device_id: null,
        bound_device_platform: null,
        failed_attempts: 0,
        locked_until: null
      });

      // 2. تصفير في telegram_browser_id إن وجد
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('id, telegram_browser_id')
        .eq('student_code', cleanCode)
        .maybeSingle();

      if (st?.telegram_browser_id) {
        try {
          const parsed = JSON.parse(st.telegram_browser_id);
          parsed.devices = [];
          parsed.bound_device_id = null;
          parsed.bound_device_platform = null;
          await supabaseAdmin
            .from('students')
            .update({ telegram_browser_id: JSON.stringify(parsed) })
            .eq('id', st.id);
        } catch {}
      }

      // 3. توثيق في سجل الأوديت
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: cleanCode,
        action: 'admin_reset_devices',
        details: { reset_by: guard.ctx?.profile?.full_name || guard.ctx?.user?.email || 'Admin', timestamp: new Date().toISOString() }
      });

      return noStoreJson({ success: true, message: `تم فك قيد وتصفير أجهزة الطالب (${cleanCode}) بنجاح ويمكنه الدخول من هاتفه الآن ✅` });
    }

    return noStoreJson({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    console.error('[advanced-students POST error]:', err);
    return noStoreJson({ error: err?.message || 'فشلت العملية' }, { status: 500 });
  }
}
