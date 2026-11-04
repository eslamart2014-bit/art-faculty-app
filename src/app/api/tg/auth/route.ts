import { supabaseAdmin } from '@/lib/core/supabase';
import { noStoreJson, setStudentSession, createStudentSessionToken, getStaffContext } from '@/lib/auth/serverAuth';
import { formatStudentCode } from '@/lib/students/codeHelper';
import { getActiveTelegramBotToken, getStudentTelegramButtons, getStudentPersistentKeyboard } from '@/lib/telegram/push';

export const dynamic = 'force-dynamic';

const PERMANENT_TTL_SECONDS = 365 * 24 * 3600; // 1 full year permanent session

/**
 * Telegram Authentication & Permanent Binding API:
 * 1. GET:
 *    - Check if a telegram_id is already bound to a student
 *    - OR if ?action=lookup&code=0713, instantly returns the student's name for verification
 * 2. POST: Bind a telegram_id permanently to a student code and create permanent session
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

    const rawTgId = (searchParams.get('tg_id') || searchParams.get('telegram_id') || '').trim();
    const cleanTgId = rawTgId.replace(/\D/g, '');

    if (!cleanTgId) {
      return noStoreJson({ authenticated: false, needs_link: true, message: 'telegram_id is required' });
    }

    // 1. Check if telegram_id is linked in students table
    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select('id, student_code, full_name, academic_year, section, telegram_id, is_active, telegram_browser_id')
      .eq('telegram_id', cleanTgId)
      .limit(1)
      .maybeSingle();

    if (error || !student) {
      return noStoreJson({
        authenticated: false,
        needs_link: true,
        telegram_id: cleanTgId
      });
    }

    // Check if account is suspended by admin
    let isSuspended = false;
    if (student.telegram_browser_id) {
      try {
        const parsed = JSON.parse(student.telegram_browser_id);
        if (parsed?.status === 'suspended') isSuspended = true;
      } catch {}
    }
    if (!isSuspended) {
      try {
        const cleanStCode = formatStudentCode(student.student_code);
        const { data: acc } = await supabaseAdmin
          .from('student_accounts')
          .select('status')
          .or(`student_code.eq.${student.student_code},student_code.eq.${cleanStCode}`)
          .limit(1)
          .maybeSingle();
        if (acc?.status === 'suspended') isSuspended = true;
      } catch {}
    }

    if (isSuspended) {
      return noStoreJson({
        authenticated: false,
        suspended: true,
        error: '⛔ تم تعليق حسابك مؤقتاً بواسطة إدارة الكلية. يرجى مراجعة المشرف.'
      }, { status: 403 });
    }

    // Log bot session activity
    supabaseAdmin
      .from('portal_audit_logs')
      .insert({
        student_code: student.student_code,
        action: 'bot_login',
        details: { telegram_id: cleanTgId, source: 'telegram_bot' }
      })
      .then(() => {})
      .catch(() => {});

    // 2. Student is linked! Create permanent 365-day session
    const token = createStudentSessionToken(student.student_code, PERMANENT_TTL_SECONDS);
    const response = noStoreJson({
      authenticated: true,
      student: {
        student_code: student.student_code,
        full_name: student.full_name,
        academic_year: student.academic_year,
        section: student.section
      },
      token
    });

    setStudentSession(response, student.student_code, request, PERMANENT_TTL_SECONDS);
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
    const cleanTgId = rawTgId.replace(/\D/g, '');
    const tgUsername = (body.telegram_username || '').trim();
    const tgFirstName = (body.telegram_first_name || '').trim();

    // Only allow admin_override if caller is an authenticated staff admin/coordinator OR testing on localhost
    const hostHeader = request.headers.get('host') || '';
    const isLocalhost = hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1');
    let isAdminOverride = isLocalhost;
    if (body.admin_override === true && !isAdminOverride) {
      const staff = await getStaffContext(request);
      isAdminOverride = Boolean(staff?.isAdmin || staff?.isCoordinator);
    }

    if (!rawCode || !cleanTgId) {
      return noStoreJson({ success: false, error: 'يرجى إدخال كود الطالب ومعرف التيليجرام' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(rawCode);

    // 1. Verify student exists in database
    const { data: student, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section, telegram_id, is_active, telegram_browser_id')
      .or(`student_code.eq.${rawCode},student_code.eq.${cleanCode}`)
      .limit(1)
      .maybeSingle();

    if (stErr || !student) {
      return noStoreJson({
        success: false,
        error: 'عفواً، لم يتم العثور على طالب بهذا الكود. يرجى التأكد من الكود الصحيح.'
      }, { status: 404 });
    }

    // Check if account is suspended by admin
    let isSuspended = false;
    let existingMeta: Record<string, any> = {};
    if (student.telegram_browser_id) {
      try {
        existingMeta = JSON.parse(student.telegram_browser_id) || {};
        if (existingMeta.status === 'suspended') isSuspended = true;
      } catch {}
    }
    if (!isSuspended) {
      try {
        const { data: acc } = await supabaseAdmin
          .from('student_accounts')
          .select('status')
          .or(`student_code.eq.${student.student_code},student_code.eq.${cleanCode}`)
          .limit(1)
          .maybeSingle();
        if (acc?.status === 'suspended') isSuspended = true;
      } catch {}
    }

    if (isSuspended && !isAdminOverride) {
      return noStoreJson({
        success: false,
        suspended: true,
        error: '⛔ تم تعليق حسابك مؤقتاً بواسطة إدارة الكلية. يرجى مراجعة المشرف.'
      }, { status: 403 });
    }

    // 2. Prevent one Telegram account from taking multiple student identities (unless verified admin override)
    const { data: otherStudent } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code')
      .eq('telegram_id', cleanTgId)
      .neq('id', student.id)
      .limit(1)
      .maybeSingle();

    if (otherStudent && !isAdminOverride) {
      return noStoreJson({
        success: false,
        error: `حساب التيليجرام هذا مربوط بالفعل بالطالب (${otherStudent.full_name}). لا يمكن ربط أكثر من طالب بنفس الحساب.`
      }, { status: 409 });
    }

    // 3. Prevent overwriting an already linked student from another Telegram (unless verified admin override)
    const wasAlreadyLinked = Boolean(student.telegram_id);
    if (student.telegram_id && student.telegram_id.toString() !== cleanTgId && !isAdminOverride) {
      return noStoreJson({
        success: false,
        error: '⚠️ هذا الكود مربوط مسبقاً بحساب تيليجرام آخر! يرجى مراجعة إدارة الكلية أو المنسق لفك الارتباط.'
      }, { status: 409 });
    }

    // 4. Update student record with telegram_id (skip DB write if using local test dummy ID 999888777)
    const isDummyLocalTest = cleanTgId === '999888777';
    if (!isDummyLocalTest) {
      const updatedMeta = {
        ...existingMeta,
        telegram_id: cleanTgId,
        telegram_username: tgUsername || existingMeta.telegram_username || null,
        telegram_first_name: tgFirstName || existingMeta.telegram_first_name || null,
        status: existingMeta.status === 'suspended' ? 'suspended' : 'active',
        linked_at: existingMeta.linked_at || new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };

      const updatePayload: Record<string, any> = {
        telegram_id: cleanTgId,
        telegram_browser_id: JSON.stringify(updatedMeta)
      };
      if (tgUsername) updatePayload.telegram_username = tgUsername;
      if (tgFirstName) updatePayload.telegram_first_name = tgFirstName;

      let { error: updateErr } = await supabaseAdmin
        .from('students')
        .update(updatePayload)
        .eq('id', student.id);

      // Fallback if optional telegram_username/telegram_first_name columns don't exist in schema
      if (updateErr) {
        const retry = await supabaseAdmin
          .from('students')
          .update({
            telegram_id: cleanTgId,
            telegram_browser_id: JSON.stringify(updatedMeta)
          })
          .eq('id', student.id);
        updateErr = retry.error;
      }

      if (updateErr) {
        console.error('Update student error:', updateErr);
        return noStoreJson({ success: false, error: 'تعذر حفظ بيانات الدخول: ' + updateErr.message }, { status: 500 });
      }
    }

    // Log bot link/login activity
    supabaseAdmin
      .from('portal_audit_logs')
      .insert({
        student_code: student.student_code,
        action: wasAlreadyLinked ? 'bot_login' : 'bot_link_account',
        details: {
          telegram_id: cleanTgId,
          telegram_username: tgUsername || null,
          telegram_first_name: tgFirstName || null,
          source: 'telegram_bot'
        }
      })
      .then(() => {})
      .catch(() => {});

    // 5. Update student_accounts status to active if table exists
    try {
      await supabaseAdmin
        .from('student_accounts')
        .update({
          status: 'active',
          is_pin_used: true
        })
        .or(`student_code.eq.${student.student_code},student_code.eq.${cleanCode}`);
    } catch {}

    // 6. Send welcome message with persistent fixed bottom buttons on first bind
    if (!wasAlreadyLinked) {
      getActiveTelegramBotToken()
        .then((botToken) => {
          if (!botToken) return;
          const portalBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://art-faculty-app.vercel.app').replace(/\/$/, '');
          const persistentMarkup = getStudentPersistentKeyboard(portalBaseUrl, cleanTgId);
          const welcomeHtml =
            `✅ <b>تم ربط وتثبيت حسابك بنجاح!</b>\n\n` +
            `👨‍🎓 <b>الطالب:</b> ${student.full_name}\n` +
            `📌 <b>الكود:</b> <code>${student.student_code}</code>\n` +
            `🏫 <b>الفرقة:</b> ${student.academic_year}${student.section ? ` • سكشن ${student.section}` : ''}\n\n` +
            `من خلال هذا البوت يمكن للطلاب متابعة حضور وغياب ومشاريع وتقييمات وانضمام للدواليب، وستصلك كافة الإشعارات الأكاديمية هنا فور صدورها 🔔\n\n` +
            `تم تثبيت أزرار الدخول للبوابة وسحب الـ QR Code في أسفل شاشة البوت بشكل دائم 👇`;

          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cleanTgId,
              text: welcomeHtml,
              parse_mode: 'HTML',
              reply_markup: persistentMarkup,
            }),
          }).catch(() => {});

          // Remove any bottom-left menu button ("القائمة الرئيسية")
          fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cleanTgId,
              menu_button: { type: 'default' },
            }),
          }).catch(() => {});
        })
        .catch(() => {});
    }

    // 7. Issue permanent 365-day Session
    const token = createStudentSessionToken(student.student_code, PERMANENT_TTL_SECONDS);
    const response = noStoreJson({
      success: true,
      message: 'تم تسجيل الدخول وتثبيت الحساب بنجاح!',
      student: {
        student_code: student.student_code,
        full_name: student.full_name,
        academic_year: student.academic_year,
        section: student.section
      },
      token
    });

    setStudentSession(response, student.student_code, request, PERMANENT_TTL_SECONDS);
    return response;
  } catch (err: any) {
    return noStoreJson({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
