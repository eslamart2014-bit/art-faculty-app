import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { student_code, status } = await request.json();

    if (!student_code) {
      return NextResponse.json({ error: 'يرجى تحديد كود الطالب' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(student_code);
    const newStatus = status === 'suspended' ? 'suspended' : 'active';

    // 1. Update in student_accounts
    try {
      await supabaseAdmin
        .from('student_accounts')
        .update({ status: newStatus })
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
    } catch (e) {}

    // 2. Update in students.telegram_browser_id if present
    try {
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('id, full_name, telegram_browser_id')
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
        .maybeSingle();

      if (st && st.telegram_browser_id) {
        try {
          const parsed = JSON.parse(st.telegram_browser_id);
          parsed.status = newStatus;
          await supabaseAdmin
            .from('students')
            .update({ telegram_browser_id: JSON.stringify(parsed) })
            .eq('id', st.id);
        } catch (e) {}
      }
    } catch (e) {}

    // 3. Update localStore
    try {
      const localAcc = localStore.getAccount(cleanCode);
      if (localAcc) {
        localAcc.status = newStatus;
        localStore.upsertAccount(localAcc);
      }
    } catch (e) {}

    // 4. Audit log
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: cleanCode,
        action: newStatus === 'suspended' ? 'account_suspended' : 'account_unsuspended',
        details: {
          status: newStatus,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: newStatus === 'suspended' 
        ? 'تم تعليق الحساب مؤقتاً بنجاح (لا يمكن للطالب الدخول حتى يتم إلغاء التعليق)'
        : 'تم تفعيل الحساب وإلغاء التعليق بنجاح',
    });
  } catch (err: any) {
    console.error('Toggle suspend error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
