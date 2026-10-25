import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode, generatePinCode, getStudentCodeVariants } from '@/lib/codeHelper';
import { uploadImageToStorage } from '@/lib/telegramStorage';
import { localStore } from '@/lib/localFallbackStore';
import { noStoreJson } from '@/lib/serverAuth';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const MAX_ID_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(`student-register:${ip}`, 5, 10 * 60_000)) {
      return noStoreJson({ error: 'عدد محاولات التسجيل كبير، يرجى المحاولة لاحقاً' }, { status: 429 });
    }

    const body = await request.json();
    const student_code = typeof body.student_code === 'string' ? body.student_code.trim() : '';
    const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';
    const id_card_image = typeof body.id_card_image === 'string' ? body.id_card_image : '';
    const device_info = body.device_info;

    if (!student_code || !/^[A-Za-z0-9\-_]{1,20}$/.test(student_code)) {
      return noStoreJson({ error: 'يرجى إدخال كود طالب جامعي صالح' }, { status: 400 });
    }

    if (!/^\d{10,15}$/.test(mobile)) {
      return noStoreJson({ error: 'يرجى إدخال رقم موبايل صحيح للتواصل' }, { status: 400 });
    }

    if (!id_card_image.startsWith('data:image') || id_card_image.length > MAX_ID_IMAGE_BYTES) {
      return noStoreJson(
        { error: 'صورة بطاقة الرقم القومي أو كارنيه الكلية إجبارية لإتمام التسجيل' },
        { status: 400 }
      );
    }

    const cleanCode = formatStudentCode(student_code);

    const { data: studentRecord, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section')
      .in('student_code', getStudentCodeVariants(cleanCode))
      .maybeSingle();

    if (stErr || !studentRecord) {
      return noStoreJson(
        { error: 'كود الطالب غير مسجل في منظومة الكلية! يرجى مراجعة شؤون الطلاب.' },
        { status: 404 }
      );
    }

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

    if (existingAccount?.status === 'suspended') {
      return noStoreJson({ error: 'هذا الحساب موقوف من قبل إدارة المنظومة' }, { status: 403 });
    }

    if (existingAccount && existingAccount.status === 'active' && existingAccount.is_pin_used) {
      return noStoreJson(
        {
          error: 'هذا الحساب مسجل ومفعل بالفعل بالرقم السري. يمكنك تسجيل الدخول مباشرة.',
          alreadyActive: true,
        },
        { status: 400 }
      );
    }

    let idCardUrl = existingAccount?.id_card_url || '';
    if (id_card_image.startsWith('data:image')) {
      const uploadRes = await uploadImageToStorage(
        id_card_image,
        `بطاقة هوية الطالب: ${studentRecord.full_name} (${studentRecord.student_code})`,
        undefined,
        undefined,
        `id_cards/${studentRecord.student_code}_${Date.now()}.webp`
      );
      if (uploadRes.success) {
        idCardUrl = uploadRes.url;
      } else {
        return noStoreJson({ error: 'تعذر رفع صورة البطاقة. يرجى المحاولة مرة أخرى' }, { status: 502 });
      }
    }

    const pinCode = existingAccount?.pin_code || generatePinCode();

    const deviceRecord = {
      deviceId: typeof device_info?.deviceId === 'string' ? device_info.deviceId.slice(0, 100) : 'unknown',
      userAgent: typeof device_info?.userAgent === 'string' ? device_info.userAgent.slice(0, 300) : 'browser',
      screen: typeof device_info?.screenResolution === 'string' ? device_info.screenResolution.slice(0, 40) : '',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    let updatedDevices = Array.isArray(existingAccount?.devices) ? existingAccount.devices : [];
    if (!updatedDevices.some((d: any) => d.deviceId === deviceRecord.deviceId)) {
      updatedDevices.push(deviceRecord);
    }

    const payload = {
      student_id: studentRecord.id,
      student_code: studentRecord.student_code,
      full_name: studentRecord.full_name,
      academic_year: studentRecord.academic_year,
      section: studentRecord.section || 'عام',
      mobile,
      id_card_url: idCardUrl,
      pin_code: pinCode,
      is_pin_used: false,
      status: 'pending',
      devices: updatedDevices,
      created_at: existingAccount?.created_at || new Date().toISOString(),
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

    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: studentRecord.student_code,
        action: 'register',
        device_id: deviceRecord.deviceId,
        user_agent: deviceRecord.userAgent,
        details: { status: 'pending' },
      });
    } catch (e) {}

    return noStoreJson({
      success: true,
      status: 'pending',
      student: {
        id: studentRecord.id,
        full_name: studentRecord.full_name,
        student_code: studentRecord.student_code,
        academic_year: studentRecord.academic_year,
        section: studentRecord.section || 'عام',
        pin_code: pinCode,
      },
      message: 'تم تسجيل بياناتك المبدئية بنجاح! يرجى مراجعة منسق المنظومة لتفعيل حسابك.',
    });
  } catch (err: any) {
    console.error('Registration server error:', err);
    return noStoreJson({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
