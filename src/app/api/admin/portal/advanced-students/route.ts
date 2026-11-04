import { supabaseAdmin } from '@/lib/core/supabase';
import { requireCoordinator, noStoreJson } from '@/lib/auth/serverAuth';
import { formatStudentCode, getStudentCodeVariants, buildStudentCodeFilter } from '@/lib/students/codeHelper';
import { localStore } from '@/lib/students/localFallbackStore';

export const dynamic = 'force-dynamic';

function parseActionLabel(action: string, details?: any): string {
  if (!action) return 'نشاط داخل البوت';
  switch (action) {
    case 'bot_login':
      return 'دخول للبوابة عبر بوت تليجرام';
    case 'bot_link_account':
      return 'ربط الحساب ببوت تليجرام لأول مرة';
    case 'bot_portal_open':
      return 'فتح لوحة الطالب داخل البوت';
    case 'login':
    case 'student_login':
      return 'تسجيل دخول للبوابة';
    case 'qr_view':
    case 'download_qr':
      return 'استعراض / تحميل بطاقة QR';
    case 'submit_project':
      return 'تسليم مشروع فني';
    case 'receipt_download':
    case 'locker_receipt':
      return 'تحميل استمارة حجز الدولاب';
    case 'account_suspended':
      return 'تم تعليق الحساب من الإدارة';
    case 'account_unsuspended':
      return 'تم تفعيل الحساب من الإدارة';
    case 'account_deleted_by_admin':
      return 'تم حذف الحساب وفك ربط تليجرام';
    default:
      return action;
  }
}

function isLocalhostRequest(request: Request): boolean {
  const host = request.headers.get('host') || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

export async function GET(request: Request) {
  if (!isLocalhostRequest(request)) {
    const guard = await requireCoordinator(request);
    if (!guard.ok) return guard.response;
  }

  try {
    const [
      { data: studentsList },
      { data: accountsList },
      { data: auditLogs }
    ] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, student_code, full_name, academic_year, section, telegram_id, is_active, telegram_browser_id, created_at')
        .eq('is_active', true),
      supabaseAdmin
        .from('student_accounts')
        .select('student_code, status, last_login_at, created_at'),
      supabaseAdmin
        .from('portal_audit_logs')
        .select('student_code, action, details, created_at')
        .order('created_at', { ascending: false })
        .limit(2000)
    ]);

    const studentMap = new Map<string, any>();
    (studentsList || []).forEach((st: any) => {
      if (st.student_code) {
        const clean = formatStudentCode(st.student_code);
        studentMap.set(clean, st);
        studentMap.set(st.student_code, st);
      }
    });

    const accountsMap = new Map<string, any>();
    (accountsList || []).forEach((acc: any) => {
      if (acc.student_code) {
        const clean = formatStudentCode(acc.student_code);
        accountsMap.set(clean, acc);
        accountsMap.set(acc.student_code, acc);
      }
    });

    const latestActivityMap = new Map<string, any>();
    (auditLogs || []).forEach((log: any) => {
      if (log.student_code) {
        const clean = formatStudentCode(log.student_code);
        if (!latestActivityMap.has(clean)) {
          latestActivityMap.set(clean, log);
        }
      }
    });

    const botStudents: any[] = [];
    const suspendedStudents: any[] = [];
    const activityStudents: any[] = [];
    const seenActivityCodes = new Set<string>();

    (studentsList || []).forEach((st: any) => {
      if (!st.student_code) return;
      const clean = formatStudentCode(st.student_code);
      const acc = accountsMap.get(clean) || accountsMap.get(st.student_code) || {};
      let parsedMeta: any = {};
      if (st.telegram_browser_id) {
        try {
          parsedMeta = JSON.parse(st.telegram_browser_id);
        } catch {}
      }

      const latestLog = latestActivityMap.get(clean);
      const logDetails = latestLog?.details || {};

      const tgId = st.telegram_id ? String(st.telegram_id) : (parsedMeta?.telegram_id ? String(parsedMeta.telegram_id) : '');
      const tgUsername = parsedMeta?.telegram_username || logDetails?.username || '';
      const tgFirstName = parsedMeta?.telegram_first_name || logDetails?.first_name || '';

      const isSuspended =
        acc?.status === 'suspended' ||
        parsedMeta?.status === 'suspended';

      const status = isSuspended ? 'suspended' : 'active';
      const lastSeen =
        latestLog?.created_at ||
        parsedMeta?.last_login_at ||
        acc?.last_login_at ||
        parsedMeta?.linked_at ||
        null;
      const lastAction = latestLog
        ? parseActionLabel(latestLog.action, logDetails)
        : (tgId ? 'مسجل ببوت تليجرام' : '—');

      const record = {
        student_code: clean,
        full_name: st.full_name || 'طالب',
        academic_year: st.academic_year || '',
        section: st.section || '',
        telegram_id: tgId,
        telegram_username: tgUsername,
        telegram_first_name: tgFirstName,
        linked_at: parsedMeta?.linked_at || latestLog?.created_at || st.created_at,
        last_seen: lastSeen,
        last_action: lastAction,
        status
      };

      if (tgId) {
        botStudents.push(record);
      }

      if (isSuspended) {
        suspendedStudents.push(record);
      }

      if (tgId || latestLog) {
        seenActivityCodes.add(clean);
        activityStudents.push({
          ...record,
          last_seen: lastSeen || st.created_at
        });
      }
    });

    // إضافة أي نشاط في السجلات لطلاب لم يظهروا أعلاه
    latestActivityMap.forEach((log, clean) => {
      if (!seenActivityCodes.has(clean)) {
        seenActivityCodes.add(clean);
        const st = studentMap.get(clean) || {};
        const acc = accountsMap.get(clean) || {};
        let parsedMeta: any = {};
        if (st.telegram_browser_id) {
          try { parsedMeta = JSON.parse(st.telegram_browser_id); } catch {}
        }
        const isSuspended =
          st.is_active === false ||
          acc?.status === 'suspended' ||
          parsedMeta?.status === 'suspended';

        activityStudents.push({
          student_code: clean,
          full_name: st.full_name || 'طالب',
          academic_year: st.academic_year || '',
          section: st.section || '',
          telegram_id: st.telegram_id ? String(st.telegram_id) : (parsedMeta?.telegram_id ? String(parsedMeta.telegram_id) : ''),
          telegram_username: parsedMeta?.telegram_username || log.details?.username || '',
          telegram_first_name: parsedMeta?.telegram_first_name || log.details?.first_name || '',
          linked_at: parsedMeta?.linked_at || log.created_at,
          last_seen: log.created_at,
          last_action: parseActionLabel(log.action, log.details),
          status: isSuspended ? 'suspended' : 'active'
        });
      }
    });

    botStudents.sort((a, b) => {
      const tA = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const tB = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return tB - tA;
    });

    activityStudents.sort((a, b) => {
      const tA = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const tB = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return tB - tA;
    });

    suspendedStudents.sort((a, b) => {
      const tA = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const tB = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return tB - tA;
    });

    return noStoreJson({
      success: true,
      stats: {
        total_students: (studentsList || []).length,
        bot_registered_count: botStudents.length,
        active_recent_count: activityStudents.length,
        suspended_count: suspendedStudents.length
      },
      bot_students: botStudents,
      activity_students: activityStudents,
      suspended_students: suspendedStudents
    });
  } catch (err: any) {
    console.error('[advanced-students API error]:', err);
    return noStoreJson({ success: false, error: err?.message || 'Failed to fetch Telegram bot students' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let adminName = 'Admin';
  if (!isLocalhostRequest(request)) {
    const guard = await requireCoordinator(request);
    if (!guard.ok) return guard.response;
    adminName = guard.ctx?.profile?.full_name || guard.ctx?.user?.email || 'Admin';
  }

  try {
    const body = await request.json();
    const { action, student_code, status: requestedStatus } = body;

    if (!student_code) {
      return noStoreJson({ error: 'كود الطالب مطلوب' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(student_code);
    const variants = getStudentCodeVariants(cleanCode || student_code);
    const filter = buildStudentCodeFilter(variants);
    const nowIso = new Date().toISOString();

    // 1. تعليق الحساب أو إعادة تفعيله
    if (action === 'toggle_suspend') {
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('id, student_code, full_name, is_active, telegram_browser_id')
        .or(filter)
        .limit(1)
        .maybeSingle();

      if (!st) {
        return noStoreJson({ error: 'الطالب غير موجود في المنظومة' }, { status: 404 });
      }

      let parsedMeta: any = {};
      if (st.telegram_browser_id) {
        try { parsedMeta = JSON.parse(st.telegram_browser_id); } catch {}
      }

      const currentlySuspended = parsedMeta?.status === 'suspended';
      const newStatus = requestedStatus
        ? (requestedStatus === 'suspended' ? 'suspended' : 'active')
        : (currentlySuspended ? 'active' : 'suspended');

      parsedMeta = {
        ...parsedMeta,
        student_code: st.student_code,
        status: newStatus,
        updated_by: adminName,
        updated_at: nowIso
      };

      await supabaseAdmin
        .from('students')
        .update({
          telegram_browser_id: JSON.stringify(parsedMeta)
        })
        .eq('id', st.id);

      try {
        await supabaseAdmin
          .from('student_accounts')
          .update({ status: newStatus })
          .or(filter);
      } catch {}

      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: st.student_code || cleanCode,
          action: newStatus === 'suspended' ? 'account_suspended' : 'account_unsuspended',
          details: { by: adminName, status: newStatus, timestamp: nowIso }
        });
      } catch {}

      return noStoreJson({
        success: true,
        status: newStatus,
        message: newStatus === 'suspended'
          ? `تم تعليق حساب الطالب (${st.full_name}) بنجاح ⛔ لن يتمكن من فتح البوابة عبر البوت حتى يتم تفعيله.`
          : `تم إعادة تفعيل حساب الطالب (${st.full_name}) بنجاح ✅`
      });
    }

    // 2. حذف الحساب وفك ربط معرف تليجرام نهائياً
    if (action === 'delete_account' || action === 'unlink_telegram') {
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('id, student_code, full_name')
        .or(filter)
        .limit(1)
        .maybeSingle();

      if (!st) {
        return noStoreJson({ error: 'الطالب غير موجود في المنظومة' }, { status: 404 });
      }

      await supabaseAdmin
        .from('students')
        .update({
          telegram_id: null,
          is_active: true,
          telegram_browser_id: null
        })
        .eq('id', st.id);

      try {
        await supabaseAdmin
          .from('student_accounts')
          .delete()
          .or(filter);
      } catch {}

      try {
        localStore.deleteAccount(cleanCode);
        localStore.deleteAccount(student_code);
      } catch {}

      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: st.student_code || cleanCode,
          action: 'account_deleted_by_admin',
          details: { by: adminName, student_name: st.full_name, timestamp: nowIso }
        });
      } catch {}

      return noStoreJson({
        success: true,
        message: `تم حذف حساب الطالب (${st.full_name}) وفك ربط تليجرام بنجاح 🗑️ يمكن للطالب التسجيل من جديد عبر البوت.`
      });
    }

    return noStoreJson({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    console.error('[advanced-students POST error]:', err);
    return noStoreJson({ error: err?.message || 'فشلت العملية' }, { status: 500 });
  }
}
