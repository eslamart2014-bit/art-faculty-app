import { compareDHashes } from './imageCompressor';

export interface ImageItem {
  url: string;
  dhash?: string;
  stage?: string;
  stage_title?: string;
  [key: string]: any;
}

export interface PlagiarismSubmission {
  id?: string;
  student_code: string;
  student_name: string;
  course_id: string;
  course_name?: string;
  project_name: string;
  images: ImageItem[];
  created_at?: string;
}

export interface MatchCandidate {
  id: string;
  student_code: string;
  student_name: string;
  course_id?: string;
  course_name: string;
  project_name: string;
  images: ImageItem[];
  created_at: string;
}

function normalizeImgUrl(url: string | undefined): string {
  if (!url) return '';
  const u = url.trim();
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image/') || u.startsWith('/')) {
    return u;
  }
  if (/^AgAC[A-Za-z0-9_\-]+$/.test(u)) {
    return `/api/media/${u}`;
  }
  return u;
}

function extractTelegramFileId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/media\/([A-Za-z0-9_\-]+)/);
  if (match) return match[1];
  if (/^AgAC[A-Za-z0-9_\-]+$/.test(url)) return url;
  return null;
}

function formatCairoDateTime(dateStr?: string): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleString('ar-EG', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateStr || 'الآن';
  }
}

/**
 * إرسال إشعار التليجرام بالصورتين المتطابقتين وكافة بيانات الطالبين
 */
export async function sendPlagiarismTelegramAlert(
  token: string,
  chatId: string,
  payload: {
    student1: { name: string; code: string; course?: string; project?: string; imageUrl: string; submittedAt?: string };
    student2: { name: string; code: string; course?: string; project?: string; imageUrl: string; submittedAt?: string };
    similarity: number;
    hammingDistance?: number;
    tierLabel?: string;
    reason?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { student1, student2, similarity, hammingDistance, tierLabel, reason } = payload;
    const hamming = hammingDistance ?? Math.round(64 * (1 - similarity / 100));
    const tier = tierLabel || (similarity >= 90 ? '🚨 تطابق مؤكد (90% - 100%)' : `⚠️ اشتباه مرتفع (${similarity}%)`);

    const captionHtml =
      `🚨 <b>تنبيه أمني: كشف تشابه لوحات فنية (AI) بنسبة ${similarity}%!</b>\n` +
      `🎯 <b>مستوى الدقة:</b> ${tier}\n` +
      `📏 <b>مسافة هامد:</b> ${hamming} بت / 64 بت\n\n` +
      `📚 <b>المقرر:</b> ${student1.course || student2.course || 'مقرر دراسي'}\n` +
      `📝 <b>المشروع:</b> ${student1.project || student2.project || 'مشروع فني'}\n\n` +
      `👨‍🎓 <b>العمل (1) - المرفوع حديثاً:</b>\n` +
      `• <b>الاسم:</b> ${student1.name}\n` +
      `• <b>الكود الجامعي:</b> <code>${student1.code}</code>\n` +
      `• <b>تاريخ الرفع:</b> ${student1.submittedAt || 'الآن'}\n\n` +
      `👨‍🎓 <b>العمل (2) - العمل السابق المتطابق:</b>\n` +
      `• <b>الاسم:</b> ${student2.name}\n` +
      `• <b>الكود الجامعي:</b> <code>${student2.code}</code>\n` +
      (student2.course && student2.course !== student1.course ? `• <b>المقرر:</b> ${student2.course}\n` : '') +
      `• <b>تاريخ الرفع:</b> ${student2.submittedAt || 'سابقاً'}\n\n` +
      `🔍 <b>تشخيص الـ AI:</b>\n` +
      `${reason || `تطابق بصمة بصرية (dHash) بنسبة ${similarity}%`}\n\n` +
      `⚠️ <i>تم توثيق الحالة تلقائياً ويمكنك مراجعة العملين ومقارنتهما في لوحة الإدارة.</i>`;

    const fId1 = extractTelegramFileId(student1.imageUrl);
    const fId2 = extractTelegramFileId(student2.imageUrl);

    // تجهيز صور الإرسال
    // تليجرام يقبل إما file_id أو رابط مباشر HTTP/HTTPS
    const mediaItem1 = fId1 || (student1.imageUrl?.startsWith('http') ? student1.imageUrl : null);
    const mediaItem2 = fId2 || (student2.imageUrl?.startsWith('http') ? student2.imageUrl : null);

    // 1. المحاولة الأولى: إرسال ألبوم SendMediaGroup يضم الصورتين معاً وشرح كامل
    if (mediaItem1 && mediaItem2) {
      try {
        const mediaGroup = [
          {
            type: 'photo',
            media: mediaItem1,
            caption: captionHtml,
            parse_mode: 'HTML',
          },
          {
            type: 'photo',
            media: mediaItem2,
          },
        ];

        const mgRes = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            media: mediaGroup,
          }),
        });

        const mgData = await mgRes.json();
        if (mgData.ok) {
          return { success: true };
        }
        console.warn('sendMediaGroup returned error, falling back to sequential photos:', mgData);
      } catch (mgErr: any) {
        console.warn('sendMediaGroup failed, falling back:', mgErr?.message);
      }
    }

    // 2. المحاولة الثانية البديلة: إرسال كل صورة منفردة
    if (mediaItem1) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: mediaItem1,
            caption: captionHtml,
            parse_mode: 'HTML',
          }),
        });

        if (mediaItem2) {
          await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              photo: mediaItem2,
              caption: `🖼️ <b>العمل الثاني المقارن:</b> ${student2.name} (كود: <code>${student2.code}</code>)`,
              parse_mode: 'HTML',
            }),
          });
        }
        return { success: true };
      } catch (spErr: any) {
        console.warn('sendPhoto fallback failed:', spErr?.message);
      }
    }

    // 3. المحاولة الثالثة الاحتياطية: إرسال رسالة نصية كاملة في حال تعذر إرسال الصور
    const textRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: captionHtml,
        parse_mode: 'HTML',
      }),
    });
    const textData = await textRes.json();
    return { success: textData.ok, error: textData.description };
  } catch (err: any) {
    console.error('sendPlagiarismTelegramAlert exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * فحص التشابه في الخلفية وإرسال الإشعار تلقائياً إذا تجاوزت النسبة 80%
 */
export async function checkAndNotifyPlagiarism(
  newSub: PlagiarismSubmission,
  supabase: any,
  minThreshold = 80
): Promise<{ detected: boolean; similarity?: number; match?: any; notifiedChats?: string[]; error?: string }> {
  try {
    if (!newSub.images || newSub.images.length === 0) {
      return { detected: false };
    }

    // تجهيز الصور الخاصة بالعمل المرفوع حالياً
    const currentImgs = newSub.images.map(img => ({
      ...img,
      url: normalizeImgUrl(img.url),
      dhash: (img.dhash || '').replace(/^hash:/i, '').trim(),
    }));

    const hasAnyHashOrUrl = currentImgs.some(img => img.dhash || img.url);
    if (!hasAnyHashOrUrl) {
      return { detected: false };
    }

    // جلب اسم المقرر إن لم يكن متوفراً
    let courseName = newSub.course_name;
    if (!courseName && newSub.course_id) {
      try {
        const { data: cData } = await supabase
          .from('courses')
          .select('name')
          .eq('id', newSub.course_id)
          .maybeSingle();
        if (cData?.name) courseName = cData.name;
      } catch (e) {}
    }
    courseName = courseName || 'مقرر دراسي';

    // 1. جلب التسليمات السابقة من student_submissions لباقي الطلاب
    const candidates: MatchCandidate[] = [];
    try {
      const { data: pastSubs } = await supabase
        .from('student_submissions')
        .select('id, student_code, student_name, course_id, course_name, project_name, images, created_at')
        .neq('student_code', newSub.student_code)
        .order('created_at', { ascending: false })
        .limit(300);

      if (pastSubs && pastSubs.length > 0) {
        pastSubs.forEach((ps: any) => {
          candidates.push({
            id: ps.id,
            student_code: ps.student_code,
            student_name: ps.student_name || 'طالب',
            course_id: ps.course_id,
            course_name: ps.course_name || 'مقرر دراسي',
            project_name: ps.project_name || 'مشروع',
            images: Array.isArray(ps.images)
              ? ps.images.map((img: any) => ({
                  url: normalizeImgUrl(img.url),
                  dhash: (img.dhash || '').replace(/^hash:/i, '').trim(),
                }))
              : [],
            created_at: ps.created_at,
          });
        });
      }
    } catch (e) {}

    // 2. جلب التسليمات من evaluations أيضاً للتأكد من شمول كافة الأعمال
    try {
      const { data: pastEvals } = await supabase
        .from('evaluations')
        .select('id, course_id, project_name, photo_url, ai_status, created_at, students(full_name, student_code)')
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (pastEvals && pastEvals.length > 0) {
        pastEvals.forEach((pe: any) => {
          const sCode = pe.students?.student_code;
          if (sCode && sCode !== newSub.student_code) {
            // تجنب التكرار إذا كان موجوداً في candidates
            if (!candidates.some(c => c.student_code === sCode && c.project_name === pe.project_name)) {
              candidates.push({
                id: pe.id,
                student_code: sCode,
                student_name: pe.students?.full_name || 'طالب',
                course_id: pe.course_id,
                course_name: 'مقرر دراسي',
                project_name: pe.project_name || 'مشروع',
                images: [
                  {
                    url: normalizeImgUrl(pe.photo_url),
                    dhash: (pe.ai_status || '').replace(/^hash:/i, '').split('|')[0].trim(),
                  },
                ],
                created_at: pe.created_at,
              });
            }
          }
        });
      }
    } catch (e) {}

    if (candidates.length === 0) {
      return { detected: false };
    }

    // 3. مقارنة العمل المرفوع مع كل الأعمال السابقة
    let highestSimilarity = 0;
    let bestMatchCandidate: MatchCandidate | null = null;
    let matchedNewImgUrl = currentImgs[0]?.url || '';
    let matchedCandImgUrl = '';
    let matchReason = '';

    for (const cand of candidates) {
      if (!cand.images || cand.images.length === 0) continue;

      for (const curImg of currentImgs) {
        for (const candImg of cand.images) {
          // مقارنة dHash
          if (curImg.dhash && candImg.dhash) {
            const { similarityPercent } = compareDHashes(curImg.dhash, candImg.dhash);
            if (similarityPercent > highestSimilarity) {
              highestSimilarity = similarityPercent;
              bestMatchCandidate = cand;
              matchedNewImgUrl = curImg.url;
              matchedCandImgUrl = candImg.url;
              matchReason = `تطابق بصمة بصرية (dHash) بنسبة ${similarityPercent}%`;
            }
          }

          // فحص تطابق رابط وملف الصورة بالكامل
          if (curImg.url && candImg.url && curImg.url === candImg.url) {
            highestSimilarity = 100;
            bestMatchCandidate = cand;
            matchedNewImgUrl = curImg.url;
            matchedCandImgUrl = candImg.url;
            matchReason = 'تطابق تام في رابط وملف الصورة المرفوعة (نفس الملف)';
            break;
          }
        }
        if (highestSimilarity === 100) break;
      }
      if (highestSimilarity === 100) break;
    }

    // إذا كانت نسبة التشابه أقل من العتبة المحددة (80%) -> لا يوجد تشابه
    if (highestSimilarity < minThreshold || !bestMatchCandidate) {
      return { detected: false, similarity: highestSimilarity };
    }

    // 4. تم اكتشاف تشابه مؤكد أو مرتفع! إرسال إشعار فوري للتليجرام
    const defaultToken = process.env.TELEGRAM_BOT_TOKEN || '8940498495:AAHW-9wI1PtFDxRHIneQZnrCiQdP5w80gRk';
    let token = defaultToken;
    const targetChatIds = new Set<string>();

    // Chat ID الافتراضي للمسؤول الأساسي
    targetChatIds.add('7822224849');

    // جلب توكن وإعدادات التليجرام والمشرفين
    try {
      const { data: sysData } = await supabase
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 1)
        .maybeSingle();

      if (sysData?.telegram_config) {
        const cfg = sysData.telegram_config;
        if (cfg.token) token = cfg.token;
        if (cfg.media_chat_id) targetChatIds.add(String(cfg.media_chat_id).trim());
      }
    } catch (e) {}

    // جلب أي مدير لديه telegram_id
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('telegram_id')
        .eq('role', 'مدير')
        .not('telegram_id', 'is', null);

      if (admins && admins.length > 0) {
        admins.forEach((adm: any) => {
          if (adm.telegram_id) targetChatIds.add(String(adm.telegram_id).trim());
        });
      }
    } catch (e) {}

    const hammingDist = Math.round(64 * (1 - highestSimilarity / 100));
    const tierLabel = highestSimilarity >= 90 ? '🚨 تطابق مؤكد (90% - 100%)' : `⚠️ اشتباه مرتفع (${highestSimilarity}%)`;

    const alertPayload = {
      student1: {
        name: newSub.student_name,
        code: newSub.student_code,
        course: courseName,
        project: newSub.project_name,
        imageUrl: matchedNewImgUrl,
        submittedAt: formatCairoDateTime(newSub.created_at),
      },
      student2: {
        name: bestMatchCandidate.student_name,
        code: bestMatchCandidate.student_code,
        course: bestMatchCandidate.course_name,
        project: bestMatchCandidate.project_name,
        imageUrl: matchedCandImgUrl,
        submittedAt: formatCairoDateTime(bestMatchCandidate.created_at),
      },
      similarity: highestSimilarity,
      hammingDistance: hammingDist,
      tierLabel,
      reason: matchReason,
    };

    const notifiedList: string[] = [];
    for (const cid of targetChatIds) {
      if (!cid || cid === 'null' || cid === 'undefined') continue;
      const res = await sendPlagiarismTelegramAlert(token, cid, alertPayload);
      if (res.success) {
        notifiedList.push(cid);
      }
    }

    // 5. تسجيل العملية في سجل الأنشطة الأمني portal_audit_logs
    try {
      await supabase.from('portal_audit_logs').insert({
        student_code: newSub.student_code,
        action: 'ai_plagiarism_alert_triggered',
        details: {
          similarity: highestSimilarity,
          hammingDistance: hammingDist,
          student1: alertPayload.student1,
          student2: alertPayload.student2,
          notified_chat_ids: notifiedList,
          created_at: new Date().toISOString(),
        },
      });
    } catch (logErr) {
      console.warn('Failed to insert plagiarism audit log:', logErr);
    }

    return {
      detected: true,
      similarity: highestSimilarity,
      match: bestMatchCandidate,
      notifiedChats: notifiedList,
    };
  } catch (error: any) {
    console.error('checkAndNotifyPlagiarism error:', error);
    return { detected: false, error: error.message };
  }
}

/**
 * إرسال إشعار يدوي عند طلب الأدمن من واجهة كشف التطابق
 */
export async function sendManualPlagiarismAlert(
  data: {
    student1: { name: string; code: string; course?: string; project?: string; imageUrl: string; submittedAt?: string };
    student2: { name: string; code: string; course?: string; project?: string; imageUrl: string; submittedAt?: string };
    similarity: number;
    hammingDistance?: number;
    reason?: string;
  },
  supabase: any
): Promise<{ success: boolean; notifiedChats?: string[]; error?: string }> {
  try {
    const defaultToken = process.env.TELEGRAM_BOT_TOKEN || '8940498495:AAHW-9wI1PtFDxRHIneQZnrCiQdP5w80gRk';
    let token = defaultToken;
    const targetChatIds = new Set<string>();
    targetChatIds.add('7822224849');

    try {
      const { data: sysData } = await supabase
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 1)
        .maybeSingle();

      if (sysData?.telegram_config) {
        const cfg = sysData.telegram_config;
        if (cfg.token) token = cfg.token;
        if (cfg.media_chat_id) targetChatIds.add(String(cfg.media_chat_id).trim());
      }
    } catch (e) {}

    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('telegram_id')
        .eq('role', 'مدير')
        .not('telegram_id', 'is', null);

      if (admins && admins.length > 0) {
        admins.forEach((adm: any) => {
          if (adm.telegram_id) targetChatIds.add(String(adm.telegram_id).trim());
        });
      }
    } catch (e) {}

    const notifiedList: string[] = [];
    for (const cid of targetChatIds) {
      if (!cid || cid === 'null' || cid === 'undefined') continue;
      const res = await sendPlagiarismTelegramAlert(token, cid, {
        ...data,
        tierLabel: data.similarity >= 90 ? '🚨 تطابق مؤكد (90% - 100%)' : `⚠️ اشتباه مرتفع (${data.similarity}%)`,
      });
      if (res.success) notifiedList.push(cid);
    }

    return { success: notifiedList.length > 0, notifiedChats: notifiedList };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
