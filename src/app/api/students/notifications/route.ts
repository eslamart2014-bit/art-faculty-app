import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { lockerStore } from '@/lib/lockerStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim();
    const clientVer = searchParams.get('v');

    const notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: 'grade' | 'attendance' | 'deadline' | 'announcement';
      timestamp: string;
    }> = [];

    // 1. App Update Notification (if client version is older than current 5)
    if (clientVer && parseInt(clientVer, 10) < 5) {
      notifications.push({
        id: 'apk_update_v1_0_4',
        title: '⚡ يتوفر تحديث جديد فائق السرعة (v1.0.4)',
        message: 'يتوفر إصدار جديد يعمل محلياً في ذاكرة الهاتف ويوفر البيانات. انقر للتحديث الآن!',
        type: 'announcement',
        timestamp: new Date().toISOString()
      });
    }

    // 2. General Announcements for all students
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

    // 3. Personal notifications if student code is provided
    if (code) {
      try {
        const { data: student } = await supabaseAdmin
          .from('students')
          .select('id, student_code, full_name, academic_year, section')
          .eq('student_code', code)
          .maybeSingle();

        if (student) {
          // A. Attendance Confirmed Notification (تم تسجيل حضورك في مقرر كذا)
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const { data: recentPresence } = await supabaseAdmin
            .from('attendance')
            .select('id, date, status, courses(name)')
            .eq('student_id', student.id)
            .eq('status', 'حاضر')
            .gte('date', threeDaysAgo)
            .order('date', { ascending: false })
            .limit(3);

          if (recentPresence && recentPresence.length > 0) {
            recentPresence.forEach((att: any) => {
              const courseName = att.courses?.name || 'مقرر دراسي';
              notifications.push({
                id: `att_present_${att.id}`,
                title: '✅ تم تسجيل حضورك',
                message: `تم تسجيل حضورك اليوم بنجاح في مقرر ${courseName} (بتاريخ ${att.date})`,
                type: 'attendance',
                timestamp: att.date
              });
            });
          }

          // B. New Project Added Notification (إضافة مشروع جديد في مقررات الطالب)
          try {
            const { data: studentCourses } = await supabaseAdmin
              .from('courses')
              .select('id, name')
              .eq('academic_year', student.academic_year);

            const courseIds = (studentCourses || []).map((c: any) => c.id);
            if (courseIds.length > 0) {
              const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
              const { data: recentProjects } = await supabaseAdmin
                .from('projects')
                .select('id, name, course_id, created_at, courses(name)')
                .in('course_id', courseIds)
                .gte('created_at', sevenDaysAgo)
                .order('created_at', { ascending: false })
                .limit(3);

              if (recentProjects && recentProjects.length > 0) {
                recentProjects.forEach((proj: any) => {
                  const courseName = proj.courses?.name || 'مقرر دراسي';
                  notifications.push({
                    id: `proj_new_${proj.id}`,
                    title: '📌 تم إضافة مشروع جديد مطلوب تسليمه',
                    message: `تم إضافة مشروع جديد "${proj.name}" في مقرر ${courseName}`,
                    type: 'deadline',
                    timestamp: proj.created_at || new Date().toISOString()
                  });
                });
              }
            }
          } catch (projErr) {}

          // C. Locker Approved / Assigned Notification (تم قبولك أو اعتمادك في الدولاب كذا)
          try {
            await lockerStore.ensureLoaded();
            const lockerResult = lockerStore.getStudentLockerStatus({
              code: student.student_code,
              name: student.full_name
            });
            if (lockerResult?.status === 'confirmed' && lockerResult.booking?.locker_code) {
              notifications.push({
                id: `locker_approved_${lockerResult.booking.locker_code}_${lockerResult.booking.id}`,
                title: '🔐 تم قبولك واعتماد الدولاب بنجاح!',
                message: `تهانينا! تم اعتماد حجز الدولاب رقم (${lockerResult.booking.locker_code}) وتخصيصه لك رسميًا.`,
                type: 'announcement',
                timestamp: lockerResult.booking.confirmed_at || lockerResult.booking.created_at || new Date().toISOString()
              });
            }
          } catch (lockerErr) {}

          // D. Recent Evaluations (رصد الدرجات والتقييمات)
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

          // E. Recent Absence Alerts (تنبيهات الغياب)
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
