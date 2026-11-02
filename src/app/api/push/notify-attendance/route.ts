import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToStudents } from '@/lib/push';

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

    // 2. Fetch student codes and telegram_ids for the marked student IDs
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, student_code, full_name, telegram_id')
      .in('id', student_ids);

    const codes = (students || []).map((s: any) => s.student_code).filter(Boolean);
    if (codes.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No student codes found' });
    }

    const displayDate = date || new Date().toISOString().split('T')[0];

    const title = isCancelled ? 'ℹ️ تم إلغاء تسجيل الحضور' : '✅ تم تسجيل حضورك';
    const messageBody = isCancelled
      ? `تم إلغاء تسجيل حضورك في مقرر ${courseName} (${displayDate})`
      : `تم تسجيل حضورك اليوم بنجاح في مقرر ${courseName} (${displayDate})`;

    let totalSent = 0;

    // Send push per student so that the tag is unique per student & date
    for (const code of codes) {
      const dedupTag = `att_${code}_${displayDate}_${course_id || 'course'}`;
      const res = await sendPushToStudents([code], {
        title,
        body: messageBody,
        type: 'attendance',
        id: dedupTag,
        tag: dedupTag,
      });
      totalSent += res.sent;
    }

    // 3. Dispatch instant Telegram notification to students with linked accounts
    try {
      const { data: sysData } = await supabaseAdmin
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 1)
        .limit(1)
        .maybeSingle();

      const botToken = sysData?.telegram_config?.token || process.env.TELEGRAM_BOT_TOKEN;

      if (botToken) {
        for (const st of (students || [])) {
          if (st.telegram_id) {
            const tgMsg = isCancelled
              ? `ℹ️ <b>تنبيه من قسم التربية الفنية:</b>\n\nعزيزي الطالب <b>${st.full_name}</b>، تم إلغاء تسجيل حضورك في مقرر:\n📚 <b>${courseName}</b>\n📅 بتاريخ: <code>${displayDate}</code>`
              : `✅ <b>تسجيل حضور معتمد — قسم التربية الفنية</b>\n\nمرحباً <b>${st.full_name}</b> 👨‍🎓\nتم تسجيل حضورك اليوم بنجاح في مقرر:\n📚 <b>${courseName}</b>\n📅 بتاريخ: <code>${displayDate}</code>\n\n<i>نتمنى لك دوام التوفيق والتميز 🌟</i>`;

            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: st.telegram_id,
                text: tgMsg,
                parse_mode: 'HTML'
              })
            }).catch(() => {});
          }
        }
      }
    } catch (tgErr) {
      console.error('[notify-attendance] telegram error:', tgErr);
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
