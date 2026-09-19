import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const {
      student_code,
      student_name,
      academic_year,
      target_entity,
      subject,
      content,
    } = await request.json();

    if (!student_code || !target_entity || !content) {
      return NextResponse.json(
        { error: 'يرجى كتابة نص الشكوى واختيار الجهة الموجهة إليها' },
        { status: 400 }
      );
    }

    const { data: complaint, error } = await supabaseAdmin
      .from('student_complaints')
      .insert({
        student_code,
        student_name,
        academic_year,
        target_entity,
        subject: subject || 'شكوى / مقترح طلابي',
        content,
        status: 'جديدة',
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. ترحيل الشكوى إلى صندوق المقترحات والمحادثات (suggestions_chat) ليراها الأدمن مباشرة
    try {
      await supabaseAdmin.from('suggestions_chat').insert({
        user_id: student_code,
        message: `📨 [شكوى/مقترح طلابي - ${target_entity}]:\nالطالب: ${student_name} (كود: ${student_code} - الفرقة: ${academic_year || 'غير محدد'})\n\n${content}`,
        is_admin: false,
        read_by_admin: false,
        read_by_user: true,
      });
    } catch (chatErr) {
      console.warn('Could not forward complaint to suggestions_chat:', chatErr);
    }

    // 3. إرسال إشعار فوري لجميع مديري النظام
    try {
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', ['مدير', 'مدير مساعد', 'admin', 'أدمن']);

      if (admins && admins.length > 0) {
        const notifs = admins.map((adm: any) => ({
          user_id: adm.id,
          title: 'شكوى / مقترح طلابي جديد 📬',
          message: `وصلت شكوى جديدة من الطالب: ${student_name} (${student_code}) موجهة إلى: ${target_entity}.\nالموضوع: ${subject || 'شكوى / مقترح طلابي'}`,
        }));
        await supabaseAdmin.from('notifications').insert(notifs);
      }
    } catch (notifErr) {
      console.warn('Could not create admin notification for complaint:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال الشكوى بنجاح وسيتم النظر فيها من قبل الجهة المختصة.',
      complaint,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
