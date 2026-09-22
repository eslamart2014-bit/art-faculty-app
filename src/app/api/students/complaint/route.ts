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

    return NextResponse.json({
      success: true,
      message: 'تم إرسال الشكوى بنجاح وسيتم النظر فيها من قبل الجهة المختصة.',
      complaint,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
