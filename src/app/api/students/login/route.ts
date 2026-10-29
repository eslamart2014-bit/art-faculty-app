import { isAndroidAppRequest } from '@/lib/deviceFingerprint';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';
import { safeUpdateStudentAccounts } from '@/lib/studentAccountHelper';
import { noStoreJson, setStudentSession, createStudentSessionToken } from '@/lib/serverAuth';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(`student-login:${ip}`, 20, 60_000)) {
      return noStoreJson({ error: 'عدد المحاولات كبير، يرجى المحاولة بعد قليل' }, { status: 429 });
    }

    const { student_code, pin_code, device_info } = await request.json();

    if (typeof student_code !== 'string' || !/^[A-Za-z0-9\-_]{1,20}$/.test(student_code.trim())) {
      return noStoreJson({ error: 'يرجى إدخال كود طالب صالح' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(String(student_code).trim());
    const cleanPin = String(pin_code || '')
      .replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .trim()
      .toLowerCase();
    const codeCandidates = Array.from(new Set([String(student_code).trim(), cleanCode].filter(Boolean)));

    // جلب الحساب من student_accounts أو telegram_browser_id
    let account: any = null;
    let studentRecord: any = null;
    try {
      const { data } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .in('student_code', codeCandidates)
        .maybeSingle();
      account = data;
    } catch (e) {}

    try {
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('id, full_name, student_code, academic_year, section, telegram_browser_id')
        .in('student_code', codeCandidates)
        .maybeSingle();
      if (st) {
        studentRecord = st;
        if (!account && st.telegram_browser_id) {
          try {
            account = JSON.parse(st.telegram_browser_id);
            account.student_id = st.id;
            account.full_name = st.full_name;
            account.student_code = st.student_code;
            account.academic_year = st.academic_year;
            account.section = st.section;
          } catch (e) {}
        }
      }
    } catch (e) {}

    if (!account) {
      account = localStore.getAccount(cleanCode) || localStore.getAccount(student_code);
    }

    if (!account) {
      return NextResponse.json(
        { error: 'لم يتم العثور على حساب مسجل بهذا الكود. يرجى الضغط على "تسجيل جديد" أولاً.' },
        { status: 404 }
      );
    }

    // التحقق من حالة الحساب
    if (account.status === 'suspended') {
      return NextResponse.json(
        { error: 'تم تعليق هذا الحساب مؤقتاً من قبل إدارة المنظومة. يرجى مراجعة إدارة الكلية.' },
        { status: 403 }
      );
    }

    // فحص القفل المؤقت ضد هجمات التخمين (Brute-force protection)
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(account.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `تم قفل هذا الحساب مؤقتاً بسبب تكرار إدخال الرقم السري بشكل خاطئ! يرجى الانتظار (${remainingMinutes}) دقيقة ثم المحاولة مجدداً.` },
        { status: 429 }
      );
    }

    const isAccountActive = Boolean(
      account.status === 'active' ||
      account.is_pin_used ||
      account.activated_by ||
      account.activated_at
    );

    // إذا لم يتم إدخال رقم سري وكان الحساب غير مفعل بعد
    if (!cleanPin && !isAccountActive) {
      return NextResponse.json(
        { error: 'الحساب بانتظار اعتماد المنسق أو يتطلب إدخال الرقم السري الممنوح لك.' },
        { status: 400 }
      );
    }

    // استخراج ومقارنة الأرقام السرية المعتمدة
    const expectedPins = [
      (account.pin_code || '').replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().toLowerCase(),
    ].filter(Boolean);

    // Strictly require the stored PIN. Activation must never bypass the PIN check.
    const isPinMatch = expectedPins.length > 0 && cleanPin.length > 0 && expectedPins.includes(cleanPin);
    const hasNoPinConfigured = expectedPins.length === 0;

    if (hasNoPinConfigured) {
      return noStoreJson(
        { error: 'لا يوجد رقم سري معتمد لهذا الحساب. يرجى مراجعة منسق المنظومة لإعادة تعيينه.' },
        { status: 409 }
      );
    }

    if (!isPinMatch) {
      const failed = (account.failed_attempts || 0) + 1;
      let lockUpdate: any = { failed_attempts: failed };
      let warnMessage = `الرقم السري غير صحيح! (المحاولة ${failed} من 5)`;

      if (failed >= 5) {
        lockUpdate.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        warnMessage = 'تم قفل الحساب مؤقتاً لمدة 15 دقيقة لتكرار المحاولات الخاطئة!';
      }

      await safeUpdateStudentAccounts((q) => q.eq('id', account.id), lockUpdate);

      localStore.saveAccount({ ...account, ...lockUpdate });

      return NextResponse.json(
        { error: warnMessage },
        { status: 401 }
      );
    }

    // تصفير عداد المحاولات الفاشلة بعد الدخول الصحيح
    let resetSecurity: any = { failed_attempts: 0, locked_until: null };

    // إذا لم يكن قد أتم التفعيل
    if (!account.is_pin_used || account.status === 'pending') {
      resetSecurity.is_pin_used = true;
      resetSecurity.status = 'active';
      account.status = 'active';
      account.is_pin_used = true;
    }

    const deviceId = device_info?.deviceId || 'unknown';

    // استخراج bound_device_id
    let boundDeviceId = account.bound_device_id;
    if (!boundDeviceId && studentRecord?.telegram_browser_id) {
      try {
        const tbData = JSON.parse(studentRecord.telegram_browser_id);
        if (tbData.bound_device_id) {
          boundDeviceId = tbData.bound_device_id;
        }
      } catch (e) {}
    }

    const isFromApk = isAndroidAppRequest(request, { device_info });

    if (deviceId !== 'unknown') {
      if (boundDeviceId) {
        // فحص هل الحساب تم ربطه سابقاً بتطبيق الأندرويد أم بمتصفح
        const wasBoundToApk = account.bound_device_platform === 'apk';

        if (isFromApk && !wasBoundToApk) {
          // ترقية ذكية وفورية من المتصفح إلى تطبيق الأندرويد:
          // الطالب يسجل دخوله من التطبيق، نسمح له بالدخول فوراً ونربطه بجهاز التطبيق
          // ونفصل جلسة المتصفح السابقة تلقائياً
          boundDeviceId = deviceId;
          resetSecurity.bound_device_id = deviceId;
          resetSecurity.bound_device_platform = 'apk';
          resetSecurity.app_migrated_at = new Date().toISOString();
        } else if (boundDeviceId !== deviceId) {
          // إذا كان مقيداً بجهاز تطبيق آخر، أو مقيداً بمتصفح آخر وتلك محاولة من متصفح ثانٍ:
          return NextResponse.json(
            {
              device_locked: true,
              error: wasBoundToApk
                ? 'هذا الحساب مقيّد بجهاز هاتف آخر. يرجى التوجه إلى منسقك لفك القيد والسماح بتسجيل الدخول من هذا الهاتف.'
                : 'هذا الحساب مقيّد بجهاز آخر. يرجى التوجه إلى منسقك لفك القيد والسماح بتسجيل الدخول من هذا الجهاز.',
              coordinator_name: account.activated_by || 'منسق النظام'
            },
            { status: 403 }
          );
        }
      } else {
        boundDeviceId = deviceId;
        resetSecurity.bound_device_id = deviceId;
        resetSecurity.bound_device_platform = isFromApk ? 'apk' : 'web';
      }
    }

    await safeUpdateStudentAccounts((q) => q.eq('id', account.id), resetSecurity);

    // تحديث سجل الأجهزة
    let updatedDevices = account.devices || [];
    if (!Array.isArray(updatedDevices)) updatedDevices = [];

    // deviceId already defined above
    const existingDev = updatedDevices.find((d: any) => d.deviceId === deviceId);
    if (existingDev) {
      existingDev.lastSeen = new Date().toISOString();
    } else {
      updatedDevices.push({
        deviceId,
        userAgent: device_info?.userAgent || 'browser',
        screen: device_info?.screenResolution || '',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });
    }

    if (account.id) {
      await safeUpdateStudentAccounts((q) => q.eq('id', account.id), {
        devices: updatedDevices,
        last_login_at: new Date().toISOString(),
      });
    }

    // NOTE: لا نُكرّر بيانات الحساب (بما فيها PIN) داخل students.telegram_browser_id.
    // student_accounts هو المصدر الوحيد للحساب، والبيانات القديمة تبقى كما هي بدون حذف.

    // تسجيل الدخول في الأوديت لوج
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: account.student_code,
        action: 'login',
        device_id: deviceId,
        user_agent: device_info?.userAgent,
        details: { timestamp: new Date().toISOString() },
      });
    } catch (e) {}

    const safeStudent = {
      id: account.student_id || studentRecord?.id || null,
      full_name: account.full_name || studentRecord?.full_name || '',
      student_code: account.student_code || studentRecord?.student_code || cleanCode,
      academic_year: account.academic_year || studentRecord?.academic_year || '',
      section: account.section || studentRecord?.section || '',
      mobile: account.mobile || null,
      status: 'active',
    };

    const token = createStudentSessionToken(safeStudent.student_code, 180 * 24 * 60 * 60);
    const response = noStoreJson({ success: true, student: safeStudent, token });
    setStudentSession(response, safeStudent.student_code);
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
