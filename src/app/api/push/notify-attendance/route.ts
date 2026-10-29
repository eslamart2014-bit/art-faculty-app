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

    // 2. Fetch student codes for the marked student IDs
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('student_code')
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
