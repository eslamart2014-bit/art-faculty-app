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

        if (payload === 'student') {
          replyText = `مرحباً بك يا ${firstName} في بوابة كلية التربية الفنية 🎨\n\nأنت الآن في (بوابة الطلاب).\nلربط حسابك الأكاديمي، يرجى الضغط على الزر بالأسفل للبحث عن اسمك.`;
          replyMarkup = {
            inline_keyboard: [
              [{ text: '🔍 البحث عن اسمي وربط الحساب', callback_data: 'student_link_account' }]
            ]
          };
        } else if (payload === 'staff') {
          replyText = `مرحباً بك د. ${firstName} 🎓\n\nأنت الآن في (بوابة المعلمين والإدارة).\nلربط حسابك الأكاديمي، يرجى إدخال (البريد الإلكتروني) الخاص بك على النظام:`;
          replyMarkup = {
            inline_keyboard: [
              [{ text: '🔐 تسجيل الدخول بالبريد الإلكتروني', callback_data: 'staff_login' }]
            ]
          };
        } else {
          // Generic start (without deep link)
          replyText = `مرحباً بك في البوابة الذكية لكلية التربية الفنية 🎨🎓\n\nيرجى تحديد هويتك للبدء:`;
          replyMarkup = {
            inline_keyboard: [
              [{ text: '👨‍🎓 الدخول كـ (طالب)', callback_data: 'select_role_student' }],
              [{ text: '👨‍🏫 الدخول كـ (معلم / إدارة)', callback_data: 'select_role_staff' }]
            ]
          };
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
