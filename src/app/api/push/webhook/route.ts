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

/** Supabase Database Webhook: attendance (INSERT/UPDATE) و evaluations (INSERT/UPDATE). */
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.table || !body?.record) return NextResponse.json({ ok: true, skipped: true });
  const { table, type, record, old_record } = body;

  try {
    // 1. تسجيل وتعديل الحضور (Attendance)
    if (table === 'attendance') {
      if (record.status !== 'حاضر') return NextResponse.json({ ok: true, skipped: 'not-present' });
      if (type === 'UPDATE' && old_record?.status === 'حاضر') return NextResponse.json({ ok: true, skipped: 'unchanged' });

      const [{ data: student }, { data: course }] = await Promise.all([
        supabaseAdmin.from('students').select('student_code').eq('id', record.student_id).maybeSingle(),
        supabaseAdmin.from('courses').select('name').eq('id', record.course_id).maybeSingle(),
      ]);
      if (!student?.student_code) return NextResponse.json({ ok: true, skipped: 'no-student' });

      const sent = await sendPushToStudents([student.student_code], {
        title: '✅ تم تسجيل حضورك',
        body: `تم تسجيل حضورك في مقرر ${course?.name || 'المقرر'}${record.date ? ` (${record.date})` : ''}`,
        type: 'attendance',
        id: `att_present_${record.id}`,
      });
      return NextResponse.json({ ok: true, sent });
    }

    // 2. رصد التقييمات والدرجات (Evaluations)
    if (table === 'evaluations') {
      const [{ data: student }, { data: course }] = await Promise.all([
        supabaseAdmin.from('students').select('student_code').eq('id', record.student_id).maybeSingle(),
        supabaseAdmin.from('courses').select('name').eq('id', record.course_id).maybeSingle(),
      ]);
      if (!student?.student_code) return NextResponse.json({ ok: true, skipped: 'no-student' });

      const scoreText = record.score !== null && record.score !== undefined ? ` (الدرجة: ${record.score})` : '';
      const sent = await sendPushToStudents([student.student_code], {
        title: '🎨 تم رصد تقييم جديد لأعمالك',
        body: `تم رصد تقييم مشروع "${record.project_name || 'المشروع'}" بمقرر ${course?.name || 'المقرر'}${scoreText}`,
        type: 'grade',
        id: `eval_${record.id}`,
      });
      return NextResponse.json({ ok: true, sent });
    }
  } catch (e: any) {
    console.error('[push webhook]', e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, skipped: true });
}
