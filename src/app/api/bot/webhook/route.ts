import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function formatRelativeTimeArabic(dateInput: string | Date): string {
  const now = new Date();
  const past = new Date(dateInput);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  let relative = '';
  if (diffInSeconds < 60) {
    relative = 'منذ لحظات';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    relative = `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : minutes <= 10 ? 'دقائق' : 'دقيقة'}`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    relative = `منذ ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : hours <= 10 ? 'ساعات' : 'ساعة'}`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    relative = `منذ ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : days <= 10 ? 'أيام' : 'يوم'}`;
  } else {
    const weeks = Math.floor(diffInSeconds / 604800);
    relative = `منذ ${weeks} ${weeks === 1 ? 'أسبوع' : weeks === 2 ? 'أسبوعين' : weeks <= 10 ? 'أسابيع' : 'أسبوع'}`;
  }

  const exactDate = past.toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric' });
  const exactTime = past.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' });
  return `${relative} (${exactDate} - ${exactTime})`;
}

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string, replyMarkup: any = null) {
  try {
    const body: any = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('sendTelegramMessage error:', e);
  }
}

async function sendTelegramPhoto(botToken: string, chatId: number | string, photoUrl: string, caption: string, replyMarkup: any = null) {
  try {
    const body: any = { chat_id: chatId, photo: photoUrl, caption: caption, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('sendTelegramPhoto error:', e);
  }
}

async function getAdminSettingsView() {
  const { count: totalStudents } = await supabase.from('students').select('id', { count: 'exact', head: true });
  const { count: linkedStudents } = await supabase.from('students').select('id', { count: 'exact', head: true }).not('telegram_id', 'is', null);
  const { count: totalStaff } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  const { count: linkedStaff } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).not('telegram_id', 'is', null);

  const { data: sysData } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).limit(1).maybeSingle();
  const showScores = sysData?.telegram_config?.show_project_scores_to_students !== false;
  const showAttendance = sysData?.telegram_config?.show_attendance_to_students !== false;

  const stuRate = (totalStudents || 0) > 0 ? Math.round(((linkedStudents || 0) / totalStudents!) * 100) : 0;

  const text = `⚙️ <b>لوحة تحكم المدير والإعدادات المتقدمة:</b>\n\n` +
    `📊 <b>إحصائيات المشتركين والمنضمين للبوت:</b>\n` +
    `👥 <b>الطلاب المرتبطين:</b> <b>${linkedStudents || 0}</b> من إجمالي ${totalStudents || 0} طالب (${stuRate}%)\n` +
    `👨‍🏫 <b>المعلمين المرتبطين:</b> <b>${linkedStaff || 0}</b> من إجمالي ${totalStaff || 0} معلم\n\n` +
    `🔒 <b>صلاحيات ورؤية الطلاب الحالية:</b>\n` +
    `• إظهار درجات المشاريع للطلاب: ${showScores ? 'مفعل ✅' : 'معطل ❌'}\n` +
    `• إتاحة استعلام الحضور للطلاب: ${showAttendance ? 'مفعل ✅' : 'معطل ❌'}\n\n` +
    `<i>اختر أحد الأوامر بالأسفل للإدارة أو فرمتة الحسابات:</i>`;

  const replyMarkup = {
    inline_keyboard: [
      [{ text: '👥 قائمة المعلمين المرتبطين', callback_data: 'admin_view_staff' }],
      [{ text: '🎓 آخر الطلاب المنضمين للبوت', callback_data: 'admin_recent_students' }],
      [{ text: '🔍 بحث عن طالب وفرمتة حسابه', callback_data: 'admin_search_student_reset' }],
      [{ text: `⭐️ درجات المشاريع: [ ${showScores ? 'مفعل ✅' : 'معطل ❌'} ]`, callback_data: 'admin_toggle_scores' }],
      [{ text: `📅 استعلام الحضور: [ ${showAttendance ? 'مفعل ✅' : 'معطل ❌'} ]`, callback_data: 'admin_toggle_attendance' }],
      [{ text: '🔙 العودة للقائمة الرئيسية', callback_data: 'admin_main_menu' }]
    ]
  };

  return { text, replyMarkup };
}

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // Fetch token & permissions
    const { data: sysData } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).limit(1).maybeSingle();
    const botToken = sysData?.telegram_config?.token;
    const showScoresToStudents = sysData?.telegram_config?.show_project_scores_to_students !== false;
    const showAttendanceToStudents = sysData?.telegram_config?.show_attendance_to_students !== false;

    // Default Menus
    const studentMainMenuMarkup = {
      inline_keyboard: [
        [{ text: '📸 رفع عمل جديد', callback_data: 'student_upload' }],
        [{ text: '📁 معرض أعمالي', callback_data: 'student_gallery' }],
        [{ text: '📅 سجل حضوري بالمقررات', callback_data: 'student_attendance' }]
      ]
    };

    const getAdminMainMenuMarkup = () => ({
      inline_keyboard: [
        [{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }],
        [{ text: '🕵️‍♂️ الدخول بحساب طالب (محاكاة)', callback_data: 'admin_login_student' }],
        [{ text: '⚙️ الإعدادات المتقدمة وإدارة المشتركين', callback_data: 'admin_advanced_settings' }]
      ]
    });

    // ==========================================
    // 1. Handle Text Messages (/start & Replies)
    // ==========================================
    
    // 0. Handle WebApp Data (QR Scanner / Manual Search)
    if (update.message?.web_app_data) {
      const chatId = update.message.chat.id;
      const messageId = update.message.message_id;
      await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId }) });
      try {
        const payload = JSON.parse(update.message.web_app_data.data);
        if (payload.type === 'SCAN_RESULT') {
          const { code: studentCode, crs, proj } = payload;
          const { data: student } = await supabase.from('students').select('*').eq('student_code', studentCode).maybeSingle();
          if (!student) {
            return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: '❌ لم يتم العثور على الطالب.', reply_markup: { inline_keyboard: [[{ text: '🔙 العودة', callback_data: 'main_menu' }]] } });
          }
          if (crs && proj) {
            // Teacher offline mode
            const host = request.headers.get('host') || 'art-faculty-app.vercel.app';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const cameraUrl = `${protocol}://${host}/camera?stu=${student.id}&crs=${crs}&proj=${proj}`;
            return NextResponse.json({
               method: 'sendMessage', chat_id: chatId, 
               text: `✅ الطالب: ${student.full_name}\n\nاضغط على الزر لفتح الكاميرا فوراً ورفع عمله:`, 
               reply_markup: { inline_keyboard: [[{ text: '📸 افتح الكاميرا الآن', web_app: { url: cameraUrl } }]] }
            });
          } else {
            // Normal Search
            const text = `🎓 <b>الطالب:</b> ${student.full_name}\n🔢 <b>الكود:</b> ${student.student_code}\n\nاختر إجراء:`;
            const replyMarkup = {
               inline_keyboard: [
                 [{ text: '❌ فك ارتباط التليجرام', callback_data: 't_unlink_' + student.id }],
                 [{ text: '🔙 العودة للبحث', callback_data: 'admin_advanced_settings' }]
               ]
            };
            return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup });
          }
        }
      } catch(e) {}
      return NextResponse.json({ ok: true });
    }

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const msgId = update.message.message_id;
      await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) });

      // --- Admin "Search Student for Reset / Format" Reply Handler ---
      if (update.message.reply_to_message && update.message.reply_to_message.text.includes('للبحث عنه وفرمتة حسابه')) {
        const query = text;
        let { data: students } = await supabase
          .from('students')
          .select('id, full_name, student_code, section, academic_year, telegram_id, telegram_username, telegram_first_name, updated_at')
          .eq('student_code', query);

        if (!students || students.length === 0) {
          const { data: byName } = await supabase
            .from('students')
            .select('id, full_name, student_code, section, academic_year, telegram_id, telegram_username, telegram_first_name, updated_at')
            .ilike('full_name', `%${query}%`)
            .limit(5);
          students = byName;
        }

        if (!students || students.length === 0) {
          return NextResponse.json({
            method: 'sendMessage',
            chat_id: chatId,
            text: `عفواً أيها المدير، لم يتم العثور على طالب بهذا الكود أو الاسم (${query}).`,
            reply_markup: { inline_keyboard: [[{ text: '🔍 بحث مجدداً', callback_data: 'admin_search_student_reset' }], [{ text: '🔙 عودة للإعدادات', callback_data: 'admin_advanced_settings' }]] }
          });
        }

        if (botToken) {
          for (const s of students) {
            const isLinked = !!s.telegram_id;
            const linkStatusText = isLinked
              ? `✅ <b>مرتبط بتليجرام:</b>\n🆔 آيدي: <code>${s.telegram_id}</code>\n👤 اسم الحساب: ${s.telegram_first_name || 'غير محدد'}\n🔗 المعرف: @${s.telegram_username || 'لا يوجد'}`
              : `❌ <b>غير مرتبط بتليجرام حالياً</b>`;

            const cardText = `👨‍🎓 <b>بيانات الطالب:</b>\n\n` +
              `👤 <b>الاسم:</b> <b>${s.full_name}</b>\n` +
              `📌 <b>الكود:</b> <code>${s.student_code}</code>\n` +
              `🏫 <b>الفرقة:</b> ${s.academic_year} - سكشن ${s.section}\n\n` +
              `📱 <b>حالة الارتباط:</b>\n${linkStatusText}`;

            const buttons: any[] = [];
            if (isLinked) {
              buttons.push([{ text: `🔄 فرمتة وفك ربط الحساب فوراً`, callback_data: `admin_do_reset_${s.id}` }]);
            }
            buttons.push([{ text: `🕵️‍♂️ محاكاة حسابه`, callback_data: `sim_upload_${s.student_code}` }]);

            await sendTelegramMessage(botToken, chatId, cardText, { inline_keyboard: buttons });
          }

          await sendTelegramMessage(botToken, chatId, `يمكنك الضغط على زر (فرمتة وفك ربط الحساب) لأي طالب لإلغاء ارتباطه القديم فوراً.`, {
            inline_keyboard: [[{ text: '🔍 بحث عن طالب آخر', callback_data: 'admin_search_student_reset' }], [{ text: '🔙 عودة للإعدادات', callback_data: 'admin_advanced_settings' }]]
          });
        }
        return NextResponse.json({ ok: true });
      }

      // --- Admin "Login as Student" Reply Handler ---
      if (update.message.reply_to_message && update.message.reply_to_message.text.includes('يرجى كتابة (كود الطالب)')) {
        const studentCode = text;
        const { data: student } = await supabase.from('students').select('*').eq('student_code', studentCode).limit(1).maybeSingle();
        
        if (!student) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `عفواً أيها المدير، لم أتمكن من العثور على طالب بالكود: ${studentCode}` });
        }

        let telegramInfo = '❌ (غير مربوط بأي حساب تليجرام حتى الآن)';
        if (student.telegram_id) {
          telegramInfo = `✅ (مربوط)\n🆔 آيدي الحساب: ${student.telegram_id}\n👤 اسم الحساب: ${student.telegram_first_name || 'غير معروف'}\n🔗 المعرف: @${student.telegram_username || 'لا يوجد'}`;
        }

        const caption = `🕵️‍♂️ (وضع المحاكاة نشط)\n👨‍🎓 الطالب: ${student.full_name}\n📌 الكود: ${student.student_code}\n\n📱 حالة ارتباط تليجرام:\n${telegramInfo}\n\nأنت الآن تتصفح البوت بصفتك هذا الطالب (كما سيراه هو تماماً). ماذا تريد أن تفعل؟`;
        
        const simButtons = [
          [{ text: '📸 رفع عمل جديد', callback_data: `sim_upload_${student.student_code}` }],
          [{ text: '📁 استعراض أعمال الطالب', callback_data: `sim_gallery_${student.id}` }],
          [{ text: '📅 سجل حضور الطالب', callback_data: `sim_att_${student.id}` }]
        ];

        if (student.telegram_id) {
          simButtons.push([{ text: `🔄 فرمتة وفك ربط هذا الطالب`, callback_data: `admin_do_reset_${student.id}` }]);
        }
        simButtons.push([{ text: '❌ إنهاء وضع المحاكاة', callback_data: `sim_exit` }]);

        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: caption,
          reply_markup: { inline_keyboard: simButtons }
        });
      }

      // --- Teacher "Grade Student Evaluation" Reply Handler ---
      if (update.message.reply_to_message && update.message.reply_to_message.text.includes('رصد درجة التقييم')) {
        const replyPrompt = update.message.reply_to_message.text;
        const evalMatch = replyPrompt.match(/\[EVAL:([a-f0-9\-]+)\]/);
        const evalId = evalMatch ? evalMatch[1] : null;

        const scoreNum = parseFloat(text);
        if (isNaN(scoreNum)) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: '❌ يرجى إدخال رقم صحيح للدرجة (مثلاً: 28).' });
        }

        if (evalId) {
          const { data: evalRecord } = await supabase
            .from('evaluations')
            .select('id, project_name, course_id, student_id, students ( full_name, telegram_id )')
            .eq('id', evalId)
            .limit(1).maybeSingle();

          if (evalRecord) {
            await supabase.from('evaluations').update({ score: scoreNum }).eq('id', evalId);

            let projectShowScore = true;
            if (evalRecord.course_id) {
              const { data: c } = await supabase.from('courses').select('custom_week_names').eq('id', evalRecord.course_id).limit(1).maybeSingle();
              const proj = ((c?.custom_week_names as any)?.__projects__ || []).find((p: any) => p.name === evalRecord.project_name);
              if (proj && proj.show_score === false) {
                projectShowScore = false;
              }
            }

            // Notify Teacher
            await sendTelegramMessage(botToken, chatId, `✅ <b>تم رصد الدرجة بنجاح!</b>\n\n👨‍🎓 الطالب: ${(evalRecord.students as any)?.full_name}\n📝 المشروع: ${evalRecord.project_name}\n⭐️ الدرجة: <b>${scoreNum}</b>`);

            // Notify Student if connected
            const studentTgId = (evalRecord.students as any)?.telegram_id;
            if (studentTgId && botToken) {
              const studentScoreMsg = (showScoresToStudents && projectShowScore)
                ? `🎉 <b>تم رصد وتقييم عملك!</b>\n\n📝 <b>المشروع:</b> ${evalRecord.project_name}\n⭐️ <b>الدرجة المرصودة:</b> <b>${scoreNum}</b>\n\n<i>يمكنك الاطلاع على أعمالك عبر زر (معرض أعمالي).</i>`
                : `🎉 <b>تم اعتماد وتقييم عملك بنجاح!</b>\n\n📝 <b>المشروع:</b> ${evalRecord.project_name}\n✅ <b>الحالة:</b> معتمد ومقيّم.\n\n<i>يمكنك متابعة أعمالك عبر زر (معرض أعمالي).</i>`;

              sendTelegramMessage(botToken, studentTgId, studentScoreMsg);
            }
            return NextResponse.json({ ok: true });
          }
        }
      }

      // --- /start Handler ---
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const payload = parts.length > 1 ? parts[1] : '';
        let replyText = '';
        let replyMarkup: any = null;

        if (payload) {
          if (payload.startsWith('stu_')) {
            const rawPayload = payload.replace('stu_', '');
            const codeParts = rawPayload.split('_');
            const studentCode = codeParts[0];
            const browserId = codeParts.slice(1).join('_');

            const { data: student } = await supabase.from('students').select('*').eq('student_code', studentCode).limit(1).maybeSingle();
            
            if (!student) {
              replyText = `عفواً، لم يتم العثور على طالب بهذا الكود. يرجى مراجعة الإدارة.`;
            } else if (student.telegram_id && student.telegram_id !== chatId.toString() && student.telegram_id !== chatId) {
              replyText = `⚠️ هذا الكود مربوط مسبقاً بحساب تليجرام آخر! إذا كنت تعتقد أن هناك خطأ، يرجى التوجه للإدارة.`;
            } else {
              // Check if THIS telegram account is already linked to ANOTHER student
              const { data: otherStudent } = await supabase.from('students').select('id, full_name').eq('telegram_id', chatId.toString()).limit(1).maybeSingle();
              if (otherStudent && (otherStudent as any).id !== student.id) {
                return NextResponse.json({
                  method: 'sendMessage',
                  chat_id: chatId,
                  text: `🚨 تنبيه أمني: حساب التليجرام الخاص بك مربوط بالفعل بالطالب (${(otherStudent as any).full_name})! لا يُسمح بربط أكثر من طالب بنفس الحساب.`
                });
              }

              replyText = `⚠️ <b>تنبيه هام ومصيري!</b>\n\nأنت على وشك ربط هاتفك وحسابك بالطالب:\n👨‍🎓 <b>${student.full_name}</b>\n\nبمجرد الضغط على (تأكيد)، <b>لن تتمكن أبداً من تغيير هذا الاسم</b>، وسيتم تسجيل جميع أعمالك وحضورك تحت هذا الاسم حتى تخرجك!\n\nهل أنت متأكد أن هذا هو اسمك؟`;
              replyMarkup = {
                inline_keyboard: [
                  [{ text: '✅ نعم، أنا هذا الطالب (تأكيد)', callback_data: `confirm_link_${student.id}_${browserId}` }],
                  [{ text: '❌ لا، إلغاء', callback_data: `cancel_link` }]
                ]
              };
            }
          } else {
            const { data: profile } = await supabase.from('profiles').select('*').eq('telegram_link_token', payload).limit(1).maybeSingle();
            if (profile) {
              await supabase.from('profiles').update({ telegram_id: chatId.toString(), telegram_link_token: null }).eq('id', profile.id);
              const roleName = profile.role === 'مدير' ? 'المدير 👑' : 'عضو هيئة التدريس 👨‍🏫';
              replyText = `مرحباً بك د. ${profile.full_name} 🎓\n\nلقد تم ربط حسابك بنجاح بصلاحية (${roleName}).`;
              
              if (profile.role === 'مدير') {
                replyMarkup = getAdminMainMenuMarkup();
              } else {
                replyMarkup = { inline_keyboard: [[{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }]] };
              }

            } else {
              replyText = `عفواً، رابط التفعيل غير صحيح أو منتهي الصلاحية.`;
            }
          }
        } else {
          const { data: existingProfile } = await supabase.from('profiles').select('*').eq('telegram_id', chatId.toString()).limit(1).maybeSingle();
          if (existingProfile) {
            replyText = `أهلاً بعودتك د. ${existingProfile.full_name} 🎓\nكيف يمكنني مساعدتك؟`;
            
            if (existingProfile.role === 'مدير') {
              replyMarkup = getAdminMainMenuMarkup();
            } else {
              replyMarkup = { inline_keyboard: [[{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }]] };
            }

          } else {
            const { data: knownStudent } = await supabase.from('students').select('*').eq('telegram_id', chatId.toString()).limit(1).maybeSingle();
            if (knownStudent) {
              replyText = `مرحباً بك يا <b>${knownStudent.full_name}</b> 👨‍🎓\n\nماذا تريد أن تفعل اليوم؟`;
              replyMarkup = studentMainMenuMarkup;
            } else {
              replyText = `مرحباً بك في المنظومة الأكاديمية! للحصول على رابط ربط حسابك، يرجى مسح بطاقتك أو الدخول من بوابة الطالب.`;
            }
          }
        }
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: replyText, reply_markup: replyMarkup });
      }
      return NextResponse.json({ ok: true });
    }

    // ==========================================
    // 2. Handle Inline Button Clicks
    // ==========================================
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const tgUserId = callbackQuery.from.id;

      // =====================================================
      // STUDENT ACTIONS
      // =====================================================
      if (data === 'cancel_link') {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'تم إلغاء عملية الربط.' });
      }

      if (data.startsWith('confirm_link_')) {
        const withoutPrefix = data.slice('confirm_link_'.length);
        const studentId = withoutPrefix.slice(0, 36);
        const browserId = withoutPrefix.length > 37 ? withoutPrefix.slice(37) : '';
        const { data: student } = await supabase.from('students').select('*').eq('id', studentId).limit(1).maybeSingle();
        if (!student) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'خطأ: لم يتم العثور على الطالب.' });
        if (student.telegram_id && student.telegram_id !== chatId.toString()) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'خطأ: هذا الطالب مربوط بحساب آخر.' });
        await supabase.from('students').update({ telegram_id: chatId.toString(), telegram_username: callbackQuery.from.username || null, telegram_first_name: callbackQuery.from.first_name || null, telegram_browser_id: browserId || null }).eq('id', student.id);
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `تم التأكيد! أهلاً بك يا ${student.full_name} 👨‍🎓\n\nتم قفل هذا الحساب على اسمك بنجاح ✅\nيمكنك الآن استخدامه لرفع أعمالك ومتابعة حضورك.`, reply_markup: studentMainMenuMarkup });
      }

      // --- Student Gallery Handler ---
      if (data === 'student_gallery' || data.startsWith('sim_gallery_')) {
        let stuId = null;
        if (data.startsWith('sim_gallery_')) {
          stuId = data.replace('sim_gallery_', '');
        } else {
          stuId = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).limit(1).maybeSingle()).data?.id;
        }

        if (!stuId) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على حسابك. يرجى التسجيل أولاً.' });

        const { data: evals } = await supabase
          .from('evaluations')
          .select('id, project_name, score, photo_url, created_at, courses ( name )')
          .eq('student_id', stuId)
          .not('photo_url', 'is', null)
          .order('created_at', { ascending: false });

        if (!evals || evals.length === 0) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: '📁 <b>معرض أعمالك فارغ حالياً.</b>\n\nلم تقم برفع أي لوحات أو مشاريع بعد. يمكنك الضغط على زر (رفع عمل جديد) لبدء التصوير!', reply_markup: { inline_keyboard: [[{ text: '📸 رفع عمل جديد', callback_data: 'student_upload' }]] } });
        }

        if (botToken) {
          await sendTelegramMessage(botToken, chatId, `📁 <b>معرض أعمالك (${evals.length} أعمال مرفوعة):</b>\n\nجاري إرسال اللوحات... 👇`);
          for (const ev of evals) {
            const courseName = (ev.courses as any)?.name || 'مقرر';
            const uploadTimeStr = formatRelativeTimeArabic(ev.created_at);
            
            let scoreText = '⏳ <b>الحالة:</b> بانتظار التقييم';
            if (ev.score !== null && ev.score !== undefined && ev.score > 0) {
              scoreText = showScoresToStudents
                ? `⭐️ <b>الدرجة:</b> ${ev.score}`
                : `⭐️ <b>الحالة:</b> تم التقييم بنجاح ✅`;
            }

            const caption = `🎨 <b>المشروع:</b> ${ev.project_name}\n📚 <b>المقرر:</b> ${courseName}\n⏱️ <b>وقت الرفع:</b> ${uploadTimeStr}\n${scoreText}`;
            await sendTelegramPhoto(botToken, chatId, ev.photo_url, caption);
          }
        }
        return NextResponse.json({ ok: true });
      }

      // --- Student Attendance Inquiry Handler ---
      if (data === 'student_attendance' || data.startsWith('sim_att_')) {
        let stuId = null;
        let isSimulation = false;

        if (data.startsWith('sim_att_')) {
          isSimulation = true;
          stuId = data.replace('sim_att_', '');
        } else {
          stuId = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).limit(1).maybeSingle()).data?.id;
        }

        if (!stuId) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على حسابك. يرجى التسجيل أولاً.' });

        // Check Admin Permission
        if (!showAttendanceToStudents && !isSimulation) {
          return NextResponse.json({
            method: 'sendMessage',
            chat_id: chatId,
            text: '⚠️ <b>عفواً، خاصية الاستعلام عن الحضور معطلة حالياً من قبل إدارة الكلية.</b>'
          });
        }

        const { data: student } = await supabase.from('students').select('*').eq('id', stuId).limit(1).maybeSingle();
        if (!student) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على بيانات الطالب.' });

        const { data: courses } = await supabase.from('courses').select('*').eq('academic_year', student.academic_year);
        if (!courses || courses.length === 0) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا توجد مقررات متاحة لفرقتك حالياً.' });
        }

        const availableCourses = courses.filter(c => {
          if (c.course_type === 'sections' && c.sections && Array.isArray(c.sections)) return c.sections.includes(student.section);
          return true;
        });

        if (availableCourses.length === 0) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا توجد مقررات مسجلة لشعبتك حالياً.' });
        }

        const prefix = isSimulation ? 'sim_att_crs_' : 'stu_att_crs_';
        const keyboard = availableCourses.map(c => [{ text: `📚 ${c.name}`, callback_data: `${prefix}${c.id}` }]);
        
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: `📅 <b>سجل الحضور والغياب:</b>\n\nاختر المقرر لمعرفة عدد مرات حضورك وغيابك:`,
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      // --- Student Course Attendance Detail Handler ---
      if (data.startsWith('stu_att_crs_') || data.startsWith('sim_att_crs_')) {
        const isSimulation = data.startsWith('sim_att_crs_');
        const crsId = data.replace(isSimulation ? 'sim_att_crs_' : 'stu_att_crs_', '');

        let stuId = null;
        if (isSimulation) {
          const { data: profile } = await supabase.from('profiles').select('telegram_link_token').eq('telegram_id', chatId.toString()).limit(1).maybeSingle();
          if (profile?.telegram_link_token?.startsWith('SIM_')) {
            stuId = profile.telegram_link_token.replace('SIM_', '');
          }
        } else {
          stuId = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).limit(1).maybeSingle()).data?.id;
        }

        if (!stuId) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، انتهت الجلسة أو الحساب غير مسجل.' });

        const { data: course } = await supabase.from('courses').select('*, profiles ( full_name )').eq('id', crsId).limit(1).maybeSingle();
        const teacherName = (course?.profiles as any)?.full_name || 'أستاذ المقرر';

        const { data: attRecords } = await supabase
          .from('attendance')
          .select('date, status')
          .eq('course_id', crsId)
          .eq('student_id', stuId)
          .order('date', { ascending: true });

        const presentCount = (attRecords || []).filter(a => a.status === 'حاضر').length;
        const absentCount = (attRecords || []).filter(a => a.status === 'غائب').length;
        const permissionCount = (attRecords || []).filter(a => a.status === 'إذن').length;
        const totalWeeks = (attRecords || []).length;
        const attendanceRate = totalWeeks > 0 ? Math.round((presentCount / totalWeeks) * 100) : 100;

        let reportMsg = `📊 <b>تقرير الحضور لمقرر (${course?.name || 'المقرر'}):</b>\n\n` +
          `👨‍🏫 <b>أستاذ المقرر:</b> د. ${teacherName}\n\n` +
          `✅ <b>مرات الحضور:</b> ${presentCount} أسابيع\n` +
          `❌ <b>مرات الغياب:</b> ${absentCount} أسابيع\n` +
          `📝 <b>مرات الإذن:</b> ${permissionCount}\n` +
          `📈 <b>نسبة الحضور:</b> <b>${attendanceRate}%</b>\n\n`;

        if (attRecords && attRecords.length > 0) {
          reportMsg += `🗓️ <b>تفاصيل التواريخ المسجلة:</b>\n`;
          attRecords.forEach((a, idx) => {
            const icon = a.status === 'حاضر' ? '✅' : a.status === 'غائب' ? '❌' : '📝';
            reportMsg += `${idx + 1}. ${a.date} : ${icon} (${a.status})\n`;
          });
        } else {
          reportMsg += `ℹ️ <i>لم يتم رصد أي جلسات حضور أو غياب لك في هذا المقرر حتى الآن.</i>`;
        }

        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: reportMsg,
          reply_markup: studentMainMenuMarkup
        });
      }

      // --- Student Upload OR Sim Upload ---
      if (data === 'student_upload' || data.startsWith('sim_upload_')) {
        let studentIdForAction = null;
        let isSimulation = false;
        
        if (data === 'student_upload') {
          studentIdForAction = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).limit(1).maybeSingle()).data?.id;
          if (!studentIdForAction) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على حسابك. يرجى التسجيل أولاً.' });
        } else {
          isSimulation = true;
          const simStudentCode = data.replace('sim_upload_', '');
          studentIdForAction = (await supabase.from('students').select('id').eq('student_code', simStudentCode).limit(1).maybeSingle()).data?.id;
          if (!studentIdForAction) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على الطالب.' });
          
          await supabase.from('profiles').update({ telegram_link_token: `SIM_${studentIdForAction}` }).eq('telegram_id', chatId.toString());
        }

        const { data: student } = await supabase.from('students').select('*').eq('id', studentIdForAction).limit(1).maybeSingle();
        if (!student) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على الطالب.' });
        
        const { data: courses } = await supabase.from('courses').select('*').eq('academic_year', student.academic_year);
        if (!courses || courses.length === 0) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا يوجد مقررات متاحة لفرقتك حالياً.' });
        
        const availableCourses = courses.filter(c => {
          if (c.course_type === 'sections' && c.sections && Array.isArray(c.sections)) return c.sections.includes(student.section);
          return true;
        });
        if (availableCourses.length === 0) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا يوجد مقررات متاحة لشعبتك حالياً.' });
        
        const prefix = isSimulation ? 'sim_crs_' : 'stu_crs_';
        const keyboard = availableCourses.map(c => [{ text: `📚 ${c.name} - ${c.academic_year}`, callback_data: `${prefix}${c.id}` }]);
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `📚 مقررات فرقتك (${student.academic_year}):\n\nاختر المقرر لرفع تقييم جديد:`, reply_markup: { inline_keyboard: keyboard } });
      }

      if (data.startsWith('stu_crs_') || data.startsWith('sim_crs_')) {
        const isSimulation = data.startsWith('sim_crs_');
        const crsId = data.replace(isSimulation ? 'sim_crs_' : 'stu_crs_', '');
        
        let stuId = null;
        if (isSimulation) {
           const { data: profile } = await supabase.from('profiles').select('telegram_link_token').eq('telegram_id', chatId.toString()).limit(1).maybeSingle();
           if (profile?.telegram_link_token?.startsWith('SIM_')) {
               stuId = profile.telegram_link_token.replace('SIM_', '');
           }
        } else {
           stuId = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).limit(1).maybeSingle()).data?.id;
        }
        if (!stuId) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، انتهت الجلسة أو الحساب غير مسجل.' });

        const { data: course } = await supabase.from('courses').select('custom_week_names, name').eq('id', crsId).limit(1).maybeSingle();
        const projects = ((course?.custom_week_names as any)?.__projects__ || []).filter((p: any) => !p.is_archived);
        if (projects.length === 0) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `لا يوجد مشاريع مطلوبة في مقرر (${(course as any)?.name || ''}) حالياً.` });
        
        const prefix = isSimulation ? 'sim_proj_' : 'stu_proj_';
        const now = new Date();
        const keyboard: any[] = [];
        
        let textMsg = 'اختر المشروع أو التقييم المطلوب:\n\n';

        projects.forEach((p: any) => {
          let isOpen = p.is_active !== false;
          let dateStr = '';
          
          if (isOpen && p.start_date) {
            if (now < new Date(p.start_date)) {
              isOpen = false;
              dateStr = ` (يفتح في ${new Date(p.start_date).toLocaleDateString('ar-EG')})`;
            }
          }
          if (isOpen && p.end_date) {
            if (now > new Date(p.end_date)) {
              isOpen = false;
              dateStr = ` (مغلق لانتهاء الموعد)`;
            } else {
              dateStr = ` (حتى ${new Date(p.end_date).toLocaleDateString('ar-EG')})`;
            }
          }

          if (isOpen) {
             keyboard.push([{ text: `📝 ${p.name} (الدرجة: ${p.max_score})${dateStr}`, callback_data: `${prefix}${crsId}_${p.id}` }]);
          } else {
             keyboard.push([{ text: `🔒 ${p.name} (مغلق)${dateStr}`, callback_data: `closed_project` }]);
          }
        });

        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: textMsg, reply_markup: { inline_keyboard: keyboard } });
      }

      if (data === 'closed_project') {
        return NextResponse.json({ method: 'answerCallbackQuery', callback_query_id: callbackQuery.id, text: 'عفواً، هذا المشروع مغلق حالياً.', show_alert: true });
      }

      if (data.startsWith('stu_proj_') || data.startsWith('sim_proj_')) {
        const isSimulation = data.startsWith('sim_proj_');
        const withoutPrefix = data.replace(isSimulation ? 'sim_proj_' : 'stu_proj_', '');
        const underscoreIdx = withoutPrefix.indexOf('_');
        const crsId = withoutPrefix.slice(0, underscoreIdx);
        const projId = withoutPrefix.slice(underscoreIdx + 1);
        
        let stuId = null;
        if (isSimulation) {
           const { data: profile } = await supabase.from('profiles').select('telegram_link_token').eq('telegram_id', chatId.toString()).limit(1).maybeSingle();
           if (profile?.telegram_link_token?.startsWith('SIM_')) {
               stuId = profile.telegram_link_token.replace('SIM_', '');
           }
        } else {
           stuId = (await supabase.from('students').select('id').eq('telegram_id', chatId.toString()).limit(1).maybeSingle()).data?.id;
        }
        if (!stuId) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، انتهت الجلسة أو الحساب غير مسجل.' });

        const host = request.headers.get('host') || 'art-faculty-app.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const cameraUrl = `${protocol}://${host}/camera?stu=${stuId}&crs=${crsId}&proj=${projId}`;
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'ممتاز! ✅\nاضغط على الزر بالأسفل لفتح الكاميرا.\n\n⚠️ تأكد من الإضاءة الجيدة وعدم اهتزاز الهاتف.', reply_markup: { inline_keyboard: [[{ text: '📸 تصوير المشروع', web_app: { url: cameraUrl } }]] } });
      }

      // =====================================================
      // STAFF & ADMIN ACTIONS
      // =====================================================
      const { data: profile } = await supabase.from('profiles').select('*').eq('telegram_id', tgUserId.toString()).limit(1).maybeSingle();
      if (!profile) {
        const { data: knownStudent } = await supabase.from('students').select('full_name').eq('telegram_id', tgUserId.toString()).limit(1).maybeSingle();
        if (knownStudent) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `مرحباً ${(knownStudent as any).full_name}!\n\nاختر ما تريد:`, reply_markup: studentMainMenuMarkup });
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، حسابك غير مسجل في النظام.' });
      }

      // --- ADMIN MAIN MENU ---
      if (data === 'admin_main_menu') {
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: `👑 <b>القائمة الرئيسية للإدارة:</b>\nمرحباً بك د. ${profile.full_name}`,
          reply_markup: getAdminMainMenuMarkup()
        });
      }

      // --- ADMIN ADVANCED SETTINGS ---
      if (data === 'admin_advanced_settings' && profile.role === 'مدير') {
        // Auto-unlink admin from any student records they might have used for testing to prevent weird conflicts
        await supabase.from('students').update({ 
          telegram_id: null, 
          telegram_username: null, 
          telegram_first_name: null,
          telegram_browser_id: null
        }).eq('telegram_id', tgUserId.toString());

        const viewData = await getAdminSettingsView();
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: viewData.text,
          reply_markup: viewData.replyMarkup
        });
      }

      // --- ADMIN TOGGLE PROJECT SCORES ---
      if (data === 'admin_toggle_scores' && profile.role === 'مدير') {
        const { data: sData } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).limit(1).maybeSingle();
        const cur = sData?.telegram_config || {};
        const newScoresFlag = cur.show_project_scores_to_students === false ? true : false;
        
        await supabase.from('system_settings').update({
          telegram_config: { ...cur, show_project_scores_to_students: newScoresFlag },
          updated_at: new Date().toISOString()
        }).eq('id', 1);

        const viewData = await getAdminSettingsView();
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: `✅ تم تغيير إعداد إظهار درجات المشاريع إلى: (<b>${newScoresFlag ? 'مفعل ✅' : 'معطل ❌'}</b>)\n\n` + viewData.text,
          reply_markup: viewData.replyMarkup
        });
      }

      // --- ADMIN TOGGLE ATTENDANCE INQUIRY ---
      if (data === 'admin_toggle_attendance' && profile.role === 'مدير') {
        const { data: sData } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).limit(1).maybeSingle();
        const cur = sData?.telegram_config || {};
        const newAttFlag = cur.show_attendance_to_students === false ? true : false;
        
        await supabase.from('system_settings').update({
          telegram_config: { ...cur, show_attendance_to_students: newAttFlag },
          updated_at: new Date().toISOString()
        }).eq('id', 1);

        const viewData = await getAdminSettingsView();
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: `✅ تم تغيير إعداد استعلام الحضور إلى: (<b>${newAttFlag ? 'مفعل ✅' : 'معطل ❌'}</b>)\n\n` + viewData.text,
          reply_markup: viewData.replyMarkup
        });
      }

      // --- ADMIN VIEW LINKED STAFF ---
      if (data === 'admin_view_staff' && profile.role === 'مدير') {
        const { data: allStaff } = await supabase.from('profiles').select('id, full_name, role, telegram_id').order('role');
        
        let staffMsg = `👥 <b>قائمة أعضاء هيئة التدريس بالنظام (${allStaff?.length || 0} عضو):</b>\n\n`;
        (allStaff || []).forEach((st, idx) => {
          const roleBadge = st.role === 'مدير' ? '👑 مدير' : '👨‍🏫 عضو تدريس';
          const linkBadge = st.telegram_id ? `✅ (مرتبط: <code>${st.telegram_id}</code>)` : `❌ (غير مرتبط)`;
          staffMsg += `${idx + 1}. <b>${st.full_name}</b> [${roleBadge}]\n   ${linkBadge}\n\n`;
        });

        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: staffMsg,
          reply_markup: { inline_keyboard: [[{ text: '🔙 عودة للإعدادات المتقدمة', callback_data: 'admin_advanced_settings' }]] }
        });
      }

      // --- ADMIN VIEW RECENT LINKED STUDENTS ---
      if (data === 'admin_recent_students' && profile.role === 'مدير') {
        const { data: recentStudents } = await supabase
          .from('students')
          .select('id, full_name, student_code, section, academic_year, telegram_id, telegram_username, telegram_first_name, updated_at')
          .not('telegram_id', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(15);

        if (!recentStudents || recentStudents.length === 0) {
          return NextResponse.json({
            method: 'sendMessage',
            chat_id: chatId,
            text: 'لا يوجد أي طلاب منضمين للبوت حتى الآن.',
            reply_markup: { inline_keyboard: [[{ text: '🔙 عودة للإعدادات', callback_data: 'admin_advanced_settings' }]] }
          });
        }

        if (botToken) {
          await sendTelegramMessage(botToken, chatId, `🎓 <b>آخر الطلاب المنضمين للبوت (${recentStudents.length} طالب):</b>\nيمكنك فرمتة وفك ربط أي طالب بالضغط على الزر المخصص له 👇`);
          
          for (const s of recentStudents) {
            const timeAgo = s.updated_at ? formatRelativeTimeArabic(s.updated_at) : 'مؤخراً';
            const sMsg = `👨‍🎓 <b>${s.full_name}</b>\n` +
              `📌 <b>الكود:</b> <code>${s.student_code}</code> | <b>الفرقة:</b> ${s.academic_year} (ش:${s.section})\n` +
              `📱 <b>الحساب:</b> @${s.telegram_username || 'لا يوجد'} (ID: <code>${s.telegram_id}</code>)\n` +
              `⏱️ <b>آخر نشاط:</b> ${timeAgo}`;

            const buttons = [
              [
                { text: `🔄 فرمتة وفك ربط: ${s.full_name.split(' ')[0]}`, callback_data: `admin_do_reset_${s.id}` },
                { text: `🕵️‍♂️ محاكاة`, callback_data: `sim_upload_${s.student_code}` }
              ]
            ];

            await sendTelegramMessage(botToken, chatId, sMsg, { inline_keyboard: buttons });
          }

          await sendTelegramMessage(botToken, chatId, `انتهت القائمة.`, {
            inline_keyboard: [
              [{ text: '🔍 بحث عن طالب بالاسم/الكود', callback_data: 'admin_search_student_reset' }],
              [{ text: '🔙 عودة للإعدادات المتقدمة', callback_data: 'admin_advanced_settings' }]
            ]
          });
        }
        return NextResponse.json({ ok: true });
      }

      // --- ADMIN SEARCH STUDENT FOR RESET PROMPT ---
      if (data === 'admin_search_student_reset' && profile.role === 'مدير') {
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: `🔍 <b>البحث عن طالب وفرمتة حسابه:</b>\n\nيرجى الرد على هذه الرسالة بكتابة (كود الطالب) أو جزء من اسمه للبحث عنه وفرمتة حسابه:`,
          reply_markup: { force_reply: true, selective: true }
        });
      }

      // --- ADMIN DO RESET / FORMAT STUDENT ---
      if (data.startsWith('admin_do_reset_') && profile.role === 'مدير') {
        const studentId = data.replace('admin_do_reset_', '');
        const { data: student } = await supabase.from('students').select('*').eq('id', studentId).limit(1).maybeSingle();
        
        if (!student) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، لم يتم العثور على هذا الطالب.' });
        }

        const prevTelegramId = student.telegram_id;

        // Clear Telegram linkage from student record
        await supabase.from('students').update({
          telegram_id: null,
          telegram_username: null,
          telegram_first_name: null,
          telegram_browser_id: null,
          updated_at: new Date().toISOString()
        }).eq('id', studentId);

        // Send alert to the unlinked telegram account if available
        if (prevTelegramId && botToken) {
          sendTelegramMessage(botToken, prevTelegramId, `⚠️ <b>تنبيه من إدارة الكلية:</b>\n\nتم فك ارتباط حسابك بالطالب (${student.full_name}).\nإذا كنت صاحب الكود، يمكنك إعادة مسح بطاقتك أو الدخول من بوابة الطالب وربط حسابك مجدداً.`);
        }

        const successMsg = `✅ <b>تم فرمتة وفك ربط حساب الطالب بنجاح!</b>\n\n` +
          `👨‍🎓 <b>الطالب:</b> <b>${student.full_name}</b>\n` +
          `📌 <b>الكود:</b> <code>${student.student_code}</code>\n\n` +
          `🔓 <i>تم مسح الارتباط السابق بالكامل. أصبح بإمكان الطالب الآن فتح البوابة من هاتفه أو مسح بطاقته وربط حسابه الشرعي مجدداً بكل حرية وسهولة.</i>`;

        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: successMsg,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 بحث عن طالب آخر', callback_data: 'admin_search_student_reset' }],
              [{ text: '🔙 عودة للإعدادات المتقدمة', callback_data: 'admin_advanced_settings' }]
            ]
          }
        });
      }

      // --- ADMIN LOGIN STUDENT (SIMULATION) ---
      if (data === 'admin_login_student' && profile.role === 'مدير') {
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: 'يرجى كتابة (كود الطالب) الذي تود محاكاة حسابه:',
          reply_markup: { force_reply: true, selective: true }
        });
      }

      if (data === 'sim_exit') {
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: 'تم إنهاء وضع المحاكاة. عودة لصلاحيات الإدارة 👑',
          reply_markup: getAdminMainMenuMarkup()
        });
      }

      // --- Grade / Rate Evaluation Action ---
      if (data.startsWith('rate_ev_')) {
        const evalId = data.replace('rate_ev_', '');
        const { data: ev } = await supabase
          .from('evaluations')
          .select('id, project_name, student_id, students ( full_name )')
          .eq('id', evalId)
          .limit(1).maybeSingle();

        if (!ev) return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على هذا التقييم.' });

        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: `⭐️ <b>رصد درجة التقييم [EVAL:${ev.id}]</b>\n\n👨‍🎓 الطالب: <b>${(ev.students as any)?.full_name}</b>\n📝 المشروع: <b>${ev.project_name}</b>\n\n<i>يرجى الرد على هذه الرسالة بكتابة الدرجة مباشرة (مثلاً: 25):</i>`,
          reply_markup: { force_reply: true, selective: true }
        });
      }

      // --- Delete / Cancel Evaluation Action ---
      if (data.startsWith('del_ev_')) {
        const evalId = data.replace('del_ev_', '');
        const { data: ev } = await supabase
          .from('evaluations')
          .select('id, project_name, student_id, students ( full_name, telegram_id )')
          .eq('id', evalId)
          .limit(1).maybeSingle();

        if (ev) {
          await supabase.from('evaluations').update({ photo_url: null, ai_status: null, score: 0 }).eq('id', evalId);

          const studentTg = (ev.students as any)?.telegram_id;
          if (studentTg && botToken) {
            sendTelegramMessage(botToken, studentTg, `⚠️ <b>تنبيه بخصوص مشروع (${ev.project_name}):</b>\n\nتم إلغاء اعتماد العمل المرفوع بواسطة أستاذ المقرر.\nيمكنك الآن فتح الكاميرا وإعادة تصوير مشروعك ورفعه مجدداً.`);
          }

          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `✅ تم إلغاء العمل وحذفه بنجاح للطالب (${(ev.students as any)?.full_name}). أصبح بإمكان الطالب الآن إعادة الرفع.` });
        }
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لم يتم العثور على العمل المطلوب حذفه.' });
      }

      // --- Course Single Project Statistics Action ---
      if (data.startsWith('pstats_')) {
        const withoutPrefix = data.replace('pstats_', '');
        const underscoreIdx = withoutPrefix.indexOf('_');
        const crsId = withoutPrefix.slice(0, underscoreIdx);
        const projId = withoutPrefix.slice(underscoreIdx + 1);

        const { data: course } = await supabase.from('courses').select('*').eq('id', crsId).limit(1).maybeSingle();
        const projects = ((course?.custom_week_names as any)?.__projects__ || []);
        const project = projects.find((p: any) => p.id === projId);
        const projName = project ? project.name : 'المشروع';

        const { data: allStudents } = await supabase.from('students').select('id, full_name, student_code, section').eq('academic_year', course?.academic_year);
        let eligibleStudents = allStudents || [];
        if (course?.course_type === 'sections' && course.sections && Array.isArray(course.sections)) {
          eligibleStudents = eligibleStudents.filter(s => course.sections.includes(s.section));
        }

        const { data: evals } = await supabase
          .from('evaluations')
          .select('student_id, score, created_at')
          .eq('course_id', crsId)
          .eq('project_name', projName)
          .not('photo_url', 'is', null);

        const submittedIds = new Set((evals || []).map(e => e.student_id));
        const missingStudents = eligibleStudents.filter(s => !submittedIds.has(s.id));

        let statsMsg = `📊 <b>إحصائيات مشروع (${projName}) - ${course?.name}:</b>\n\n` +
          `👥 <b>إجمالي الطلاب المطلوب منهم:</b> ${eligibleStudents.length}\n` +
          `✅ <b>عدد من قام بالرفع:</b> ${submittedIds.size} طالب (${eligibleStudents.length > 0 ? Math.round((submittedIds.size / eligibleStudents.length) * 100) : 0}%)\n` +
          `❌ <b>عدد المتأخرين (لم يرفعوا):</b> ${missingStudents.length} طالب\n\n`;

        if (missingStudents.length > 0) {
          statsMsg += `📋 <b>قائمة الطلاب المتأخرين عن الرفع:</b>\n`;
          missingStudents.slice(0, 30).forEach((s, idx) => {
            statsMsg += `${idx + 1}. ${s.full_name} (كود: ${s.student_code} - ش:${s.section})\n`;
          });
          if (missingStudents.length > 30) {
            statsMsg += `... وغيرهم ${missingStudents.length - 30} طالب آخرين.`;
          }
        } else {
          statsMsg += `🎉 <b>رائع! جميع الطلاب قاموا برفع هذا المشروع!</b>`;
        }

        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: statsMsg });
      }

      // --- BROWSE COURSES (Staff) ---
      if (data === 'staff_browse_courses') {
        const { data: allCourses } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
        let userCourses = allCourses || [];
        
        if (profile.role !== 'مدير') {
          userCourses = userCourses.filter(c => c.teacher_id === profile.id || (c.shared_with && c.shared_with.includes(profile.id)));
        }

        if (userCourses.length === 0) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا يوجد لديك مقررات حالياً.' });
        }

        const keyboard = userCourses.map(c => {
          const yearName = c.academic_year || 'عام';
          return [{ text: `📚 ${c.name} - ${yearName}`, callback_data: `view_course_${c.id}` }];
        });
        
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: 'قم باختيار المقرر لعرض أعمال الطلاب وإحصائيات المشاريع:',
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      // --- VIEW COURSE ARTWORKS & STATS ---
      if (data.startsWith('view_course_')) {
        const courseId = data.replace('view_course_', '');
        const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).limit(1).maybeSingle();
        
        if (botToken) {
          await sendTelegramMessage(botToken, chatId, `جاري تجميع أعمال مقرر (${course?.name || ''})... يرجى الانتظار ⏳`);
        }

        const projects = ((course?.custom_week_names as any)?.__projects__ || []).filter((p: any) => !p.is_archived);

        if (projects.length > 0) {
          const statsButtons = projects.map((p: any) => [
            { text: `📊 إحصائية وتأخيرات: ${p.name}`, callback_data: `pstats_${courseId}_${p.id}` }
          ]);
          if (botToken) {
            await sendTelegramMessage(botToken, chatId, `📊 <b>إحصائيات مشاريع المقرر:</b>\nاختر أي مشروع لمعرفة من قام بالرفع ومن تأخر:`, { inline_keyboard: statsButtons });
          }
        }

        const { data: evals } = await supabase
          .from('evaluations')
          .select('id, project_name, score, photo_url, created_at, students ( id, full_name, student_code, section )')
          .eq('course_id', courseId)
          .not('photo_url', 'is', null)
          .order('created_at', { ascending: false });

        if (!evals || evals.length === 0) {
          if (botToken) {
            await sendTelegramMessage(botToken, chatId, 'لا يوجد أي أعمال مرفوعة للطلاب حتى الآن في هذا المقرر.');
          }
          return NextResponse.json({ ok: true });
        }

        if (botToken) {
          for (const ev of evals.slice(0, 20)) {
            const student = ev.students as any;
            const uploadTimeStr = formatRelativeTimeArabic(ev.created_at);
            const scoreText = ev.score !== null && ev.score !== undefined && ev.score > 0 ? `⭐️ <b>الدرجة:</b> ${ev.score}` : '⏳ <b>الحالة:</b> بانتظار التقييم';
            
            const caption = `👨‍🎓 <b>الطالب:</b> ${student?.full_name || 'غير معروف'} (كود: ${student?.student_code || '---'} | ش:${student?.section || '-'})\n` +
              `📝 <b>المشروع:</b> ${ev.project_name}\n` +
              `⏱️ <b>وقت الرفع:</b> ${uploadTimeStr}\n` +
              `${scoreText}`;

            const actionButtons = {
              inline_keyboard: [
                [
                  { text: '⭐️ تقييم العمل', callback_data: `rate_ev_${ev.id}` },
                  { text: '🗑️ إلغاء العمل', callback_data: `del_ev_${ev.id}` }
                ]
              ]
            };

            await sendTelegramPhoto(botToken, chatId, ev.photo_url, caption, actionButtons);
          }
        }

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ ok: true });
  }
}
