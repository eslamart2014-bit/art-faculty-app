import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';
import { sendPushToStudents } from '@/lib/telegram/push';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.student_ids || !Array.isArray(body.student_ids) || body.student_ids.length === 0) {
      return NextResponse.json({ success: false, message: 'student_ids array is required' }, { status: 400 });
    }

    const { student_ids, course_id, date, action } = body;
    const isCancelled = action === 'cancelled';

    // 1. Fetch course details
    let courseName = 'المقرر';
    if (course_id) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('name')
        .eq('id', course_id)
        .maybeSingle();
      if (course?.name) courseName = course.name;
    }

    // 2. Fetch student codes and names for the marked student IDs
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, student_code, full_name, telegram_id')
      .in('id', student_ids);

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No students found' });
    }

    const displayDate = date || new Date().toISOString().split('T')[0];

    const title = isCancelled ? 'ℹ️ تم إلغاء تسجيل الحضور' : '✅ تم تسجيل حضورك';
    const messageBody = isCancelled
      ? `تم إلغاء تسجيل حضورك في مقرر ${courseName} (${displayDate})`
      : `تم تسجيل حضورك اليوم بنجاح في مقرر ${courseName} (${displayDate})`;

    let totalSent = 0;

    // Send push & Telegram notification per student (with fixed portal buttons & deduplication)
    for (const st of students) {
      if (!st.student_code) continue;
      const dedupTag = `att_${st.student_code}_${displayDate}_${course_id || 'course'}`;
      const tgHtml = isCancelled
        ? `ℹ️ <b>تنبيه من قسم التربية الفنية:</b>\n\nعزيزي الطالب <b>${st.full_name}</b>، تم إلغاء تسجيل حضورك في مقرر:\n📚 <b>${courseName}</b>\n📅 بتاريخ: <code>${displayDate}</code>`
        : `✅ <b>تسجيل حضور معتمد — قسم التربية الفنية</b>\n\nمرحباً <b>${st.full_name}</b> 👨‍🎓\nتم تسجيل حضورك اليوم بنجاح في مقرر:\n📚 <b>${courseName}</b>\n📅 بتاريخ: <code>${displayDate}</code>\n\n<i>نتمنى لك دوام التوفيق والتميز 🌟</i>`;

      const res = await sendPushToStudents([st.student_code], {
        title,
        body: messageBody,
        type: 'attendance',
        id: dedupTag,
        tag: dedupTag,
        telegramHtml: tgHtml,
      });
      totalSent += res.sent;
    }

    return NextResponse.json({
      success: true,
      sent: totalSent,
      action: isCancelled ? 'cancelled' : 'present',
    });
  } catch (error: any) {
    console.error('[notify-attendance]', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
