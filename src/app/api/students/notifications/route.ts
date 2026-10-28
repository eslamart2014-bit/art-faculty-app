import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim();

    const notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: 'grade' | 'attendance' | 'deadline' | 'announcement';
      timestamp: string;
    }> = [];

    // 1. General Announcements for all students
    try {
      const { data: sysData } = await supabaseAdmin
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 1)
        .maybeSingle();

      const config = sysData?.telegram_config || {};
      if (config.student_announcement && config.student_announcement.text) {
        notifications.push({
          id: `announcement_${config.student_announcement.id || 'current'}`,
          title: config.student_announcement.title || '📢 إعلان هام من الكلية',
          message: config.student_announcement.text,
          type: 'announcement',
          timestamp: config.student_announcement.timestamp || new Date().toISOString()
        });
      }
    } catch (e) {}

    // 2. Personal notifications if student code is provided
    if (code) {
      try {
        const { data: student } = await supabaseAdmin
          .from('students')
          .select('id, student_code, full_name, academic_year, section')
          .eq('student_code', code)
          .maybeSingle();

        if (student) {
          // A. Recent evaluations in the last 5 days
          const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentEvals } = await supabaseAdmin
            .from('evaluations')
            .select('id, project_name, score, updated_at, created_at, courses(name)')
            .eq('student_id', student.id)
            .gte('updated_at', fiveDaysAgo)
            .order('updated_at', { ascending: false })
            .limit(3);

          if (recentEvals && recentEvals.length > 0) {
            recentEvals.forEach((ev: any) => {
              const courseName = ev.courses?.name || 'مقرر دراسي';
              notifications.push({
                id: `eval_${ev.id}`,
                title: '🎨 تم رصد تقييم جديد لأعمالك',
                message: `تم رصد تقييمك في مشروع "${ev.project_name}" بمقرر ${courseName} (الدرجة: ${ev.score})`,
                type: 'grade',
                timestamp: ev.updated_at || ev.created_at || new Date().toISOString()
              });
            });
          }

          // B. Recent absence alerts (last 3 days)
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const { data: recentAbsence } = await supabaseAdmin
            .from('attendance')
            .select('id, date, status, courses(name)')
            .eq('student_id', student.id)
            .eq('status', 'غائب')
            .gte('date', threeDaysAgo)
            .order('date', { ascending: false })
            .limit(2);

          if (recentAbsence && recentAbsence.length > 0) {
            recentAbsence.forEach((att: any) => {
              const courseName = att.courses?.name || 'مقرر دراسي';
              notifications.push({
                id: `att_absent_${att.id}`,
                title: '⚠️ تنبيه غياب مسجل',
                message: `تم تسجيل غياب في مقرر ${courseName} بتاريخ ${att.date}`,
                type: 'attendance',
                timestamp: att.date
              });
            });
          }
        }
      } catch (err) {}
    }

    return NextResponse.json({
      success: true,
      notifications
    }, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, notifications: [] }, { status: 500 });
  }
}
