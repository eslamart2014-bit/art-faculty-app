import { NextResponse } from 'next/server';
import {
  clearStaffSession,
  getStaffContext,
  jwtExpirySeconds,
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

  const response = noStoreJson({ success: true, profile: safeProfile(ctx) });
  setStaffSession(response, ctx.token, jwtExpirySeconds(ctx.token));
  return response;
}

export async function GET(request: Request) {
  const ctx = await getStaffContext(request);
  if (!ctx) {
    return noStoreJson({ error: 'جلسة غير صالحة' }, { status: 401 });
  }
  return noStoreJson({ success: true, profile: safeProfile(ctx) });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearStaffSession(response);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
