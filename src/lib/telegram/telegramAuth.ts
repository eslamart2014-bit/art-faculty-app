import { createHmac, timingSafeEqual } from 'crypto';

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60;

export function verifyTelegramInitData(
  initData: string | null | undefined,
  botToken: string | null | undefined
): { id: string } | null {
  if (!initData || !botToken || initData.length > 8192) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash') || '';
  if (!/^[a-f0-9]{64}$/i.test(hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || !Number.isFinite(authDate)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 300) return null;
  if (now - authDate > MAX_INIT_DATA_AGE_SECONDS) return null;

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const providedBuffer = Buffer.from(hash.toLowerCase(), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const user = JSON.parse(params.get('user') || 'null');
    if (!user?.id) return null;
    return { id: String(user.id) };
  } catch {
    return null;
  }
}
