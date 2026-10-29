import { supabaseAdmin } from '@/lib/supabase';
import { getStudentCodeVariants } from '@/lib/codeHelper';

type PushPayload = { title: string; body: string; type?: string; id?: string };

let messagingPromise: Promise<any | null> | null = null;

async function getMessaging() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) return null;
      try {
        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getMessaging: getFcm } = await import('firebase-admin/messaging');
        const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(raw)) });
        return getFcm(app);
      } catch (e) {
        console.error('[push] firebase init failed', e);
        return null;
      }
    })();
  }
  return messagingPromise;
}

/** يرسل إشعار FCM (data-only وبأولوية عالية) لكل أجهزة قائمة من أكواد الطلاب. */
export async function sendPushToStudents(codes: string[], payload: PushPayload): Promise<number> {
  const all = Array.from(new Set(codes.flatMap((c) => getStudentCodeVariants(c))));
  if (all.length === 0) return 0;
  const messaging = await getMessaging();
  if (!messaging) return 0;

  const tokens: string[] = [];
  for (let i = 0; i < all.length; i += 200) {
    const { data } = await supabaseAdmin
      .from('device_tokens')
      .select('token')
      .in('student_code', all.slice(i, i + 200));
    (data || []).forEach((r: any) => r.token && tokens.push(r.token));
  }
  const unique = Array.from(new Set(tokens));
  if (unique.length === 0) return 0;

  let sent = 0;
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      data: {
        title: payload.title,
        body: payload.body,
        type: payload.type || 'general',
        id: payload.id || String(Date.now()),
      },
      android: { priority: 'high', ttl: 24 * 60 * 60 * 1000 },
    });
    sent += res.successCount;
    const dead: string[] = [];
    res.responses.forEach((r: any, idx: number) => {
      const code = r.error?.code || '';
      if (!r.success && (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token'))) {
        dead.push(batch[idx]);
      }
    });
    if (dead.length) await supabaseAdmin.from('device_tokens').delete().in('token', dead);
  }
  return sent;
}
