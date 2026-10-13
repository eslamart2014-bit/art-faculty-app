import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendManualPlagiarismAlert } from '@/lib/plagiarismNotifier';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { student1, student2, similarity, hammingDistance, reason } = body;

    if (!student1 || !student2 || similarity === undefined) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    const res = await sendManualPlagiarismAlert(
      {
        student1,
        student2,
        similarity: Number(similarity),
        hammingDistance: hammingDistance ? Number(hammingDistance) : undefined,
        reason,
      },
      supabaseAdmin
    );

    if (!res.success) {
      return NextResponse.json(
        { error: res.error || 'تعذر إرسال الإشعار إلى تليجرام' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال إشعار التليجرام بالصورتين وكافة التفاصيل بنجاح!',
      notifiedChats: res.notifiedChats,
    });
  } catch (err: any) {
    console.error('Notify plagiarism error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
