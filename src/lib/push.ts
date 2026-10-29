import { supabaseAdmin } from '@/lib/supabase';
import { getStudentCodeVariants, formatStudentCode } from '@/lib/codeHelper';

export type PushPayload = {
  title: string;
  body: string;
  type?: 'attendance' | 'project' | 'locker' | 'grade' | 'announcement' | 'general';
  id?: string;
  tag?: string; // Tag for notification deduplication and replacing existing cards on device
  url?: string;
};

let messagingInstance: any = null;

// Server-side in-memory deduplication cache (15 seconds debounce window)
const sentPushCache = new Map<string, number>();

function isDuplicate(tag: string | undefined): boolean {
  if (!tag) return false;
  const now = Date.now();
  const lastSent = sentPushCache.get(tag);
  if (lastSent && now - lastSent < 15_000) {
    return true;
  }
  sentPushCache.set(tag, now);

  // Periodically clean up entries older than 60 seconds
  if (sentPushCache.size > 500) {
    for (const [k, v] of sentPushCache.entries()) {
      if (now - v > 60_000) sentPushCache.delete(k);
    }
  }
  return false;
}

export async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT is not configured in environment variables');
    return null;
  }

  try {
    let credentials: any;
    try {
      credentials = JSON.parse(raw);
    } catch {
      // Fallback for base64-encoded service account string
      try {
        credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      } catch (e) {
        console.error('[push] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
        return null;
      }
    }

    // Ensure private_key handles newline formatting correctly (common issue on Vercel)
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
 * Sends high-priority FCM push notification to a list of student codes.
 * Works even when the app is completely closed / swiped from recent apps.
 * Automatically deduplicates identical messages within 15 seconds.
 */
export async function sendPushToStudents(
  codes: string[],
  payload: PushPayload
): Promise<{ sent: number; totalTokens: number; failureCount: number; errors?: any[]; duplicateSkipped?: boolean }> {
  if (!codes || codes.length === 0) return { sent: 0, totalTokens: 0, failureCount: 0 };

  // Deduplicate on server: if exact same tag was dispatched within 15 seconds, skip
  if (payload.tag && isDuplicate(payload.tag)) {
    console.log('[push] Duplicate skipped on server for tag:', payload.tag);
    return { sent: 0, totalTokens: 0, failureCount: 0, duplicateSkipped: true };
  }

  const allVariants = Array.from(
    new Set(codes.flatMap((c) => getStudentCodeVariants(c)).filter(Boolean))
  );
  if (allVariants.length === 0) return { sent: 0, totalTokens: 0, failureCount: 0 };

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    console.warn('[push] Firebase messaging unavailable — push skipped');
    return { sent: 0, totalTokens: 0, failureCount: 0 };
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
    return { sent: 0, totalTokens: 0, failureCount: 0 };
  }

  const notifId = payload.id || `notif_${Date.now()}`;
  const notifTag = payload.tag || notifId;
  let totalSent = 0;
  let totalFailed = 0;
  const errorLogs: any[] = [];
  const deadTokens: string[] = [];

  // Batch tokens into chunks of 500 (FCM sendEachForMulticast limit)
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
          ttl: 24 * 60 * 60 * 1000, // 24 hours
          notification: {
            channelId: 'art_edu_student_alerts',
            tag: notifTag, // Ensures Android system tray replaces any existing card with the same tag
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            priority: 'high',
            visibility: 'public',
            icon: 'app_icon',
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

  // Cleanup dead/unregistered tokens
  if (deadTokens.length > 0) {
    await supabaseAdmin.from('device_tokens').delete().in('token', deadTokens);
  }

  return {
    sent: totalSent,
    totalTokens: uniqueTokens.length,
    failureCount: totalFailed,
    errors: errorLogs.length > 0 ? errorLogs : undefined,
  };
}

/**
 * Broadcast an announcement or version update push to all registered student devices.
 */
export async function broadcastPushToAll(
  payload: PushPayload
): Promise<{ sent: number; totalTokens: number; failureCount: number }> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return { sent: 0, totalTokens: 0, failureCount: 0 };

  const { data } = await supabaseAdmin.from('device_tokens').select('token');
  const tokens = Array.from(new Set((data || []).map((r: any) => r.token).filter(Boolean)));

  if (tokens.length === 0) return { sent: 0, totalTokens: 0, failureCount: 0 };

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
        },
      },
    });
    totalSent += response.successCount;
    totalFailed += response.failureCount;
  }

  return { sent: totalSent, totalTokens: tokens.length, failureCount: totalFailed };
}
