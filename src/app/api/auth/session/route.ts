import { NextResponse } from 'next/server';
import {
  clearStaffSession,
  createStaffSessionToken,
  getStaffContext,
  noStoreJson,
  setStaffSession,
} from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

function safeProfile(ctx: NonNullable<Awaited<ReturnType<typeof getStaffContext>>>) {
  return {
    id: ctx.profile.id,
    role: ctx.role,
    full_name: ctx.profile.full_name || null,
    email: ctx.profile.email || null,
    isAdmin: ctx.isAdmin,
    isCoordinator: ctx.isCoordinator,
  };
}

export async function POST(request: Request) {
  const ctx = await getStaffContext(request);
  if (!ctx) {
    return noStoreJson({ error: 'جلسة غير صالحة' }, { status: 401 });
  }

  // Issue durable 7-day server signed session token
  const signedToken = createStaffSessionToken(ctx.user.id, ctx.role, 7 * 24 * 3600);
  const response = noStoreJson({
    success: true,
    profile: safeProfile(ctx),
    token: signedToken
  });

  setStaffSession(response, signedToken, 7 * 24 * 3600, request);
  return response;
}

export async function GET(request: Request) {
  const ctx = await getStaffContext(request);
  if (!ctx) {
    return noStoreJson({ error: 'جلسة غير صالحة' }, { status: 401 });
  }
  return noStoreJson({ success: true, profile: safeProfile(ctx) });
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ success: true });
  clearStaffSession(response, request);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
