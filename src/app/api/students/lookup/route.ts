import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCode = (searchParams.get('code') || '').trim();
  const deviceId = (searchParams.get('deviceId') || searchParams.get('device_id') || '').trim();

  if (!rawCode) {
    return NextResponse.json({ success: false, message: 'يرجى إدخال كود الطالب' }, { status: 400 });
  }

  const cleanCode = formatStudentCode(rawCode);

  try {
    // 1. البحث في كشوف الكلية الأصلية
    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section, telegram_browser_id')
      .or(`student_code.eq.${rawCode},student_code.eq.${cleanCode}`)
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

    // 2. التحقق من حالة حساب الطالب (مفعل، معلق، أو جديد)
    let existingAccount: any = null;
    try {
      const { data: acc } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .eq('student_code', student.student_code)
        .maybeSingle();
      existingAccount = acc;
    } catch (e) {}

    if (!existingAccount && student.telegram_browser_id) {
      try {
        existingAccount = JSON.parse(student.telegram_browser_id);
      } catch (e) {}
    }

    if (!existingAccount) {
      existingAccount = localStore.getAccount(student.student_code);
    }

    // التحقق مما إذا كان الطلب قادماً من جهاز معتمد مسجل في الحساب
    let isAuthorizedDevice = false;
    if (deviceId && Array.isArray(existingAccount?.devices)) {
      isAuthorizedDevice = existingAccount.devices.some((d: any) => d.deviceId === deviceId);
    }

    if (existingAccount && existingAccount.status === 'active' && existingAccount.is_pin_used) {
      return NextResponse.json({
        success: true,
        student: {
          ...safeStudent,
          ...(isAuthorizedDevice && existingAccount.pin_code ? { pin_code: existingAccount.pin_code } : {})
        },
        isAlreadyActive: true,
        message: 'هذا الحساب مسجل ومفعل بالفعل بالرقم السري.',
      });
    }

    if (existingAccount && existingAccount.status === 'pending') {
      return NextResponse.json({
        success: true,
        student: safeStudent,
        isPending: true,
        message: 'بياناتك مسجلة بالفعل ولكنها بانتظار إدخال الرقم السري من المنسق لتفعيل الحساب.',
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
