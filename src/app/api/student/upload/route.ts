import { supabaseAdmin } from '@/lib/supabase';
import { checkAndNotifyPlagiarism } from '@/lib/plagiarismNotifier';
import { getStudentCodeVariants } from '@/lib/codeHelper';
import { isStudentEnrolledInCourse } from '@/lib/courseEnrollment';
import { getStudentSession, noStoreJson } from '@/lib/serverAuth';
import { verifyTelegramInitData } from '@/lib/telegramAuth';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('sendTelegramMessage error:', e);
  }
}

function calculateSimilarity(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;
  let match = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) match++;
  }
  return Math.round((match / hash1.length) * 100);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { photo, stuId, crsId, projId, imageHash, initData } = body;

    if (
      typeof stuId !== 'string' ||
      !stuId ||
      stuId.length > 64 ||
      typeof crsId !== 'string' ||
      !crsId ||
      crsId.length > 64 ||
      typeof projId !== 'string' ||
      !projId ||
      projId.length > 200 ||
      typeof photo !== 'string'
    ) {
      return noStoreJson({ error: 'بيانات الرفع غير مكتملة' }, { status: 400 });
    }

    const match = photo.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) {
      return noStoreJson({ error: 'صيغة الصورة غير صالحة' }, { status: 400 });
    }

    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
      return noStoreJson({ error: 'حجم الصورة غير مسموح' }, { status: 413 });
    }

    const { data: currentStudent } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section, telegram_id, is_active')
      .eq('id', stuId)
      .maybeSingle();

    if (!currentStudent || currentStudent.is_active === false) {
      return noStoreJson({ error: 'الطالب غير مسجل أو حسابه غير نشط' }, { status: 403 });
    }

    const session = getStudentSession(request);
    const sessionOwnsStudent =
      !!session &&
      (session.code === currentStudent.student_code ||
        getStudentCodeVariants(session.code).includes(currentStudent.student_code) ||
        getStudentCodeVariants(currentStudent.student_code).includes(session.code));

    let staffTelegramProfile: { id: string; role: string } | null = null;

    if (!sessionOwnsStudent) {
      let telegramUser = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
      if (!telegramUser) {
        const { data: settings } = await supabaseAdmin
          .from('system_settings')
          .select('telegram_config')
          .eq('id', 1)
          .maybeSingle();
        const configuredToken = settings?.telegram_config?.token;
        if (configuredToken) {
          telegramUser = verifyTelegramInitData(initData, String(configuredToken));
        }
      }
      const telegramOwnsStudent =
        !!telegramUser &&
        !!currentStudent.telegram_id &&
        String(currentStudent.telegram_id) === telegramUser.id;

      if (!telegramOwnsStudent) {
        // Offline camera mode: a staff member scans a student card inside Telegram.
        if (telegramUser) {
          const { data: staffProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, role, is_active')
            .eq('telegram_id', telegramUser.id)
            .maybeSingle();
          if (
            staffProfile &&
            staffProfile.is_active !== false &&
            ['مدير', 'مدير مساعد', 'admin', 'أدمن', 'عضو هيئة تدريس', 'معلم'].includes(String(staffProfile.role))
          ) {
            staffTelegramProfile = { id: staffProfile.id, role: String(staffProfile.role) };
          }
        }
        if (!staffTelegramProfile) {
          return noStoreJson({ error: 'غير مصرح برفع العمل لهذا الطالب' }, { status: 401 });
        }
      }
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, name, academic_year, course_type, sections, custom_week_names, teacher_id, shared_with, excluded_students, makeup_students, student_section_overrides')
      .eq('id', crsId)
      .maybeSingle();

    if (!course || courseError) {
      return noStoreJson({ error: 'المقرر الدراسي غير موجود' }, { status: 404 });
    }

    if (staffTelegramProfile) {
      const staffIsAdmin = ['مدير', 'مدير مساعد', 'admin', 'أدمن'].includes(staffTelegramProfile.role);
      const ownsCourse =
        course.teacher_id === staffTelegramProfile.id ||
        (Array.isArray(course.shared_with) && course.shared_with.includes(staffTelegramProfile.id));
      if (!staffIsAdmin && !ownsCourse) {
        return noStoreJson({ error: 'غير مصرح برفع العمل لهذا المقرر' }, { status: 403 });
      }
    }

    if (!isStudentEnrolledInCourse(course, currentStudent)) {
      return noStoreJson({ error: 'هذا المقرر غير متاح لفرقتك أو سكشنك' }, { status: 403 });
    }

    const projects = (course?.custom_week_names as any)?.__projects__ || [];
    const project = projects.find((p: any) => p.id === projId);
    if (!project) {
      return noStoreJson({ error: 'المشروع المطلوب غير متاح في هذا المقرر' }, { status: 404 });
    }
    if (project.portal_enabled === false || project.is_active === false) {
      return noStoreJson({ error: 'استقبال صور هذا المشروع غير مفعل حالياً' }, { status: 403 });
    }
    const projectName = project.name || project.title || 'مشروع';

    const base64Data = match[1].replace(/\s/g, '');
    const fileName = `${currentStudent.id}/${crsId}/${projId}_${Date.now()}.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('artworks')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message);
      return noStoreJson({ error: 'فشل رفع الصورة إلى السحابة' }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('artworks').getPublicUrl(fileName);
    const photoUrl = publicUrlData.publicUrl;

    let maxSimilarity = 0;

    if (typeof imageHash === 'string' && imageHash) {
      const { data: existingEvals } = await supabaseAdmin
        .from('evaluations')
        .select('id, student_id, ai_status, created_at, photo_url, students ( full_name, student_code )')
        .eq('course_id', crsId)
        .eq('project_name', projectName)
        .neq('student_id', currentStudent.id);

      if (existingEvals && existingEvals.length > 0) {
        for (const ev of existingEvals) {
          let prevHash = '';
          if (ev.ai_status && ev.ai_status.startsWith('hash:')) {
            prevHash = ev.ai_status.replace('hash:', '').split('|')[0];
          }

          if (prevHash) {
            const sim = calculateSimilarity(imageHash, prevHash);
            if (sim > maxSimilarity) {
              maxSimilarity = sim;
            }
          }
        }
      }
    }

    const { data: existingEval } = await supabaseAdmin
      .from('evaluations')
      .select('score')
      .eq('course_id', crsId)
      .eq('student_id', currentStudent.id)
      .eq('project_name', projectName)
      .maybeSingle();

    const preservedScore =
      existingEval && existingEval.score !== null && existingEval.score !== undefined
        ? existingEval.score
        : null;

    const aiStatusPayload = typeof imageHash === 'string' && imageHash ? `hash:${imageHash}|sim:${maxSimilarity}` : 'pending';

    const evaluationPayload: any = {
      course_id: crsId,
      student_id: currentStudent.id,
      project_name: projectName,
      score: preservedScore,
      teacher_id: course?.teacher_id || null,
      photo_url: photoUrl,
      ai_status: aiStatusPayload,
    };

    const { error: dbError } = await supabaseAdmin
      .from('evaluations')
      .upsert(evaluationPayload, { onConflict: 'course_id,student_id,project_name' });

    if (dbError) {
      console.warn('DB Upsert warning, falling back:', dbError.message);
      await supabaseAdmin.from('evaluations').upsert(
        {
          course_id: crsId,
          student_id: currentStudent.id,
          project_name: projectName,
          score: preservedScore,
          teacher_id: course?.teacher_id || null,
        },
        { onConflict: 'course_id,student_id,project_name' }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && currentStudent?.telegram_id) {
      const cairoDate = new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric' });
      const cairoTime = new Date().toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' });
      const studentMsg =
        `✅ <b>تم استلام وتوثيق عملك بنجاح!</b>\n\n` +
        `📚 <b>المقرر:</b> ${course?.name || 'المقرر'}\n` +
        `📝 <b>المشروع:</b> ${projectName}\n` +
        `⏱️ <b>وقت الرفع:</b> ${cairoTime} (${cairoDate})\n\n` +
        `⏳ <i>حالة العمل: بانتظار مراجعة وتقييم أستاذ المقرر. يمكنك متابعة أعمالك عبر زر (معرض أعمالي).</i>`;

      sendTelegramMessage(botToken, currentStudent.telegram_id, studentMsg);
    }

    checkAndNotifyPlagiarism(
      {
        student_code: currentStudent.student_code,
        student_name: currentStudent.full_name,
        course_id: crsId,
        course_name: course?.name,
        project_name: projectName,
        images: [{ url: photoUrl, dhash: imageHash || '' }],
        created_at: new Date().toISOString(),
      },
      supabaseAdmin,
      80
    ).catch((err) => {
      console.warn('Background AI plagiarism detection warning:', err);
    });

    return noStoreJson({ success: true, photoUrl });
  } catch (err: any) {
    console.error('Unexpected upload error:', err);
    return noStoreJson({ error: 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
