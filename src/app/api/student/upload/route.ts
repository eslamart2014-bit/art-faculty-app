import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAndNotifyPlagiarism } from "@/lib/plagiarismNotifier";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string, replyMarkup: any = null) {
  try {
    const body: any = { chat_id: chatId, text: text, parse_mode: "HTML" };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("sendTelegramMessage error:", e);
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
    const { photo, stuId, crsId, projId, imageHash } = body;

    if (!photo || !stuId || !crsId || !projId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch Telegram Bot Token
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // 1. Fetch current student details & verify active status
    const { data: currentStudent } = await supabase
      .from("students")
      .select("id, full_name, student_code, academic_year, section, telegram_id, is_active")
      .eq("id", stuId)
      .maybeSingle();

    if (!currentStudent || currentStudent.is_active === false) {
      return NextResponse.json({ error: "الطالب غير مسجل أو حسابه غير نشط" }, { status: 403 });
    }

    // 2. Fetch course details & verify student eligibility
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, name, academic_year, course_type, sections, custom_week_names, teacher_id")
      .eq("id", crsId)
      .maybeSingle();

    if (!course || courseError) {
      return NextResponse.json({ error: "المقرر الدراسي غير موجود" }, { status: 404 });
    }

    // HIGH-3 FIX: Prevent uploading to another student's/year's courses
    if (course.academic_year !== currentStudent.academic_year) {
      return NextResponse.json({ error: "الطالب غير مقيد بالفرقة الدراسية لهذا المقرر" }, { status: 403 });
    }
    if (course.course_type === 'sections' && Array.isArray(course.sections) && course.sections.length > 0) {
      if (!course.sections.includes(currentStudent.section)) {
        return NextResponse.json({ error: "المقرر غير متاح لسكشن الطالب" }, { status: 403 });
      }
    }

    const projects = (course?.custom_week_names as any)?.__projects__ || [];
    const project = projects.find((p: any) => p.id === projId);
    if (!project) {
      return NextResponse.json({ error: "المشروع المطلوب غير متاح في هذا المقرر" }, { status: 404 });
    }
    const projectName = project.name || "مشروع";

    // 3. Convert base64 data to Buffer and upload
    const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadTimestamp = Date.now();
    const fileName = `${stuId}/${crsId}/${projId}_${uploadTimestamp}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("artworks")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "فشل رفع الصورة إلى السحابة: " + uploadError.message }, { status: 500 });
    }

    // 4. Get Public URL
    const { data: publicUrlData } = supabase.storage.from("artworks").getPublicUrl(fileName);
    const photoUrl = publicUrlData.publicUrl;

    // 5. Similarity / Plagiarism Detection (>90%)
    let maxSimilarity = 0;
    let matchedStudentInfo: any = null;

    if (imageHash) {
      // Fetch existing evaluations for this course and project
      const { data: existingEvals } = await supabase
        .from("evaluations")
        .select("id, student_id, ai_status, created_at, photo_url, students ( full_name, student_code )")
        .eq("course_id", crsId)
        .eq("project_name", projectName)
        .neq("student_id", stuId);

      if (existingEvals && existingEvals.length > 0) {
        for (const ev of existingEvals) {
          // ai_status may store `hash:XXXXX` or JSON
          let prevHash = "";
          if (ev.ai_status && ev.ai_status.startsWith("hash:")) {
            prevHash = ev.ai_status.replace("hash:", "").split("|")[0];
          }

          if (prevHash) {
            const sim = calculateSimilarity(imageHash, prevHash);
            if (sim > maxSimilarity) {
              maxSimilarity = sim;
              matchedStudentInfo = {
                student: ev.students,
                uploadTime: new Date(ev.created_at).toLocaleString("ar-EG"),
                photoUrl: ev.photo_url,
              };
            }
          }
        }
      }
    }

    // Store hash inside ai_status: `hash:HASH|sim:MAXSIM`
    const aiStatusPayload = imageHash ? `hash:${imageHash}|sim:${maxSimilarity}` : "pending";

    // 6. Upsert into evaluations table
    const evaluationPayload: any = {
      course_id: crsId,
      student_id: stuId,
      project_name: projectName,
      score: 0,
      teacher_id: course?.teacher_id || null,
      photo_url: photoUrl,
      ai_status: aiStatusPayload,
    };

    const { error: dbError } = await supabase
      .from("evaluations")
      .upsert(evaluationPayload, { onConflict: "course_id,student_id,project_name" });

    if (dbError) {
      // Fallback if photo_url / ai_status column not yet ready
      console.warn("DB Upsert warning, falling back:", dbError.message);
      await supabase.from("evaluations").upsert({
        course_id: crsId,
        student_id: stuId,
        project_name: projectName,
        score: 0,
        teacher_id: course?.teacher_id || null,
      }, { onConflict: "course_id,student_id,project_name" });
    }

    // 7. Instant Student Confirmation via Telegram
    if (botToken && currentStudent?.telegram_id) {
      const cairoDate = new Date().toLocaleDateString("ar-EG", { timeZone: "Africa/Cairo", year: "numeric", month: "numeric", day: "numeric" });
      const cairoTime = new Date().toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" });
      const studentMsg = `✅ <b>تم استلام وتوثيق عملك بنجاح!</b>\n\n` +
        `📚 <b>المقرر:</b> ${course?.name || "المقرر"}\n` +
        `📝 <b>المشروع:</b> ${projectName}\n` +
        `⏱️ <b>وقت الرفع:</b> ${cairoTime} (${cairoDate})\n\n` +
        `⏳ <i>حالة العمل: بانتظار مراجعة وتقييم أستاذ المقرر. يمكنك متابعة أعمالك عبر زر (معرض أعمالي).</i>`;

      sendTelegramMessage(botToken, currentStudent.telegram_id, studentMsg);
    }

    // 8. تشغيل محرك كشف التطابق بالذكاء الاصطناعي وإرسال الصورتين والتفاصيل لبوت التليجرام في الخلفية
    checkAndNotifyPlagiarism(
      {
        student_code: currentStudent.student_code,
        student_name: currentStudent.full_name,
        course_id: crsId,
        course_name: course?.name,
        project_name: projectName,
        images: [
          {
            url: photoUrl,
            dhash: imageHash || "",
          },
        ],
        created_at: new Date().toISOString(),
      },
      supabase,
      80
    ).catch(err => {
      console.warn("Background AI plagiarism detection warning:", err);
    });

    return NextResponse.json({ success: true, photoUrl });
  } catch (err: any) {
    console.error("Unexpected upload error:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ غير متوقع" }, { status: 500 });
  }
}
