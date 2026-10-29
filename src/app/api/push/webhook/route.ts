import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushToStudents } from '@/lib/push';
import { getAcademicYearVariants } from '@/lib/codeHelper';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const given = request.headers.get('x-webhook-secret') || '';
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Supabase Database Webhook: attendance (INSERT/UPDATE) و projects (INSERT). */
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.table || !body?.record) return NextResponse.json({ ok: true, skipped: true });
  const { table, type, record, old_record } = body;

  try {
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

    if (table === 'projects' && type === 'INSERT') {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('name, academic_year')
        .eq('id', record.course_id)
        .maybeSingle();
      if (!course?.academic_year) return NextResponse.json({ ok: true, skipped: 'no-course' });

      const { data: students } = await supabaseAdmin
        .from('students')
        .select('student_code')
        .in('academic_year', getAcademicYearVariants(course.academic_year));
      const codes = (students || []).map((s: any) => s.student_code).filter(Boolean);

      const sent = await sendPushToStudents(codes, {
        title: '📌 تم إضافة مشروع جديد',
        body: `تم إضافة مشروع "${record.name || ''}" في مقرر ${course.name || ''}`,
        type: 'project',
        id: `proj_new_${record.id}`,
      });
      return NextResponse.json({ ok: true, sent });
    }
  } catch (e: any) {
    console.error('[push webhook]', e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, skipped: true });
}
