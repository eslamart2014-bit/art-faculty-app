import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // 1. Check if it's a message
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const firstName = update.message.from.first_name || 'طالبنا العزيز';

      // 2. Handle /start command
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const payload = parts.length > 1 ? parts[1] : '';

        let replyText = '';
        let replyMarkup = null;

        if (payload) {
          // Check if payload is a teacher token
          const { data: profile } = await supabase.from('profiles').select('*').eq('telegram_link_token', payload).maybeSingle();
          
          if (profile) {
            // Link successful!
            await supabase.from('profiles').update({ 
              telegram_id: update.message.from.id,
              telegram_link_token: null // invalidate token
            }).eq('id', profile.id);
            
            const roleName = profile.role === 'مدير' ? 'المدير 👑' : 'عضو هيئة التدريس 👨‍🏫';
            replyText = `مرحباً بك د. ${profile.full_name} 🎓\n\nلقد تم ربط حسابك الأكاديمي بنجاح بصلاحية (${roleName}).\n\nيمكنك الآن استلام إشعارات النظام، وتصفح أعمال الطلاب مباشرة من هنا!`;
            replyMarkup = {
              inline_keyboard: [
                [{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }],
                [{ text: '⚙️ إعدادات الإشعارات', callback_data: 'staff_settings' }]
              ]
            };
          } else {
            // Check if it's a student token (we will build this later)
            replyText = `عفواً، رابط التفعيل منتهي الصلاحية أو غير صحيح. يرجى توليد رابط جديد من لوحة التحكم.`;
          }
        } else {
          // No payload? Check if they are ALREADY linked!
          const { data: existingProfile } = await supabase.from('profiles').select('*').eq('telegram_id', update.message.from.id).maybeSingle();
          
          if (existingProfile) {
            const roleName = existingProfile.role === 'مدير' ? 'المدير 👑' : 'عضو هيئة التدريس 👨‍🏫';
            replyText = `أهلاً بعودتك د. ${existingProfile.full_name} 🎓 (${roleName})\n\nكيف يمكنني مساعدتك اليوم؟`;
            replyMarkup = {
              inline_keyboard: [
                [{ text: '📂 تصفح المقررات والأعمال', callback_data: 'staff_browse_courses' }]
              ]
            };
          } else {
            // Generic start
            replyText = `مرحباً بك في البوابة الذكية لكلية التربية الفنية 🎨🎓\n\nيبدو أن حسابك غير مربوط بالنظام.\nإذا كنت معلماً، يرجى الدخول لموقع الكلية والضغط على زر (ربط تليجرام) من إعدادات حسابك.`;
          }
        }

        // Return direct JSON to Telegram to send the message instantly!
        return NextResponse.json({
          method: 'sendMessage',
          chat_id: chatId,
          text: replyText,
          reply_markup: replyMarkup
        });
      }
      
      // Generic fallback for any other text
      return NextResponse.json({
        method: 'sendMessage',
        chat_id: chatId,
        text: 'عفواً، لا يزال البوت قيد التطوير والبرمجة 🚧'
      });
    }

    // 3. Handle Inline Button Clicks (Callback Queries)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      
      let replyText = '';

      if (data === 'student_link_account') {
        replyText = 'هذه الميزة قيد التطوير 🚧\nقريباً ستتمكن من كتابة رقمك القومي أو الكود لربط حسابك.';
      } else if (data === 'staff_login') {
        replyText = 'هذه الميزة قيد التطوير 🚧\nقريباً ستتمكن من ربط حسابك بضغطة زر من داخل لوحة التحكم.';
      } else if (data === 'select_role_student') {
        replyText = 'لقد اخترت بوابة الطلاب 👨‍🎓\n(قيد التطوير...)';
      } else if (data === 'select_role_staff') {
        replyText = 'لقد اخترت بوابة المعلمين 👨‍🏫\n(قيد التطوير...)';
      } else {
        replyText = 'أمر غير معروف.';
      }

      // Answer the callback query to stop the loading spinner on the button, then send a message
      return NextResponse.json({
        method: 'sendMessage',
        chat_id: chatId,
        text: replyText
      });
    }

    // Acknowledge other types of updates so Telegram stops sending them
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    // Still return 200 so Telegram doesn't retry indefinitely
    return NextResponse.json({ ok: true });
  }
}
