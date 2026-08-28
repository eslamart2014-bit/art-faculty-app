import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyMarkup: any = null) {
  const body: any = { chat_id: chatId, text: text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function sendTelegramPhoto(botToken: string, chatId: number, photoUrl: string, caption: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption })
  });
}

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // Fetch token to use API directly for background tasks
    const { data: sysData } = await supabase.from('system_settings').select('telegram_config').eq('id', 1).maybeSingle();
    const botToken = sysData?.telegram_config?.token;

    // ==========================================
    // 1. Handle Text Messages (/start & Replies)
    // ==========================================
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const firstName = update.message.from.first_name || 'طالبنا العزيز';

      // --- Admin "Login as Student" Reply Handler ---
      if (update.message.reply_to_message && update.message.reply_to_message.text.includes('يرجى كتابة (كود الطالب)')) {
        const studentCode = text;
        
        // Fetch student from DB
        const { data: student } = await supabase.from('students').select('*').eq('student_code', studentCode).maybeSingle();
        
        if (!student) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `عفواً أيها المدير، لم أتمكن من العثور على طالب بالكود: ${studentCode}` });
        }

        let telegramInfo = '❌ (غير مربوط بأي حساب تليجرام حتى الآن)';
        if (student.telegram_id) {
          telegramInfo = `✅ (مربوط)\n🆔 آيدي الحساب: ${student.telegram_id}\n👤 اسم الحساب: ${student.telegram_first_name || 'غير معروف'}\n🔗 المعرف: @${student.telegram_username || 'لا يوجد'}`;
        }

        const caption = `🕵️‍♂️ (وضع المحاكاة نشط)\n👨‍🎓 الطالب: ${student.full_name}\n📌 الكود: ${student.student_code}\n\n📱 حالة ارتباط تليجرام:\n${telegramInfo}\n\nأنت الآن تتصفح البوت بصفتك هذا الطالب (كما سيراه هو تماماً). ماذا تريد أن تفعل؟`;
        
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: caption,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📸 رفع عمل جديد', callback_data: `sim_upload_${student.id}` }],
              [{ text: '📁 استعراض أعمال الطالب', callback_data: `sim_gallery_${student.id}` }],
              [{ text: '❌ إنهاء وضع المحاكاة', callback_data: `sim_exit` }]
            ]
          }
        });
      }

      // --- /start Handler ---
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const payload = parts.length > 1 ? parts[1] : '';
        let replyText = '';
        let replyMarkup = null;

        if (payload) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('telegram_link_token', payload).maybeSingle();
          if (profile) {
            await supabase.from('profiles').update({ telegram_id: chatId, telegram_link_token: null }).eq('id', profile.id);
            const roleName = profile.role === 'مدير' ? 'المدير 👑' : 'عضو هيئة التدريس 👨‍🏫';
            replyText = `مرحباً بك د. ${profile.full_name} 🎓\n\nلقد تم ربط حسابك بنجاح بصلاحية (${roleName}).`;
            
            const buttons = [[{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }]];
            if (profile.role === 'مدير') {
              buttons.push([{ text: '🕵️‍♂️ الدخول بحساب طالب (محاكاة)', callback_data: 'admin_login_student' }]);
            }
            replyMarkup = { inline_keyboard: buttons };

          } else {
            replyText = `عفواً، رابط التفعيل غير صحيح أو منتهي الصلاحية.`;
          }
        } else {
          const { data: existingProfile } = await supabase.from('profiles').select('*').eq('telegram_id', chatId).maybeSingle();
          if (existingProfile) {
            replyText = `أهلاً بعودتك د. ${existingProfile.full_name} 🎓\nكيف يمكنني مساعدتك؟`;
            
            const buttons = [[{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }]];
            if (existingProfile.role === 'مدير') {
              buttons.push([{ text: '🕵️‍♂️ الدخول بحساب طالب (محاكاة)', callback_data: 'admin_login_student' }]);
            }
            replyMarkup = { inline_keyboard: buttons };

          } else {
            replyText = `مرحباً بك! حسابك غير مربوط. يرجى التفعيل من موقع الكلية.`;
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

      // First, get the profile of the user clicking
      const { data: profile } = await supabase.from('profiles').select('*').eq('telegram_id', tgUserId).maybeSingle();
      if (!profile) {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'عفواً، حسابك غير مسجل.' });
      }

      // --- ADMIN LOGIN AS STUDENT ---
      if (data === 'admin_login_student' && profile.role === 'مدير') {
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: 'يرجى كتابة (كود الطالب) الذي تود محاكاة حسابه:',
          reply_markup: { force_reply: true, selective: true }
        });
      }

      // --- SIMULATION BUTTONS ---
      if (data === 'sim_exit') {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'تم إنهاء وضع المحاكاة. عودة لصلاحيات الإدارة 👑' });
      }
      if (data.startsWith('sim_upload_') || data.startsWith('sim_gallery_')) {
        return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'جاري برمجة نظام الطلاب (قيد التطوير) 🚧' });
      }

      // --- BROWSE COURSES ---
      if (data === 'staff_browse_courses') {
        // Fetch courses WITH academic_years
        const { data: allCourses } = await supabase.from('courses').select('*, academic_years(name)').order('created_at', { ascending: false });
        let userCourses = allCourses || [];
        
        // If not admin, filter by owner or shared
        if (profile.role !== 'مدير') {
          userCourses = userCourses.filter(c => c.owner_id === profile.id || (c.shared_with && c.shared_with.includes(profile.id)));
        }

        if (userCourses.length === 0) {
          return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: 'لا يوجد لديك مقررات حالياً.' });
        }

        // Add Academic Year to button text!
        const keyboard = userCourses.map(c => {
          const yearName = (c.academic_years as any)?.name || 'عام';
          return [{ text: `📚 ${c.name} - ${yearName}`, callback_data: `view_course_${c.id}` }];
        });
        
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: 'قم باختيار المقرر لعرض أعمال الطلاب:',
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      // --- VIEW COURSE ARTWORKS ---
      if (data.startsWith('view_course_')) {
        const courseId = data.replace('view_course_', '');
        
        // Fetch course name
        const { data: course } = await supabase.from('courses').select('name').eq('id', courseId).single();
        
        // Answer immediately so the button doesn't hang
        if (botToken) {
          await sendTelegramMessage(botToken, chatId, `جاري تجميع وتهيئة أعمال مقرر (${course?.name || ''})... يرجى الانتظار ⏳`);
        }

        // Fetch students enrolled in this course (with their evaluations)
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select(`
            student_id,
            students ( full_name, code ),
            evaluations (
              id, created_at, photo_url, ai_status
            )
          `)
          .eq('course_id', courseId);

        if (!enrollments || enrollments.length === 0) {
          if (botToken) await sendTelegramMessage(botToken, chatId, 'لا يوجد طلاب مسجلين في هذا المقرر.');
          return NextResponse.json({ ok: true });
        }

        let sentCount = 0;

        // Sort students alphabetically
        const sortedStudents = enrollments
          .filter(e => e.students)
          .sort((a, b) => ((a.students as any).full_name).localeCompare(((b.students as any).full_name), 'ar'));

        for (const enrollment of sortedStudents) {
          if (!enrollment.evaluations || enrollment.evaluations.length === 0) continue;

          // Sort evaluations by date
          const sortedEvals = enrollment.evaluations.sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          for (const ev of sortedEvals) {
            if (!ev.photo_url) continue;
            
            // Fix URL format if needed
            let finalUrl = ev.photo_url;
            if (finalUrl.startsWith('/')) {
              // It's a supabase storage path
              finalUrl = `${supabaseUrl}/storage/v1/object/public/artworks${finalUrl}`;
            }

            const dateStr = new Date(ev.created_at).toLocaleDateString('ar-EG');
            const timeStr = new Date(ev.created_at).toLocaleTimeString('ar-EG');
            const caption = `👨‍🎓 الطالب: ${(enrollment.students as any).full_name}\n📅 التاريخ: ${dateStr} - ${timeStr}`;

            if (botToken) {
              await sendTelegramPhoto(botToken, chatId, finalUrl, caption);
              sentCount++;
            }
          }
        }

        if (botToken) {
          await sendTelegramMessage(botToken, chatId, sentCount > 0 ? `✅ اكتمل عرض الأعمال (${sentCount} صورة).` : 'لا يوجد أي أعمال مرفوعة للطلاب حتى الآن في هذا المقرر.');
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
