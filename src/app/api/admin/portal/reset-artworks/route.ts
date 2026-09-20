import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { student_code, reason } = await request.json();

    if (!student_code) {
      return NextResponse.json({ error: 'يرجى تحديد كود الطالب' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(student_code);

    // 1. Get student
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code')
      .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
      .maybeSingle();

    if (!student) {
      return NextResponse.json({ error: 'الطالب غير موجود في المنظومة' }, { status: 404 });
    }

    // 2. Delete all records from student_submissions
    const { error: delSubErr } = await supabaseAdmin
      .from('student_submissions')
      .delete()
      .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);

    if (delSubErr) {
      console.error('Delete submissions error:', delSubErr);
    }

    // 3. Clear photo_url and score in evaluations for this student
    if (student.id) {
      const { error: evalErr } = await supabaseAdmin
        .from('evaluations')
        .update({ photo_url: null, score: null })
        .eq('student_id', student.id);

      if (evalErr) {
        console.error('Reset evaluations error:', evalErr);
      }
    }

    // 4. Clear localStore submissions
    try {
      localStore.deleteSubmissions(cleanCode);
      localStore.deleteSubmissions(student_code);
    } catch (e) {}

    // 5. Audit log
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: student.student_code,
        action: 'reset_artworks_by_admin',
        details: {
          student_name: student.full_name,
          reason: reason || 'تصفير كافة الأعمال والمشاريع المرفوعة وإعادة فتح الرفع للطالب',
          reset_at: new Date().toISOString(),
        }
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: `تم تصفير وحذف كافة أعمال ومشاريع الطالب (${student.full_name}) بنجاح! يمكن للطالب الآن تصوير ورفع أعماله من جديد.`,
    });
  } catch (err: any) {
    console.error('Reset artworks error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
