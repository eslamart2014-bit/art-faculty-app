import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { broadcastPushToAll } from '@/lib/telegram/push';
import { getStaffContext } from '@/lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const secret = process.env.PUSH_WEBHOOK_SECRET || 'b8d48d9d6c9ebe4d7b675be4c795d7d0a405707b37a7dc39';
  const given = request.headers.get('x-webhook-secret') || '';
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    // Authorized via webhook secret or logged in staff/admin
    const isWebhookAuthed = authorized(request);
    const staff = !isWebhookAuthed ? await getStaffContext(request) : null;

    if (!isWebhookAuthed && !staff?.isAdmin) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const version = body?.version || '1.0.7';
    const title = body?.title || '⚡ يتوفر تحديث جديد';
    const message = body?.changelog || body?.message || 'يتوفر تحديث جديد للتطبيق.';

    const result = await broadcastPushToAll({
      title,
      body: message,
      type: 'announcement',
      id: `app_update_${version}`,
      tag: 'app_update',
      url: '/system',
    });

    return NextResponse.json({
      success: true,
      version,
      ...result,
    });
  } catch (error: any) {
    console.error('[broadcast-update]', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
