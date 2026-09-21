import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
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

      // 2. البحث عن الحساب المسجل
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
          message: 'الطالب لم يقم بإنشاء حساب في البوابة بعد! يجب عليه فتح التطبيق والتسجيل أولاً.',
        });
      }

      const isActivated = account.status === 'active' || account.is_pin_used;
      const activatedBy = account.activated_by || account.pin_issued_by || null;
      const activatedAt = account.activated_at || account.pin_issued_at || account.last_login_at || null;

      return NextResponse.json({
        registered: true,
        student,
        account: {
          ...account,
          status: isActivated ? 'active' : 'pending',
          activated_by: activatedBy,
          activated_at: activatedAt,
        },
        isActivated,
      });
    }

    // 2. تفعيل حساب الطالب بواسطة المنسق
    if (action === 'activate_student') {
      const nowIso = new Date().toISOString();
      const coordName = coordinator_name || 'منسق النظام';

      // تحديث student_accounts
      let updatedAccount: any = null;
      try {
        const res = await supabaseAdmin
          .from('student_accounts')
          .update({
            status: 'active',
            is_pin_used: true,
            id_card_verified: true,
            activated_by: coordName,
            activated_at: nowIso,
            pin_issued_by: coordName,
            pin_issued_at: nowIso,
          })
          .eq('student_code', cleanCode)
          .select('*')
          .single();
        updatedAccount = res.data;
      } catch (e) {}

      // تحديث students.telegram_browser_id
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
            status: 'active',
            is_pin_used: true,
            id_card_verified: true,
            activated_by: coordName,
            activated_at: nowIso,
          };
          await supabaseAdmin
            .from('students')
            .update({ telegram_browser_id: JSON.stringify(merged) })
            .eq('id', st.id);
          if (!updatedAccount) updatedAccount = merged;
        }
      } catch (e) {}

      // تحديث التخزين المحلي
      const localAcc = localStore.getAccount(cleanCode);
      if (localAcc) {
        localAcc.status = 'active';
        localAcc.is_pin_used = true;
        localAcc.activated_by = coordName;
        localAcc.activated_at = nowIso;
        localStore.upsertAccount(localAcc);
      }

      // تسجيل العملية في Audit Log
      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: cleanCode,
          action: 'account_activated_by_coordinator',
          details: { coordinator: coordName, activatedAt: nowIso },
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: 'تم اعتماد وتفعيل حساب الطالب بنجاح! يمكن للطالب الآن استخدام المنظومة فوراً.',
        account: updatedAccount,
      });
    }

    // 3. رفض البيانات وحذف التسجيل (بيانات خاطئة)
    if (action === 'reject_incorrect_data') {
      const coordName = coordinator_name || 'منسق النظام';

      // حذف صورة البطاقة من Storage إن وُجدت
      try {
        const { data: sa } = await supabaseAdmin
          .from('student_accounts')
          .select('id_card_url')
          .eq('student_code', cleanCode)
          .maybeSingle();

        if (sa?.id_card_url && sa.id_card_url.includes('/artworks/')) {
          const p = sa.id_card_url.split('/artworks/')[1]?.split('?')[0];
          if (p) await supabaseAdmin.storage.from('artworks').remove([decodeURIComponent(p)]);
        }
      } catch (e) {}

      // حذف من student_accounts
      try {
        await supabaseAdmin
          .from('student_accounts')
          .delete()
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
      } catch (e) {}

      // تصفير telegram_browser_id في جدول students
      try {
        await supabaseAdmin
          .from('students')
          .update({ telegram_browser_id: null })
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`);
      } catch (e) {}

      // حذف من التخزين المحلي
      try {
        localStore.deleteAccount(cleanCode);
        localStore.deleteAccount(student_code);
      } catch (e) {}

      // تسجيل في Audit Log
      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: cleanCode,
          action: 'registration_rejected_by_coordinator',
          details: { coordinator: coordName, reason: 'بيانات غير مطابقة للبطاقة الشخصية', rejectedAt: new Date().toISOString() },
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: 'تم رفض البيانات وحذف التسجيل وتصفير الحساب ليعود الطالب للتسجيل لأول مرة.',
      });
    }

    // 4. إظهار بيانات التسجيل وإنهاء جلسات الأجهزة الأخرى لمنع التحايل
    if (action === 'reset_other_sessions') {
      const coordName = coordinator_name || 'منسق النظام';

      // مسح الأجهزة وتصفير الجلسات في student_accounts
      try {
        await supabaseAdmin
          .from('student_accounts')
          .update({ devices: [] })
          .eq('student_code', cleanCode);
      } catch (e) {}

      // مسح الأجهزة في students.telegram_browser_id
      try {
        const { data: st } = await supabaseAdmin
          .from('students')
          .select('id, telegram_browser_id')
          .or(`student_code.eq.${student_code},student_code.eq.${cleanCode}`)
          .maybeSingle();

        if (st && st.telegram_browser_id) {
          let curr: any = {};
          try { curr = JSON.parse(st.telegram_browser_id); } catch(e){}
          curr.devices = [];
          await supabaseAdmin
            .from('students')
            .update({ telegram_browser_id: JSON.stringify(curr) })
            .eq('id', st.id);
        }
      } catch (e) {}

      // تسجيل العملية في Audit Log
      try {
        await supabaseAdmin.from('portal_audit_logs').insert({
          student_code: cleanCode,
          action: 'sessions_terminated_by_coordinator',
          details: { coordinator: coordName, timestamp: new Date().toISOString() },
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        message: 'تم إنهاء وحذف جلسة الطالب من أي جهاز آخر بنجاح لحمايته من التحايل.',
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    console.error('Coordinator action error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
