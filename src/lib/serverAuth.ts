import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase';

export const STAFF_COOKIE = 'fania_staff_token';
export const STUDENT_COOKIE = 'fania_student_token';

export const ADMIN_ROLES = new Set(['مدير', 'مدير مساعد', 'admin', 'أدمن']);

export type StaffContext = {
  token: string;
  user: { id: string; email?: string | null };
  profile: {
    id: string;
    role: string;
    full_name?: string | null;
    email?: string | null;
    is_active?: boolean | null;
  };
  role: string;
  isAdmin: boolean;
  isCoordinator: boolean;
};

type Guard<T> = { ok: true; ctx: T } | { ok: false; response: NextResponse };

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

const staffCache = new Map<string, { ctx: StaffContext; expires: number }>();
const STAFF_CACHE_TTL_MS = 60_000;
const STAFF_CACHE_MAX = 500;

export async function getStaffContext(request: Request): Promise<StaffContext | null> {
  const token = getBearerToken(request) || parseCookies(request.headers.get('cookie'))[STAFF_COOKIE];
  if (!token) return null;

  const cached = staffCache.get(token);
  if (cached && cached.expires > Date.now()) return cached.ctx;

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_active === false) return null;

  const role = String(profile.role || '');
  let canVerify = profile.can_verify_students === true || user.user_metadata?.can_verify_students === true;

  if (!canVerify && !ADMIN_ROLES.has(role)) {
    try {
      const { data: settings } = await supabaseAdmin
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 1)
        .maybeSingle();
      const list = settings?.telegram_config?.verified_coordinators;
      canVerify = Array.isArray(list) && list.includes(user.id);
    } catch {
      // keep the permission denied when settings cannot be read
    }
  }

  const ctx: StaffContext = {
    token,
    user: { id: user.id, email: user.email },
    profile,
    role,
    isAdmin: ADMIN_ROLES.has(role),
    isCoordinator: ADMIN_ROLES.has(role) || canVerify,
  };

  if (staffCache.size >= STAFF_CACHE_MAX) {
    const now = Date.now();
    for (const [key, entry] of staffCache) {
      if (entry.expires <= now) staffCache.delete(key);
    }
    if (staffCache.size >= STAFF_CACHE_MAX) staffCache.clear();
  }
  staffCache.set(token, { ctx, expires: Date.now() + STAFF_CACHE_TTL_MS });
  return ctx;
}

export async function requireStaff(
  request: Request,
  options?: { admin?: boolean; coordinator?: boolean }
): Promise<Guard<StaffContext>> {
  const ctx = await getStaffContext(request);
  if (!ctx) {
    return { ok: false, response: NextResponse.json({ error: 'غير مصرح' }, { status: 401 }) };
  }
  if (options?.admin && !ctx.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'صلاحيات غير كافية' }, { status: 403 }) };
  }
  if (options?.coordinator && !ctx.isCoordinator) {
    return { ok: false, response: NextResponse.json({ error: 'صلاحيات غير كافية' }, { status: 403 }) };
  }
  return { ok: true, ctx };
}

export function requireAdmin(request: Request) {
  return requireStaff(request, { admin: true });
}

export function requireCoordinator(request: Request) {
  return requireStaff(request, { coordinator: true });
}

type StudentSession = { code: string; exp: number };

function getStudentSecret(): string {
  const secret = process.env.STUDENT_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('STUDENT_SESSION_SECRET is not configured');
  return secret;
}

export function createStudentSessionToken(code: string, ttlSeconds = 12 * 60 * 60): string {
  const payload = Buffer.from(
    JSON.stringify({ code, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  ).toString('base64url');
  const signature = createHmac('sha256', getStudentSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyStudentSessionToken(token: string | null | undefined): StudentSession | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, signature] = parts;

  let expected: string;
  try {
    expected = createHmac('sha256', getStudentSecret()).update(payload).digest('base64url');
  } catch {
    return null;
  }

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data?.code !== 'string' || typeof data?.exp !== 'number') return null;
    if (data.exp <= Math.floor(Date.now() / 1000)) return null;
    return { code: data.code, exp: data.exp };
  } catch {
    return null;
  }
}

export function getStudentSession(request: Request): StudentSession | null {
  const customHeader = request.headers.get('x-student-token');
  const bearer = getBearerToken(request);
  const cookie = parseCookies(request.headers.get('cookie'))[STUDENT_COOKIE];
  return verifyStudentSessionToken(customHeader || bearer || cookie);
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setStudentSession(response: NextResponse, code: string) {
  response.cookies.set(STUDENT_COOKIE, createStudentSessionToken(code), {
    ...cookieBase(),
    maxAge: 12 * 60 * 60,
  });
}

export function clearStudentSession(response: NextResponse) {
  response.cookies.set(STUDENT_COOKIE, '', { ...cookieBase(), maxAge: 0 });
}

export function setStaffSession(response: NextResponse, token: string, maxAgeSeconds: number) {
  response.cookies.set(STAFF_COOKIE, token, {
    ...cookieBase(),
    maxAge: Math.max(60, Math.floor(maxAgeSeconds)),
  });
}

export function clearStaffSession(response: NextResponse) {
  response.cookies.set(STAFF_COOKIE, '', { ...cookieBase(), maxAge: 0 });
}

export function jwtExpirySeconds(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
    if (typeof payload?.exp === 'number') {
      return Math.max(60, payload.exp - Math.floor(Date.now() / 1000));
    }
  } catch {
    // ignore malformed payloads
  }
  return 60 * 60;
}

export function noStoreJson(data: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return response;
}
