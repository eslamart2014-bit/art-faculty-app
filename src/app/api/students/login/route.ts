import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { student_code, pin_code, device_info } = await request.json();

    if (!student_code) {
      return NextResponse.json(
        { error: 'يرجى إدخال كود الطالب' },
        { status: 400 }
      );
    }

    const cleanCode = formatStudentCode(student_code);
    const cleanPin = pin_code ? pin_code.replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().toLowerCase() : '';

    // جلب الحساب من student_accounts أو telegram_browser_id
    let account: any = null;
    let studentRecord: any = null;
    try {
      const { data } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
        .maybeSingle();
      account = data;
    } catch (e) {}

    try {
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('id, full_name, student_code, academic_year, section, telegram_browser_id')
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
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

    // استخراج ومقارنة الأرقام السرية المحتملة
    let telegramPin = '';
    if (studentRecord?.telegram_browser_id) {
      try {
        telegramPin = JSON.parse(studentRecord.telegram_browser_id)?.pin_code || '';
      } catch (e) {}
    }

    const expectedPins = [
      (account.pin_code || '').replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().toLowerCase(),
      telegramPin.replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().toLowerCase()
    ].filter(Boolean);

    const isPinMatch = isAccountActive || expectedPins.some(p => p === cleanPin);

    if (!isPinMatch) {
      const failed = (account.failed_attempts || 0) + 1;
      let lockUpdate: any = { failed_attempts: failed };
      let warnMessage = `الرقم السري غير صحيح! (المحاولة ${failed} من 5)`;

      if (failed >= 5) {
        lockUpdate.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        warnMessage = 'تم قفل الحساب مؤقتاً لمدة 15 دقيقة لتكرار المحاولات الخاطئة!';
      }

      await supabaseAdmin
        .from('student_accounts')
        .update(lockUpdate)
        .eq('id', account.id);

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

    const isAdminSession = request.headers.get('X-Admin-Impersonate') === 'true' || device_info?.is_admin_session === true;
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

    if (!isAdminSession && deviceId !== 'unknown') {
      if (boundDeviceId) {
        if (boundDeviceId !== deviceId) {
          return NextResponse.json(
            {
              device_locked: true,
              error: 'هذا الحساب مقيّد بجهاز آخر. يرجى التوجه إلى منسقك لفك القيد والسماح بتسجيل الدخول من هذا الجهاز.',
              coordinator_name: account.activated_by || 'منسق النظام'
            },
            { status: 403 }
          );
        }
      } else {
        boundDeviceId = deviceId;
        resetSecurity.bound_device_id = deviceId;
      }
    }

    await supabaseAdmin
      .from('student_accounts')
      .update(resetSecurity)
      .eq('id', account.id);

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
      await supabaseAdmin
        .from('student_accounts')
        .update({
          devices: updatedDevices,
          last_login_at: new Date().toISOString(),
        })
        .eq('id', account.id);
    }

    // تحديث دائم في students.telegram_browser_id
    try {
      const mergedPayload = {
        ...account,
        ...resetSecurity,
        devices: updatedDevices,
        last_login_at: new Date().toISOString()
      };
      await supabaseAdmin
        .from('students')
        .update({ telegram_browser_id: JSON.stringify(mergedPayload) })
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
    } catch (e) {}

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

    return NextResponse.json({
      success: true,
      student: account,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
