import { supabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/telegramStorage';
import { localStore } from '@/lib/localFallbackStore';
import { checkAndNotifyPlagiarism } from '@/lib/plagiarismNotifier';
import { getStudentCodeVariants } from '@/lib/codeHelper';
import { isStudentEnrolledInCourse } from '@/lib/courseEnrollment';
import { getStudentSession, noStoreJson } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 4;

export async function POST(request: Request) {
  try {
    const session = getStudentSession(request);
    if (!session) {
      return noStoreJson({ error: 'انتهت جلستك. يرجى تسجيل الدخول مجدداً.' }, { status: 401 });
    }

    const body = await request.json();
    const { course_id, course_name, project_name, images, device_info, stage, stage_title } = body;

    if (
      typeof course_id !== 'string' ||
      !course_id ||
      course_id.length > 64 ||
      typeof project_name !== 'string' ||
      !project_name.trim() ||
      project_name.length > 200 ||
      !Array.isArray(images) ||
      images.length === 0 ||
      images.length > MAX_IMAGES
    ) {
      return noStoreJson(
        { error: 'بيانات الرفع غير مكتملة أو لم يتم التقاط صور للعمل الفني' },
        { status: 400 }
      );
    }

    const { data: studentRecord } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section')
      .in('student_code', getStudentCodeVariants(session.code))
      .maybeSingle();

    if (!studentRecord) {
      return noStoreJson({ error: 'الطالب غير مسجل في الكلية' }, { status: 404 });
    }

    const { data: courseRecord } = await supabaseAdmin
      .from('courses')
      .select('teacher_id, custom_week_names, academic_year, sections, excluded_students, makeup_students, student_section_overrides')
      .eq('id', course_id)
      .maybeSingle();

    if (!courseRecord) {
      return noStoreJson({ error: 'المقرر الدراسي غير موجود' }, { status: 404 });
    }

    if (!isStudentEnrolledInCourse(courseRecord, studentRecord)) {
      return noStoreJson({ error: 'هذا المقرر غير متاح لفرقتك أو سكشنك' }, { status: 403 });
    }

    for (const img of images) {
      const raw = typeof img === 'string' ? img : img?.url || img?.dataUrl;
      if (typeof raw !== 'string' || !raw.startsWith('data:image')) {
        return noStoreJson({ error: 'صيغة الصورة غير صالحة' }, { status: 400 });
      }
      if (raw.length > MAX_IMAGE_BYTES) {
        return noStoreJson({ error: 'حجم الصورة أكبر من الحد المسموح' }, { status: 413 });
      }
    }

    const projectsList = courseRecord?.custom_week_names?.__projects__ || [];
    const matchedProj = projectsList.find((p: any) => (p.name || p.title || '').trim() === project_name.trim());

    if (matchedProj) {
      if (matchedProj.portal_enabled === false || matchedProj.is_active === false) {
        return noStoreJson(
          { error: 'استقبال صور هذا المشروع عبر بوابة الطلاب غير مفعل حالياً من قِبل أستاذ المقرر.' },
          { status: 403 }
        );
      }

      const now = Date.now();
      if (matchedProj.multi_stage_enabled) {
        if (stage === 'stage2') {
          if (matchedProj.stage2_deadline && new Date(matchedProj.stage2_deadline).getTime() < now) {
            return noStoreJson(
              { error: 'انتهت المهلة المحددة لرفع المرحلة الثانية من هذا العمل الفني.' },
              { status: 403 }
            );
          }
        } else {
          if (matchedProj.stage1_deadline && new Date(matchedProj.stage1_deadline).getTime() < now) {
            return noStoreJson(
              { error: 'انتهت المهلة المحددة لرفع المرحلة الأولى من هذا العمل الفني.' },
              { status: 403 }
            );
          }
        }
      } else {
        const deadline = matchedProj.submission_deadline || matchedProj.end_date;
        if (deadline && new Date(deadline).getTime() < now) {
          return noStoreJson(
            { error: 'انتهت المهلة الزمنية المحددة لرفع صور هذا المشروع من أستاذ المقرر.' },
            { status: 403 }
          );
        }
      }
    }

    let existingSub: any = null;
    try {
      const res = await supabaseAdmin
        .from('student_submissions')
        .select('*')
        .eq('student_code', studentRecord.student_code)
        .eq('course_id', course_id)
        .eq('project_name', project_name)
        .maybeSingle();
      existingSub = res.data;
    } catch (e) {}

    if (!existingSub) {
      const localSubs = localStore.getSubmissions(studentRecord.student_code);
      existingSub = localSubs.find((s: any) => s.course_id === course_id && s.project_name === project_name);
    }

    const isMultiStage = !!matchedProj?.multi_stage_enabled;
    const isUploadingStage2 = isMultiStage && stage === 'stage2';

    if (existingSub) {
      if (!isMultiStage) {
        return noStoreJson(
          { error: 'لقد قمت برفع هذا المشروع مسبقاً! لا يمكن إعادة الرفع إلا إذا قام أستاذ المقرر بإتاحة الرفع لك مجدداً.' },
          { status: 403 }
        );
      }

      if (isUploadingStage2) {
        const existingImages = Array.isArray(existingSub.images) ? existingSub.images : [];
        const alreadyHasStage2 = existingImages.some((img: any) => img.stage === 'stage2');
        if (alreadyHasStage2) {
          return noStoreJson(
            { error: 'لقد قمت برفع المرحلة الثانية مسبقاً لهذا المشروع! لا يمكن إعادة الرفع.' },
            { status: 403 }
          );
        }
      } else {
        return noStoreJson(
          { error: 'لقد قمت برفع المرحلة الأولى لهذا المشروع مسبقاً! يمكنك الآن رفع المرحلة الثانية.' },
          { status: 403 }
        );
      }
    }

    const studentFullName = studentRecord.full_name || 'طالب';
    const processedImages: any[] = [];
    const effectiveStage = isMultiStage ? (stage || 'stage1') : undefined;
    const effectiveStageTitle = isMultiStage
      ? stage_title || (stage === 'stage2' ? matchedProj?.stage2_title || 'العمل النهائي' : matchedProj?.stage1_title || 'مرحلة التحضير')
      : undefined;

    for (let i = 0; i < images.length; i++) {
      const img = typeof images[i] === 'string' ? { url: images[i] } : images[i];
      const rawBase64 = img.url || img.dataUrl || '';
      let finalUrl = rawBase64;

      if (rawBase64 && rawBase64.startsWith('data:image')) {
        const stagePrefix = effectiveStage ? `_${effectiveStage}` : '';
        const storagePath = `${studentRecord.id}/${course_id}/${encodeURIComponent(project_name)}${stagePrefix}_${Date.now()}_${i + 1}.webp`;
        const uploadRes = await uploadImageToStorage(
          rawBase64,
          `مشروع: ${project_name} - ${effectiveStageTitle || ''} - الطالب: ${studentFullName} (${studentRecord.student_code}) - صورة #${i + 1}`,
          undefined,
          undefined,
          storagePath
        );
        if (uploadRes.success && uploadRes.url) {
          finalUrl = uploadRes.url;
        } else {
          return noStoreJson({ error: 'تعذر رفع الصور إلى السحابة. يرجى المحاولة مرة أخرى.' }, { status: 502 });
        }
      }

      processedImages.push({
        url: finalUrl,
        stage: effectiveStage,
        stage_title: effectiveStageTitle,
        dhash: img.dhash || '',
        width: img.width || 1200,
        height: img.height || 900,
        orientation: img.orientation || 'portrait',
        timestamp: img.timestamp || new Date().toISOString(),
      });
    }

    const primaryPhotoUrl = processedImages[0]?.url || '';
    let newSub: any = null;

    if (existingSub && isUploadingStage2) {
      const oldImgs = Array.isArray(existingSub.images) ? existingSub.images : [];
      const mergedImages = [...oldImgs, ...processedImages];
      try {
        const { data: updatedSub } = await supabaseAdmin
          .from('student_submissions')
          .update({
            images: mergedImages,
            status: 'pending_evaluation',
          })
          .eq('id', existingSub.id)
          .select('*')
          .single();
        newSub = updatedSub;
      } catch (e) {}

      if (!newSub) {
        newSub = { ...existingSub, images: mergedImages };
      }
    } else {
      const subPayload = {
        id: 'sub_' + Math.random().toString(36).substring(2, 9),
        student_code: studentRecord.student_code,
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
    }

    try {
      const { data: existingEval } = await supabaseAdmin
        .from('evaluations')
        .select('score')
        .eq('course_id', course_id)
        .eq('student_id', studentRecord.id)
        .eq('project_name', project_name)
        .maybeSingle();

      const existingScore =
        existingEval && existingEval.score !== null && existingEval.score !== undefined
          ? existingEval.score
          : null;

      await supabaseAdmin.from('evaluations').upsert(
        {
          course_id,
          student_id: studentRecord.id,
          project_name,
          score: existingScore,
          teacher_id: courseRecord?.teacher_id || null,
          photo_url: primaryPhotoUrl,
          ai_status: processedImages[0]?.dhash ? `hash:${processedImages[0].dhash}` : 'submitted_via_portal',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'course_id,student_id,project_name' }
      );
    } catch (evalErr) {
      console.warn('Evaluations upsert warning:', evalErr);
    }

    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: studentRecord.student_code,
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

    checkAndNotifyPlagiarism(
      {
        id: newSub?.id,
        student_code: studentRecord.student_code,
        student_name: studentFullName,
        course_id,
        course_name,
        project_name,
        images: processedImages,
        created_at: newSub?.created_at || new Date().toISOString(),
      },
      supabaseAdmin,
      80
    ).catch((err) => {
      console.warn('Background AI plagiarism detection warning:', err);
    });

    return noStoreJson({
      success: true,
      message: 'تم رفع العمل الفني بنجاح وهو الآن في انتظار التقييم!',
      submission: newSub,
    });
  } catch (err: any) {
    console.error('Submit project error:', err);
    return noStoreJson({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
