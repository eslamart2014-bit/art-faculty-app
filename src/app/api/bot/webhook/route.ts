import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { getStudentPersistentKeyboard } from '@/lib/telegram/push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// حماية ضد التكرار: منع إرسال أكثر من رسالة ترحيبية لنفس المحادثة خلال 5 ثوانٍ
const recentWelcomeSent = new Map<string, number>();

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const STUDENT_INTRO_MESSAGE =
  `من خلال هذا البوت يمكن للطلاب متابعة حضور وغياب ومشاريع وتقييمات وانضمام للدواليب.\n\n` +
  `اختر الخدمة المطلوبة من الأزرار الثابتة بالأسفل 👇`;

async function sendStudentWelcomeAndPinButtons(botToken: string, chatId: number | string, portalBaseUrl: string) {
  const key = String(chatId);
  const now = Date.now();
  const lastSent = recentWelcomeSent.get(key) || 0;
  if (now - lastSent < 5000) {
    return;
  }
  recentWelcomeSent.set(key, now);

  // 1. إزالة أي زر قائمة رئيسية من أسفل يسار الشات
  fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      menu_button: { type: 'default' },
    }),
  }).catch(() => {});

  // 2. إرسال الرسالة التعريفية مع تثبيت الزرين في أسفل شاشة البوت كأزرار ثابتة دائمة (Persistent Keyboard)
  const persistentKeyboard = getStudentPersistentKeyboard(portalBaseUrl, chatId);

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: STUDENT_INTRO_MESSAGE,
        parse_mode: 'HTML',
        reply_markup: persistentKeyboard,
      }),
    });
  } catch (e) {
    console.error('sendStudentWelcomeAndPinButtons error:', e);
  }
}

export async function POST(request: Request) {
  try {
    const { data: sysData } = await supabase
      .from('system_settings')
      .select('telegram_config')
      .eq('id', 1)
      .limit(1)
      .maybeSingle();

    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || sysData?.telegram_config?.webhook_secret;
    if (webhookSecret) {
      const headerSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
      if (!safeEqual(headerSecret, String(webhookSecret))) {
        return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 });
      }
    }

    const botToken =
      sysData?.telegram_config?.token ||
      sysData?.telegram_config?.botInfo?.token ||
      process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json({ error: 'Bot token is not configured' }, { status: 503 });
    }

    const update = await request.json().catch(() => null);
    if (!update || typeof update !== 'object') {
      return NextResponse.json({ ok: true });
    }

    const portalBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://art-faculty-app.vercel.app').replace(/\/$/, '');

    // فقط الرسائل النصية المرسلة من المستخدم نفسه (وليس رسائل النظام أو البوت أو تثبيت الرسائل)
    if (
      update.message &&
      typeof update.message.text === 'string' &&
      update.message.text.trim().length > 0 &&
      !update.message.from?.is_bot &&
      !update.message.pinned_message
    ) {
      const chatId = update.message.chat?.id;
      if (chatId) {
        await sendStudentWelcomeAndPinButtons(botToken, chatId, portalBaseUrl);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ ok: true });
  }
}
