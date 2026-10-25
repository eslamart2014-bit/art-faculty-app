import { supabaseAdmin } from '@/lib/supabase';
import { getStudentCodeVariants } from '@/lib/codeHelper';
import { getStudentSession, noStoreJson } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = getStudentSession(request);
    if (!session) {
      return noStoreJson({ error: 'انتهت جلستك. يرجى تسجيل الدخول مجدداً.' }, { status: 401 });
    }

    const body = await request.json();
    const target_entity = String(body.target_entity || '').trim().slice(0, 100);
    const subject = String(body.subject || '').trim().slice(0, 200);
    const content = String(body.content || '').trim();

    if (!target_entity || !content) {
      return noStoreJson(
        { error: 'يرجى كتابة نص الشكوى واختيار الجهة الموجهة إليها' },
        { status: 400 }
      );
    }
    if (content.length > 5000) {
      return noStoreJson({ error: 'نص الشكوى أطول من الحد المسموح' }, { status: 400 });
    }

    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, student_code, full_name, academic_year')
      .in('student_code', getStudentCodeVariants(session.code))
      .maybeSingle();

    if (!student) {
      return noStoreJson({ error: 'لم يتم العثور على بيانات الطالب' }, { status: 404 });
    }

    const { data: complaint, error } = await supabaseAdmin
      .from('student_complaints')
      .insert({
        student_code: student.student_code,
        student_name: student.full_name,
        academic_year: student.academic_year,
        target_entity,
        subject: subject || 'شكوى / مقترح طلابي',
        content,
        status: 'جديدة',
      })
      .select('*')
      .single();

    if (error) {
      return noStoreJson({ error: 'تعذر حفظ الشكوى' }, { status: 500 });
    }

    try {
      await supabaseAdmin.from('suggestions_chat').insert({
        user_id: student.student_code,
        message: `📨 [شكوى/مقترح طلابي - ${target_entity}]:\nالطالب: ${student.full_name} (كود: ${student.student_code} - الفرقة: ${student.academic_year || 'غير محدد'})\n\n${content}`,
        is_admin: false,
        read_by_admin: false,
        read_by_user: true,
      });
    } catch (chatErr) {
      console.warn('Could not forward complaint to suggestions_chat:', chatErr);
    }

    try {
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', ['مدير', 'مدير مساعد', 'admin', 'أدمن']);

      if (admins && admins.length > 0) {
        const notifs = admins.map((adm: any) => ({
          user_id: adm.id,
          title: 'شكوى / مقترح طلابي جديد 📬',
          message: `وصلت شكوى جديدة من الطالب: ${student.full_name} (${student.student_code}) موجهة إلى: ${target_entity}.\nالموضوع: ${subject || 'شكوى / مقترح طلابي'}`,
        }));
        await supabaseAdmin.from('notifications').insert(notifs);
      }
    } catch (notifErr) {
      console.warn('Could not create admin notification for complaint:', notifErr);
    }

    return noStoreJson({
      success: true,
      message: 'تم إرسال الشكوى بنجاح وسيتم النظر فيها من قبل الجهة المختصة.',
      complaint,
    });
  } catch (err: any) {
    return noStoreJson({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
