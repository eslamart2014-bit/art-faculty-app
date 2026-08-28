import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { photo, stuId, crsId, projId } = body;

    if (!photo || !stuId || !crsId || !projId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch course details to get project_name & teacher_id
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("custom_week_names, teacher_id")
      .eq("id", crsId)
      .maybeSingle();

    if (courseError) {
      console.error("Error fetching course:", courseError);
    }

    const projects = (course?.custom_week_names as any)?.__projects__ || [];
    const project = projects.find((p: any) => p.id === projId);
    const projectName = project ? project.name : "مشروع";

    // 2. Convert base64 data to Buffer
    const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `${stuId}/${crsId}/${projId}_${Date.now()}.jpg`;

    // 3. Upload to Supabase Storage (artworks bucket)
    const { data: uploadData, error: uploadError } = await supabase.storage
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

    // 5. Upsert into evaluations table (Handling both with/without photo_url column gracefully)
    const evaluationPayload: any = {
      course_id: crsId,
      student_id: stuId,
      project_name: projectName,
      score: 0, // Default to 0 until teacher grades
      teacher_id: course?.teacher_id || null,
    };

    // Try insert with photo_url first
    let dbError = null;
    const { error: errWithPhoto } = await supabase
      .from("evaluations")
      .upsert({
        ...evaluationPayload,
        photo_url: photoUrl,
        ai_status: "pending",
      }, { onConflict: "course_id,student_id,project_name" });

    if (errWithPhoto) {
      console.warn("Could not insert with photo_url (column might not exist yet), falling back to standard payload:", errWithPhoto.message);
      // Fallback to basic columns if photo_url column hasn't been added yet
      const { error: errBasic } = await supabase
        .from("evaluations")
        .upsert(evaluationPayload, { onConflict: "course_id,student_id,project_name" });
      
      dbError = errBasic;
    }

    if (dbError) {
      console.error("Database insert error:", dbError);
      return NextResponse.json({ error: "فشل حفظ بيانات التقييم: " + dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, photoUrl });
  } catch (err: any) {
    console.error("Unexpected upload error:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ غير متوقع" }, { status: 500 });
  }
}
