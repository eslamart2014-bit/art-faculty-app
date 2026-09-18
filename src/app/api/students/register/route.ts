import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode, generatePinCode } from '@/lib/codeHelper';
import { uploadImageToStorage } from '@/lib/telegramStorage';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      student_code,
      full_name,
      mobile,
      id_card_image,
      device_info,
    } = body;

    if (!student_code || !mobile) {
      return NextResponse.json(
        { error: 'يرجى إدخال كود الطالب ورقم الموبايل بشكل صحيح' },
        { status: 400 }
      );
    }

    const cleanCode = formatStudentCode(student_code);

    // 1. التحقق من وجود الطالب في كشوف الكلية الأصلية
    const { data: studentRecord, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section')
      .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
      .maybeSingle();

    if (stErr || !studentRecord) {
      return NextResponse.json(
        { error: 'كود الطالب غير مسجل في منظومة الكلية! يرجى مراجعة شؤون الطلاب.' },
        { status: 404 }
      );
    }

    // 2. التحقق من الحساب في جدول student_accounts أو telegram_browser_id
    let existingAccount: any = null;
    try {
      const { data } = await supabaseAdmin
        .from('student_accounts')
        .select('*')
        .eq('student_code', studentRecord.student_code)
        .maybeSingle();
      existingAccount = data;
    } catch (e) {}

    if (!existingAccount && (studentRecord as any).telegram_browser_id) {
      try {
        existingAccount = JSON.parse((studentRecord as any).telegram_browser_id);
      } catch (e) {}
    }

    if (!existingAccount) {
      existingAccount = localStore.getAccount(studentRecord.student_code);
    }

    if (existingAccount && existingAccount.status === 'active' && existingAccount.is_pin_used) {
      return NextResponse.json(
        {
          error: 'هذا الحساب مسجل ومفعل بالفعل بالرقم السري. يمكنك تسجيل الدخول مباشرة.',
          alreadyActive: true,
        },
        { status: 400 }
      );
    }

    // 3. رفع صورة البطاقة عبر محرك التخزين الصامت
    let idCardUrl = existingAccount?.id_card_url || '';
    if (id_card_image && id_card_image.startsWith('data:image')) {
      const uploadRes = await uploadImageToStorage(
        id_card_image,
        `بطاقة هوية الطالب: ${studentRecord.full_name} (${studentRecord.student_code})`
      );
      if (uploadRes.success) {
        idCardUrl = uploadRes.url;
      }
    }

    // 4. توليد الرقم السري (PIN) من 8 خانات إذا لم يكن موجوداً
    const pinCode = existingAccount?.pin_code || generatePinCode();

    // 5. حفظ أو تحديث الحساب
    const deviceRecord = {
      deviceId: device_info?.deviceId || 'unknown',
      userAgent: device_info?.userAgent || 'browser',
      screen: device_info?.screenResolution || '',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    let updatedDevices = existingAccount?.devices || [];
    if (!Array.isArray(updatedDevices)) updatedDevices = [];
    if (!updatedDevices.some((d: any) => d.deviceId === deviceRecord.deviceId)) {
      updatedDevices.push(deviceRecord);
    }

    const payload = {
      student_id: studentRecord.id,
      student_code: studentRecord.student_code,
      full_name: studentRecord.full_name,
      academic_year: studentRecord.academic_year,
      section: studentRecord.section || 'عام',
      mobile: mobile.trim(),
      id_card_url: idCardUrl,
      pin_code: pinCode,
      is_pin_used: false,
      status: 'pending',
      devices: updatedDevices,
      last_login_at: new Date().toISOString(),
    };

    try {
      const { error: saveErr } = await supabaseAdmin
        .from('student_accounts')
        .upsert(payload, { onConflict: 'student_code' });

      if (saveErr) {
        localStore.upsertAccount(payload);
      }
    } catch (e) {
      localStore.upsertAccount(payload);
    }

    // حفظ فوري ومستدام في جدول students كحاوية JSON آمنة ومزامنة عبر السحاب
    try {
      await supabaseAdmin
        .from('students')
        .update({ telegram_browser_id: JSON.stringify(payload) })
        .eq('id', studentRecord.id);
    } catch (e) {
      console.error('Error updating students.telegram_browser_id:', e);
    }

    // 6. تسجيل النشاط الأمني
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: studentRecord.student_code,
        action: 'register',
        device_id: device_info?.deviceId,
        user_agent: device_info?.userAgent,
        details: { mobile: mobile.trim(), status: 'pending' },
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      status: 'pending',
      student: {
        id: studentRecord.id,
        full_name: studentRecord.full_name,
        student_code: studentRecord.student_code,
        academic_year: studentRecord.academic_year,
        section: studentRecord.section || 'عام',
      },
      message: 'تم تسجيل بياناتك المبدئية بنجاح، يرجى التوجه لأحد منسقي النظام للحصول على الرقم السري.',
    });
  } catch (err: any) {
    console.error('Registration server error:', err);
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
