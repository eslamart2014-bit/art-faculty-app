import { noStoreJson } from '@/lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  // Mobile APK push token registration is completely disabled
  return noStoreJson({ success: true, disabled: true, message: 'FCM push has been migrated to Telegram Bot' });
}

export async function DELETE() {
  return noStoreJson({ success: true });
}
