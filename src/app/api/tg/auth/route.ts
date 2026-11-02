import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { noStoreJson, setStudentSession, createStudentSessionToken } from '@/lib/serverAuth';
import { getStudentCodeVariants, formatStudentCode } from '@/lib/codeHelper';

export const dynamic = 'force-dynamic';

/**
 * Telegram Authentication & Binding API:
 * 1. GET: 
 *    - Check if a telegram_id is already bound to a student
 *    - OR if ?action=lookup&code=0713, instantly returns the student's name for verification
 * 2. POST: Bind a telegram_id permanently to a student code and create session
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Live Student Name Lookup by code
    if (action === 'lookup') {
      const code = (searchParams.get('code') || '').trim();
      if (!code || code.length < 2) {
        return noStoreJson({ found: false });
      }
      const cleanCode = formatStudentCode(code);
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('id, full_name, student_code, academic_year, section, telegram_id')
        .or(`student_code.eq.${code},student_code.eq.${cleanCode}`)
        .limit(1)
        .maybeSingle();

      if (!st) {
        return noStoreJson({ found: false });
      }

      return noStoreJson({
        found: true,
        student: {
          full_name: st.full_name,
          student_code: st.student_code,
          academic_year: st.academic_year,
          section: st.section,
          is_linked: !!st.telegram_id
        }
      });
    }

    const tgId = (searchParams.get('tg_id') || searchParams.get('telegram_id') || '').trim();

    if (!tgId) {
      return noStoreJson({ authenticated: false, message: 'telegram_id is required' }, { status: 400 });
    }

    // 1. Check if telegram_id is linked in students table
    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select('id, student_code, full_name, academic_year, section, telegram_id, is_active')
      .eq('telegram_id', tgId.toString())
      .limit(1)
      .maybeSingle();

    if (error || !student) {
      return noStoreJson({
        authenticated: false,
        needs_link: true,
        telegram_id: tgId
      });
    }

    // 2. Student is linked! Create long-term session (180 days)
    const response = noStoreJson({
      authenticated: true,
      student: {
        student_code: student.student_code,
        full_name: student.full_name,
        academic_year: student.academic_year,
        section: student.section
      },
      token: createStudentSessionToken(student.student_code, 180 * 24 * 3600)
    });

    setStudentSession(response, student.student_code, request, 180 * 24 * 3600);
    return response;
  } catch (err: any) {
    return noStoreJson({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawCode = (body.student_code || '').trim();
    const rawTgId = (body.telegram_id || '').toString().trim();
    const tgUsername = (body.telegram_username || '').trim();
    const tgFirstName = (body.telegram_first_name || '').trim();
    const isAdminOverride = body.admin_override === true;

    if (!rawCode || !rawTgId) {
      return noStoreJson({ success: false, error: 'يرجى إدخال كود الطالب' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(rawCode);

    // 1. Verify student exists in database
    const { data: student, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section, telegram_id, is_active')
      .or(`student_code.eq.${rawCode},student_code.eq.${cleanCode}`)
      .limit(1)
      .maybeSingle();

    if (stErr || !student) {
      return noStoreJson({
        success: false,
        error: 'عفواً، لم يتم العثور على طالب بهذا الكود. يرجى التأكد من الكود الصحيح.'
      }, { status: 404 });
    }

    // 2. Prevent one Telegram account from taking multiple student identities (unless admin override)
    const { data: otherStudent } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code')
      .eq('telegram_id', rawTgId)
      .neq('id', student.id)
      .limit(1)
      .maybeSingle();

    if (otherStudent && !isAdminOverride) {
      return noStoreJson({
        success: false,
        error: `حساب التيليجرام هذا مربوط بالفعل بالطالب (${otherStudent.full_name}). لا يمكن ربط أكثر من طالب بنفس الحساب.`
      }, { status: 409 });
    }

    // 3. Prevent overwriting an already linked student from another Telegram (unless admin override)
    if (student.telegram_id && student.telegram_id !== rawTgId && !isAdminOverride) {
      return noStoreJson({
        success: false,
        error: '⚠️ هذا الكود مربوط مسبقاً بحساب تيليجرام آخر! يرجى مراجعة إدارة الكلية أو المنسق لفك الارتباط.'
      }, { status: 409 });
    }

    // 4. Update student record with telegram_id (safe against nonexistent columns)
    const updatePayload: Record<string, any> = {
      telegram_id: rawTgId
    };
    if (tgUsername) updatePayload.telegram_username = tgUsername;
    if (tgFirstName) updatePayload.telegram_first_name = tgFirstName;

    const { error: updateErr } = await supabaseAdmin
      .from('students')
      .update(updatePayload)
      .eq('id', student.id);

    if (updateErr) {
      console.error('Update student error:', updateErr);
      return noStoreJson({ success: false, error: 'تعذر حفظ بيانات الدخول، يرجى المحاولة لاحقاً' }, { status: 500 });
    }

    // 5. Update student_accounts status to active if table exists
    try {
      await supabaseAdmin
        .from('student_accounts')
        .update({
          status: 'active',
          is_pin_used: true
        })
        .or(`student_code.eq.${student.student_code},student_code.eq.${cleanCode}`);
    } catch (_) {}

    // 6. Issue Semester-long Session (180 days)
    const response = noStoreJson({
      success: true,
      message: 'تم تسجيل الدخول بنجاح!',
      student: {
        student_code: student.student_code,
        full_name: student.full_name,
        academic_year: student.academic_year,
        section: student.section
      },
      token: createStudentSessionToken(student.student_code, 180 * 24 * 3600)
    });

    setStudentSession(response, student.student_code, request, 180 * 24 * 3600);
    return response;
  } catch (err: any) {
    return noStoreJson({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
