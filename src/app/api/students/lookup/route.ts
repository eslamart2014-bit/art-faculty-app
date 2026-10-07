import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode, getStudentCodeVariants, buildStudentCodeFilter } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';
import { isAccountActivated, parseTelegramBrowserId } from '@/lib/studentAccountHelper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCode = (searchParams.get('code') || '').trim();
  const deviceId = (searchParams.get('deviceId') || searchParams.get('device_id') || '').trim();

  if (!rawCode) {
    return NextResponse.json({ success: false, message: 'يرجى إدخال كود الطالب' }, { status: 400 });
  }

  const cleanCode = formatStudentCode(rawCode);
  const variants = getStudentCodeVariants(cleanCode || rawCode);
  const filter = buildStudentCodeFilter(variants);

  try {
    // 1. البحث في كشوف الكلية الأصلية
    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section, telegram_browser_id')
      .or(filter)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Lookup error:', error);
      return NextResponse.json({ success: false, message: 'حدث خطأ أثناء البحث' }, { status: 500 });
    }

    if (!student) {
      return NextResponse.json({
        success: false,
        message: 'كود الطالب غير مسجل في كشوف الكلية! تأكد من كتابة الكود بشكل صحيح.',
      }, { status: 404 });
    }

    const safeStudent = {
      id: student.id,
      full_name: student.full_name,
      student_code: student.student_code,
      academic_year: student.academic_year,
      section: student.section,
    };

    // تسجيل عملية الاستعلام أمنياً في سجلات البحث
    try {
      const userAgent = request.headers.get('user-agent') || '';
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
      const logEntry = {
        student_code: student.student_code,
        action: 'student_lookup',
        device_id: deviceId || 'unknown_device',
        user_agent: userAgent,
        details: {
          student_name: student.full_name,
          academic_year: student.academic_year,
          section: student.section,
          ip: ip,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      };
      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: logEntry.student_code,
          action: logEntry.action,
          device_id: logEntry.device_id,
          user_agent: logEntry.user_agent,
          details: logEntry.details
        });
      } catch (err) {}
      localStore.saveAuditLog(logEntry);
    } catch (e) {}

    // 2. التحقق من حالة حساب الطالب (مفعل، معلق، أو جديد)
    // ملاحظة: نقرأ المصدرين معاً (student_accounts + telegram_browser_id) لأن بعض أعمدة
    // الاعتماد غير موجودة في جدول student_accounts ويتم حفظها في JSON فقط.
    let dbAccount: any = null;
    try {
      const { data: acc } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .or(filter)
        .limit(1)
        .maybeSingle();
      dbAccount = acc;
    } catch (e) {}

    const tbAccount: any = parseTelegramBrowserId(student.telegram_browser_id);

    let existingAccount: any = dbAccount || tbAccount
      ? { ...(tbAccount || {}), ...(dbAccount || {}) }
      : null;

    if (!existingAccount) {
      for (const v of variants) {
        const found = localStore.getAccount(v);
        if (found) { existingAccount = found; break; }
      }
    }

    const isActivated = isAccountActivated(dbAccount, tbAccount, !dbAccount && !tbAccount ? existingAccount : null);

    if (isActivated && existingAccount) {
      if (!existingAccount.pin_code && tbAccount?.pin_code) existingAccount.pin_code = tbAccount.pin_code;

      // فحص قيد الجهاز (Single Device Lock) لمنع فتح الحساب من جهاز آخر
      const boundDeviceId: string | null = tbAccount?.bound_device_id || dbAccount?.bound_device_id || null;
      const validDevice = Boolean(deviceId && deviceId !== 'unknown' && deviceId !== 'unknown_device');

      if (boundDeviceId && validDevice && boundDeviceId !== deviceId) {
        return NextResponse.json({
          success: true,
          student: safeStudent,
          isAlreadyActive: false,
          device_locked: true,
          message: 'هذا الحساب مقيد بجهاز آخر. يرجى التوجه إلى منسقك لفك القيد والسماح بالدخول من هذا الجهاز.',
        }, {
          headers: { 'Cache-Control': 'no-store, max-age=0' }
        });
      }

      // ربط الجهاز تلقائياً فقط إذا كان هو نفس الجهاز الذي سجّل منه الطالب
      if (!boundDeviceId && validDevice) {
        const knownDevices: any[] = [
          ...(Array.isArray(tbAccount?.devices) ? tbAccount.devices : []),
          ...(Array.isArray(dbAccount?.devices) ? dbAccount.devices : []),
        ];
        const isRegistrationDevice = knownDevices.some((d: any) => d?.deviceId === deviceId);
        if (isRegistrationDevice && tbAccount) {
          try {
            await supabaseAdmin
              .from('students')
              .update({ telegram_browser_id: JSON.stringify({ ...tbAccount, bound_device_id: deviceId }) })
              .eq('id', student.id);
          } catch (e) {}
        }
      }

      return NextResponse.json({
        success: true,
        student: {
          ...safeStudent,
          pin_code: existingAccount.pin_code || undefined,
          status: 'active',
          is_pin_used: true
        },
        pin_code: existingAccount.pin_code || undefined,
        isAlreadyActive: true,
        message: 'هذا الحساب مسجل ومفعل بالفعل.',
      }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }

    if (existingAccount && existingAccount.status === 'pending') {
      return NextResponse.json({
        success: true,
        student: {
          ...safeStudent,
          pin_code: existingAccount.pin_code || undefined
        },
        pin_code: existingAccount.pin_code || undefined,
        isPending: true,
        message: 'بياناتك مسجلة بالفعل ولكنها بانتظار اعتماد المنسق لتفعيل الحساب.',
      }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }

    return NextResponse.json({
      success: true,
      student: safeStudent,
      isNew: true,
    });
  } catch (err: any) {
    console.error('Lookup unexpected error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
