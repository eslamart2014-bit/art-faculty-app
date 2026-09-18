import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode, generatePinCode } from '@/lib/codeHelper';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { action, student_code, coordinator_name } = await request.json();
    const cleanCode = formatStudentCode(student_code);

    if (action === 'lookup') {
      // 1. البحث عن الطالب في جدول الطلاب
      const { data: student, error: stErr } = await supabaseAdmin
        .from('students')
        .select('id, full_name, student_code, academic_year, section, telegram_browser_id')
        .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
        .maybeSingle();

      if (stErr || !student) {
        return NextResponse.json(
          { error: 'لم يتم العثور على طالب بهذا الكود في المنظومة!' },
          { status: 404 }
        );
      }

      // 2. البحث عن الحساب المسجل في student_accounts أو telegram_browser_id
      let account: any = null;
      try {
        const { data } = await supabaseAdmin
          .from('student_accounts')
          .select('*')
          .eq('student_code', student.student_code)
          .maybeSingle();
        account = data;
      } catch (e) {}

      if (!account && (student as any).telegram_browser_id) {
        try {
          account = JSON.parse((student as any).telegram_browser_id);
        } catch (e) {}
      }

      if (!account) {
        account = localStore.getAccount(student.student_code);
      }

      if (!account) {
        return NextResponse.json({
          registered: false,
          student,
          message: 'الطالب غير مسجل في بوابة فنية بعد! يجب عليه التسجيل أولاً وتصوير بطاقة الهوية.',
        });
      }

      // إذا كان مسجلاً ولكن لم يُولد له PIN بعد
      let pin = account.pin_code;
      if (!pin) {
        pin = generatePinCode();
        account.pin_code = pin;
        try {
          await supabaseAdmin
            .from('student_accounts')
            .update({ pin_code: pin })
            .eq('id', account.id);
        } catch (e) {
          localStore.upsertAccount(account);
        }
      }

      // التحقق من تاريخ الاستخراج السابق
      let warning = '';
      if (account.is_pin_used) {
        warning = `تنبيه: هذا الطالب تم استخراج رقمه السري مسبقاً واستخدامه بالفعل بتاريخ ${new Date(account.pin_issued_at || account.last_login_at || Date.now()).toLocaleDateString('ar-EG')} بواسطة (${account.pin_issued_by || 'المنسق المعتمد'}).`;
      } else if (account.pin_issued_by) {
        warning = `تنبيه: تم إصدار الرقم السري مسبقاً لهذا الطالب بتاريخ ${new Date(account.pin_issued_at).toLocaleDateString('ar-EG')} بواسطة (${account.pin_issued_by}) ولم يقم الطالب بإدخاله بعد.`;
      }

      return NextResponse.json({
        registered: true,
        student,
        account: {
          ...account,
          pin_code: pin,
        },
        warning,
      });
    }

    if (action === 'issue_pin') {
      // تحديث حالة إصدار الرقم السري بواسطة هذا المنسق
      let updatedAccount: any = null;
      try {
        const res = await supabaseAdmin
          .from('student_accounts')
          .update({
            id_card_verified: true,
            pin_issued_by: coordinator_name || 'منسق النظام',
            pin_issued_at: new Date().toISOString(),
          })
          .eq('student_code', cleanCode)
          .select('*')
          .single();
        updatedAccount = res.data;
      } catch (e) {}

      // تحديث حالة إصدار الرقم السري في students.telegram_browser_id لضمان البقاء والاستدامة السحابية
      try {
        const { data: st } = await supabaseAdmin
          .from('students')
          .select('id, telegram_browser_id')
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
          .maybeSingle();
        if (st) {
          let curr: any = {};
          try { curr = JSON.parse(st.telegram_browser_id || '{}'); } catch(e){}
          const merged = {
            ...curr,
            id_card_verified: true,
            pin_issued_by: coordinator_name || 'منسق النظام',
            pin_issued_at: new Date().toISOString()
          };
          await supabaseAdmin
            .from('students')
            .update({ telegram_browser_id: JSON.stringify(merged) })
            .eq('id', st.id);
          if (!updatedAccount) updatedAccount = merged;
        }
      } catch (e) {}

      if (!updatedAccount) {
        const localAcc = localStore.getAccount(cleanCode);
        if (localAcc) {
          localAcc.id_card_verified = true;
          localAcc.pin_issued_by = coordinator_name || 'منسق النظام';
          localAcc.pin_issued_at = new Date().toISOString();
          localStore.upsertAccount(localAcc);
          updatedAccount = localAcc;
        }
      }

      // تسجيل العملية في الأوديت لوج
      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: cleanCode,
          action: 'pin_issued_by_coordinator',
          details: { coordinator: coordinator_name, issuedAt: new Date().toISOString() },
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: 'تم اعتماد بطاقة الهوية وتسجيل صرف الرقم السري بنجاح.',
        account: updatedAccount,
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    console.error('Coordinator action error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
