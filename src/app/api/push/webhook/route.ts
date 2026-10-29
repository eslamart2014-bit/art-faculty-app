import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToStudents } from '@/lib/push';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const given = request.headers.get('x-webhook-secret') || '';
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Supabase Database Webhook: attendance (INSERT/UPDATE/DELETE) و evaluations (INSERT/UPDATE). */
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.table || !body?.record) return NextResponse.json({ ok: true, skipped: true });
  const { table, type, record, old_record } = body;

  try {
    // 1. تسجيل أو إلغاء الحضور (Attendance)
    if (table === 'attendance') {
      const isCancelled = type === 'DELETE' || (type === 'UPDATE' && record.status !== 'حاضر' && old_record?.status === 'حاضر');
      const isPresent = record.status === 'حاضر';

      if (!isCancelled && !isPresent) {
        return NextResponse.json({ ok: true, skipped: 'not-present' });
      }
      if (type === 'UPDATE' && !isCancelled && old_record?.status === 'حاضر') {
        return NextResponse.json({ ok: true, skipped: 'unchanged' });
      }

      const targetStudentId = record.student_id || old_record?.student_id;
      const targetCourseId = record.course_id || old_record?.course_id;
      const targetDate = record.date || old_record?.date || new Date().toISOString().split('T')[0];

      const [{ data: student }, { data: course }] = await Promise.all([
        supabaseAdmin.from('students').select('student_code').eq('id', targetStudentId).maybeSingle(),
        supabaseAdmin.from('courses').select('name').eq('id', targetCourseId).maybeSingle(),
      ]);
      if (!student?.student_code) return NextResponse.json({ ok: true, skipped: 'no-student' });

      const courseName = course?.name || 'المقرر';
      const dedupTag = `att_${student.student_code}_${targetDate}_${targetCourseId || 'course'}`;

      if (isCancelled) {
        const sent = await sendPushToStudents([student.student_code], {
          title: 'ℹ️ تم إلغاء تسجيل الحضور',
          body: `تم إلغاء تسجيل حضورك في مقرر ${courseName} (${targetDate})`,
          type: 'attendance',
          id: dedupTag,
          tag: dedupTag,
        });
        return NextResponse.json({ ok: true, action: 'cancelled', sent });
      }

      const sent = await sendPushToStudents([student.student_code], {
        title: '✅ تم تسجيل حضورك',
        body: `تم تسجيل حضورك اليوم بنجاح في مقرر ${courseName} (${targetDate})`,
        type: 'attendance',
        id: dedupTag,
        tag: dedupTag,
      });
      return NextResponse.json({ ok: true, action: 'present', sent });
    }

    // 2. رصد التقييمات والدرجات (Evaluations)
    if (table === 'evaluations') {
      const [{ data: student }, { data: course }] = await Promise.all([
        supabaseAdmin.from('students').select('student_code').eq('id', record.student_id).maybeSingle(),
        supabaseAdmin.from('courses').select('name').eq('id', record.course_id).maybeSingle(),
      ]);
      if (!student?.student_code) return NextResponse.json({ ok: true, skipped: 'no-student' });

      const scoreText = record.score !== null && record.score !== undefined ? ` (الدرجة: ${record.score})` : '';
      const courseName = course?.name || 'المقرر';
      const projectName = record.project_name || 'المشروع';
      const evalTag = `eval_${student.student_code}_${projectName}_${record.course_id || 'course'}`;

      const sent = await sendPushToStudents([student.student_code], {
        title: '🎨 تم رصد تقييم جديد لأعمالك',
        body: `تم رصد تقييم مشروع "${projectName}" بمقرر ${courseName}${scoreText}`,
        type: 'grade',
        id: evalTag,
        tag: evalTag,
      });
      return NextResponse.json({ ok: true, sent });
    }
  } catch (e: any) {
    console.error('[push webhook]', e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, skipped: true });
}
