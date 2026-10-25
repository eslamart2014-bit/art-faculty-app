import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventType = clean(body?.event_type, 64);
    const academicYear = clean(body?.academic_year, 32);
    const browserId = clean(body?.browser_id, 128);
    const studentName = clean(body?.student_name, 120);

    if (!eventType || !academicYear) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('portal_analytics')
      .insert([{ event_type: eventType, academic_year: academicYear, browser_id: browserId, student_name: studentName }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('analytics track error:', err);
    return NextResponse.json({ error: 'تعذر تسجيل الحدث' }, { status: 500 });
  }
}
