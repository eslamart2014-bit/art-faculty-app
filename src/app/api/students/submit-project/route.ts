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
    } = body;

    if (!student_code || !course_id || !project_name || !images || images.length === 0) {
      return NextResponse.json(
        { error: 'بيانات الرفع غير مكتملة أو لم يتم التقاط صور للعمل الفني' },
        { status: 400 }
      );
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
    const processedImages: any[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      let finalUrl = img.dataUrl;

      if (img.dataUrl && img.dataUrl.startsWith('data:image')) {
        const uploadRes = await uploadImageToStorage(
          img.dataUrl,
          `مشروع: ${project_name} - الطالب: ${student_name} (${student_code}) - صورة #${i + 1}`
        );
        if (uploadRes.success) {
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

    // 3. حفظ التسليم في جدول student_submissions
    let newSub: any = null;
    const subPayload = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      student_code,
      student_name,
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

    // 4. تسجيل العملية في سجل الأنشطة الأمني
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
