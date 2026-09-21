import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/telegramStorage';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      student_code,
      student_name,
      course_id,
      course_name,
      project_name,
      images,
      device_info,
      pin_code,
    } = body;

    if (!student_code || !course_id || !project_name || !images || images.length === 0) {
      return NextResponse.json(
        { error: 'بيانات الرفع غير مكتملة أو لم يتم التقاط صور للعمل الفني' },
        { status: 400 }
      );
    }

    // التحقق الأمني من هوية الطالب والرقم السري
    const { data: studentRecord } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, telegram_browser_id')
      .eq('student_code', student_code)
      .maybeSingle();

    if (!studentRecord) {
      return NextResponse.json({ error: 'الطالب غير مسجل في الكلية' }, { status: 404 });
    }

    if (studentRecord.telegram_browser_id) {
      try {
        const acc = JSON.parse(studentRecord.telegram_browser_id);
        const expectedPin = acc.pin_code;
        const isActivated = acc.is_pin_used || acc.status === 'active';
        if (isActivated && expectedPin) {
          if (!pin_code || pin_code.trim() !== expectedPin.trim()) {
            return NextResponse.json(
              { error: 'غير مصرح: الرقم السري غير صحيح أو انتهت جلستك. يرجى تسجيل الدخول مجدداً.' },
              { status: 401 }
            );
          }
        }
      } catch (e) {}
    }

    // 1. التحقق من عدم وجود تسليم سابق لهذا المشروع
    let existingSub: any = null;
    try {
      const res = await supabaseAdmin
        .from('student_submissions')
        .select('id, status, score')
        .eq('student_code', student_code)
        .eq('course_id', course_id)
        .eq('project_name', project_name)
        .maybeSingle();
      existingSub = res.data;
    } catch (e) {}

    if (!existingSub) {
      const localSubs = localStore.getSubmissions(student_code);
      existingSub = localSubs.find((s: any) => s.course_id === course_id && s.project_name === project_name);
    }

    if (existingSub) {
      return NextResponse.json(
        { error: 'لقد قمت برفع هذا المشروع مسبقاً! لا يمكن إعادة الرفع إلا إذا قام أستاذ المقرر بإتاحة الرفع لك مجدداً.' },
        { status: 403 }
      );
    }

    // 2. معالجة ورفع الصور عبر محرك التخزين الصامت
    const studentFullName = student_name || studentRecord.full_name || 'طالب';
    const processedImages: any[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const rawBase64 = img.url || img.dataUrl || (typeof img === 'string' ? img : '');
      let finalUrl = rawBase64;

      if (rawBase64 && rawBase64.startsWith('data:image')) {
        const storagePath = `${studentRecord.id}/${course_id}/${encodeURIComponent(project_name)}_${Date.now()}_${i + 1}.webp`;
        const uploadRes = await uploadImageToStorage(
          rawBase64,
          `مشروع: ${project_name} - الطالب: ${studentFullName} (${student_code}) - صورة #${i + 1}`,
          undefined,
          undefined,
          storagePath
        );
        if (uploadRes.success && uploadRes.url) {
          finalUrl = uploadRes.url;
        }
      }

      processedImages.push({
        url: finalUrl,
        dhash: img.dhash || '',
        width: img.width || 1200,
        height: img.height || 900,
        orientation: img.orientation || 'portrait',
        timestamp: img.timestamp || new Date().toISOString(),
      });
    }

    const primaryPhotoUrl = processedImages[0]?.url || '';

    // 3. حفظ التسليم في جدول student_submissions
    let newSub: any = null;
    const subPayload = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      student_code,
      student_name: studentFullName,
      course_id,
      course_name,
      project_name,
      images: processedImages,
      status: 'pending_evaluation',
      score: null,
      created_at: new Date().toISOString(),
    };

    try {
      const res = await supabaseAdmin
        .from('student_submissions')
        .insert(subPayload)
        .select('*')
        .single();
      newSub = res.data;
    } catch (e) {}

    if (!newSub) {
      newSub = localStore.saveSubmission(subPayload);
    }

    // 4. الربط المباشر مع جدول evaluations في النظام الأساسي حتى يظهر العمل لأستاذ المقرر فوراً
    try {
      const { data: courseData } = await supabaseAdmin
        .from('courses')
        .select('teacher_id')
        .eq('id', course_id)
        .maybeSingle();

      // فحص ما إذا كان هناك تقييم سابق من أستاذ المقرر للاحتفاظ بدرجته
      const { data: existingEval } = await supabaseAdmin
        .from('evaluations')
        .select('score')
        .eq('course_id', course_id)
        .eq('student_id', studentRecord.id)
        .eq('project_name', project_name)
        .maybeSingle();

      const existingScore = (existingEval && existingEval.score !== null && existingEval.score !== undefined) ? existingEval.score : null;

      await supabaseAdmin.from('evaluations').upsert({
        course_id,
        student_id: studentRecord.id,
        project_name,
        score: existingScore,
        teacher_id: courseData?.teacher_id || null,
        photo_url: primaryPhotoUrl,
        ai_status: processedImages[0]?.dhash ? `hash:${processedImages[0].dhash}` : 'submitted_via_portal',
        created_at: new Date().toISOString()
      }, { onConflict: 'course_id,student_id,project_name' });
    } catch (evalErr) {
      console.warn('Evaluations upsert warning:', evalErr);
    }

    // 5. تسجيل العملية في سجل الأنشطة الأمني
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code,
        action: 'submit_project',
        device_id: device_info?.deviceId,
        user_agent: device_info?.userAgent,
        details: {
          course_name,
          project_name,
          photosCount: processedImages.length,
          photoUrl: primaryPhotoUrl,
          submittedAt: new Date().toISOString(),
        },
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: 'تم رفع العمل الفني بنجاح وهو الآن في انتظار التقييم!',
      submission: newSub,
    });
  } catch (err: any) {
    console.error('Submit project error:', err);
    return NextResponse.json({ error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
