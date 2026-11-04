import { supabaseAdmin } from '@/lib/core/supabase';
import { getStudentCodeVariants, formatStudentCode } from '@/lib/students/codeHelper';

export type PushPayload = {
  title: string;
  body: string;
  type?: 'attendance' | 'project' | 'locker' | 'grade' | 'announcement' | 'general';
  id?: string;
  tag?: string; // Tag for notification deduplication and replacing existing cards on device
  url?: string;
  telegramHtml?: string; // Optional custom HTML body for Telegram notification
};

const DEFAULT_PORTAL_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://art-faculty-app.vercel.app';

export function getStudentTelegramButtons(baseUrl = DEFAULT_PORTAL_BASE_URL, chatId?: string | number) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const portalUrl = chatId
    ? `${cleanBase}/tg/portal?tg_id=${encodeURIComponent(String(chatId))}`
    : `${cleanBase}/tg/portal`;
  return {
    inline_keyboard: [
      [
        {
          text: '🎨 الدخول لبوابة فنية',
          web_app: { url: portalUrl },
        },
      ],
      [
        {
          text: '🪪 سحب الكيو آر كود (QR Code)',
          web_app: { url: `${cleanBase}/tg/qr` },
        },
      ],
    ],
  };
}

export function getStudentPersistentKeyboard(baseUrl = DEFAULT_PORTAL_BASE_URL, chatId?: string | number) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const portalUrl = chatId
    ? `${cleanBase}/tg/portal?tg_id=${encodeURIComponent(String(chatId))}`
    : `${cleanBase}/tg/portal`;
  return {
    keyboard: [
      [
        {
          text: '🎨 الدخول لبوابة فنية',
          web_app: { url: portalUrl },
        },
      ],
      [
        {
          text: '🪪 سحب الكيو آر كود (QR Code)',
          web_app: { url: `${cleanBase}/tg/qr` },
        },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export async function getActiveTelegramBotToken(): Promise<string | null> {
  try {
    const { data: sysData } = await supabaseAdmin
      .from('system_settings')
      .select('telegram_config')
      .eq('id', 1)
      .limit(1)
      .maybeSingle();

    const token =
      sysData?.telegram_config?.token ||
      sysData?.telegram_config?.botInfo?.token ||
      process.env.TELEGRAM_BOT_TOKEN ||
      null;

    return token ? String(token).trim() : null;
  } catch {
    return process.env.TELEGRAM_BOT_TOKEN || null;
  }
}

let messagingInstance: any = null;

// Server-side in-memory deduplication cache (15 seconds debounce window)
const sentPushCache = new Map<string, number>();
const sentTelegramCache = new Map<string, number>();

function isDuplicate(cache: Map<string, number>, tag: string | undefined): boolean {
  if (!tag) return false;
  const now = Date.now();
  const lastSent = cache.get(tag);
  if (lastSent && now - lastSent < 15_000) {
    return true;
  }
  cache.set(tag, now);

  // Periodically clean up entries older than 60 seconds
  if (cache.size > 500) {
    for (const [k, v] of cache.entries()) {
      if (now - v > 60_000) cache.delete(k);
    }
  }
  return false;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends instant Telegram Bot notifications with the fixed portal buttons to linked students.
 * Uses safe rate-limited batching (15 messages per batch) to prevent Telegram flood limits.
 */
export async function sendTelegramToStudents(
  codes: string[],
  payload: PushPayload
): Promise<{ sent: number; linkedCount: number }> {
  if (!codes || codes.length === 0) return { sent: 0, linkedCount: 0 };

  const dedupKey = payload.tag ? `tg_${payload.tag}` : undefined;
  if (dedupKey && isDuplicate(sentTelegramCache, dedupKey)) {
    return { sent: 0, linkedCount: 0 };
  }

  const botToken = await getActiveTelegramBotToken();
  if (!botToken) return { sent: 0, linkedCount: 0 };

  const allVariants = Array.from(
    new Set(codes.flatMap((c) => getStudentCodeVariants(c)).filter(Boolean))
  );
  if (allVariants.length === 0) return { sent: 0, linkedCount: 0 };

  const linkedStudents: { telegram_id: string; full_name: string; student_code: string }[] = [];
  const seenTgIds = new Set<string>();

  for (let i = 0; i < allVariants.length; i += 200) {
    const chunk = allVariants.slice(i, i + 200);
    const { data } = await supabaseAdmin
      .from('students')
      .select('telegram_id, full_name, student_code')
      .in('student_code', chunk)
      .not('telegram_id', 'is', null);

    (data || []).forEach((row: any) => {
      const tgId = String(row.telegram_id || '').trim();
      if (tgId && !seenTgIds.has(tgId)) {
        seenTgIds.add(tgId);
        linkedStudents.push({
          telegram_id: tgId,
          full_name: row.full_name || 'عزيزي الطالب',
          student_code: row.student_code || '',
        });
      }
    });
  }

  if (linkedStudents.length === 0) return { sent: 0, linkedCount: 0 };

  let sentCount = 0;
  const batchSize = 15; // Safe under Telegram's 30 msg/sec global limit

  for (let i = 0; i < linkedStudents.length; i += batchSize) {
    const batch = linkedStudents.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (st) => {
        const perStudentKey = payload.tag ? `tg_${payload.tag}_${st.telegram_id}` : undefined;
        if (perStudentKey && isDuplicate(sentTelegramCache, perStudentKey)) return;

        const replyMarkup = getStudentTelegramButtons(DEFAULT_PORTAL_BASE_URL, st.telegram_id);

        const htmlText =
          payload.telegramHtml ||
          `<b>${escapeHtml(payload.title)}</b>\n\n` +
            `مرحباً <b>${escapeHtml(st.full_name)}</b> 👨‍🎓\n` +
            `${escapeHtml(payload.body)}\n\n` +
            `<i>اضغط على الزر بالأسفل للدخول المباشر لبوابة فنية 👇</i>`;

        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: st.telegram_id,
              text: htmlText,
              parse_mode: 'HTML',
              reply_markup: replyMarkup,
            }),
          });
          if (res.ok) sentCount++;
        } catch {
          // ignore individual network error
        }
      })
    );

    if (i + batchSize < linkedStudents.length) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  return { sent: sentCount, linkedCount: linkedStudents.length };
}

export async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    return null;
  }

  try {
    let credentials: any;
    try {
      credentials = JSON.parse(raw);
    } catch {
      try {
        credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      } catch (e) {
        console.error('[push] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
        return null;
      }
    }

    if (credentials.private_key && typeof credentials.private_key === 'string') {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert(credentials),
        });

    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (error) {
    console.error('[push] Firebase Admin initialization error:', error);
    return null;
  }
}

/**
 * Sends high-priority notifications to a list of student codes via BOTH:
 * 1. Telegram Bot (with fixed portal buttons) for all students linked on Telegram.
 * 2. Firebase Cloud Messaging (FCM) for any installed Android app tokens.
 * Automatically deduplicates identical messages within 15 seconds.
 */
export async function sendPushToStudents(
  codes: string[],
  payload: PushPayload
): Promise<{ sent: number; telegramSent?: number; totalTokens: number; failureCount: number; errors?: any[]; duplicateSkipped?: boolean }> {
  if (!codes || codes.length === 0) return { sent: 0, totalTokens: 0, failureCount: 0 };

  if (payload.tag && isDuplicate(sentPushCache, payload.tag)) {
    return { sent: 0, totalTokens: 0, failureCount: 0, duplicateSkipped: true };
  }

  // 1. Dispatch Telegram Bot notification in parallel
  const telegramPromise = sendTelegramToStudents(codes, payload).catch(() => ({ sent: 0, linkedCount: 0 }));

  const allVariants = Array.from(
    new Set(codes.flatMap((c) => getStudentCodeVariants(c)).filter(Boolean))
  );
  if (allVariants.length === 0) {
    const tgRes = await telegramPromise;
    return { sent: tgRes.sent, telegramSent: tgRes.sent, totalTokens: 0, failureCount: 0 };
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    const tgRes = await telegramPromise;
    return { sent: tgRes.sent, telegramSent: tgRes.sent, totalTokens: 0, failureCount: 0 };
  }

  // Retrieve device tokens from Supabase for these student codes
  const tokens: string[] = [];
  for (let i = 0; i < allVariants.length; i += 200) {
    const chunk = allVariants.slice(i, i + 200);
    const { data } = await supabaseAdmin
      .from('device_tokens')
      .select('token')
      .in('student_code', chunk);

    (data || []).forEach((row: any) => {
      if (row.token && typeof row.token === 'string') {
        tokens.push(row.token);
      }
    });
  }

  const uniqueTokens = Array.from(new Set(tokens));
  if (uniqueTokens.length === 0) {
    const tgRes = await telegramPromise;
    return { sent: tgRes.sent, telegramSent: tgRes.sent, totalTokens: 0, failureCount: 0 };
  }

  const notifId = payload.id || `notif_${Date.now()}`;
  const notifTag = payload.tag || notifId;
  let totalSent = 0;
  let totalFailed = 0;
  const errorLogs: any[] = [];
  const deadTokens: string[] = [];

  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const batch = uniqueTokens.slice(i, i + 500);

    try {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          title: payload.title,
          body: payload.body,
          type: payload.type || 'general',
          id: notifId,
          tag: notifTag,
          url: payload.url || '/system',
        },
        android: {
          priority: 'high',
          ttl: 24 * 60 * 60 * 1000,
          notification: {
            channelId: 'art_edu_student_alerts',
            tag: notifTag,
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            priority: 'high',
            visibility: 'public',
            icon: 'ic_stat_notification',
          },
        },
      });

      totalSent += response.successCount;
      totalFailed += response.failureCount;

      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const errorCode = resp.error?.code || 'unknown';
          errorLogs.push({ token: batch[idx]?.substring(0, 15) + '...', error: errorCode });
          if (
            errorCode.includes('registration-token-not-registered') ||
            errorCode.includes('invalid-registration-token')
          ) {
            deadTokens.push(batch[idx]);
          }
        }
      });
    } catch (batchErr: any) {
      console.error('[push] Batch send error:', batchErr);
      totalFailed += batch.length;
      errorLogs.push({ batchError: batchErr.message });
    }
  }

  if (deadTokens.length > 0) {
    await supabaseAdmin.from('device_tokens').delete().in('token', deadTokens);
  }

  const tgRes = await telegramPromise;

  return {
    sent: totalSent + tgRes.sent,
    telegramSent: tgRes.sent,
    totalTokens: uniqueTokens.length,
    failureCount: totalFailed,
    errors: errorLogs.length > 0 ? errorLogs : undefined,
  };
}

/**
 * Broadcast an announcement or version update push to all registered students (Telegram + FCM).
 */
export async function broadcastPushToAll(
  payload: PushPayload
): Promise<{ sent: number; telegramSent?: number; totalTokens: number; failureCount: number }> {
  // 1. Send to all linked Telegram students
  let tgSent = 0;
  try {
    const { data: linkedRows } = await supabaseAdmin
      .from('students')
      .select('student_code')
      .not('telegram_id', 'is', null);
    const allCodes = (linkedRows || []).map((r: any) => r.student_code).filter(Boolean);
    if (allCodes.length > 0) {
      const tgRes = await sendTelegramToStudents(allCodes, payload);
      tgSent = tgRes.sent;
    }
  } catch {}

  const messaging = await getFirebaseMessaging();
  if (!messaging) return { sent: tgSent, telegramSent: tgSent, totalTokens: 0, failureCount: 0 };

  const { data } = await supabaseAdmin.from('device_tokens').select('token');
  const tokens = Array.from(new Set((data || []).map((r: any) => r.token).filter(Boolean)));

  if (tokens.length === 0) return { sent: tgSent, telegramSent: tgSent, totalTokens: 0, failureCount: 0 };

  const notifId = payload.id || `broadcast_${Date.now()}`;
  const notifTag = payload.tag || notifId;
  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        title: payload.title,
        body: payload.body,
        type: payload.type || 'announcement',
        id: notifId,
        tag: notifTag,
      },
      android: {
        priority: 'high',
        ttl: 24 * 60 * 60 * 1000,
        notification: {
          channelId: 'art_edu_student_alerts',
          tag: notifTag,
          sound: 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
          priority: 'high',
          visibility: 'public',
          icon: 'ic_stat_notification',
        },
      },
    });
    totalSent += response.successCount;
    totalFailed += response.failureCount;
  }

  return { sent: totalSent + tgSent, telegramSent: tgSent, totalTokens: tokens.length, failureCount: totalFailed };
}
