import { NextResponse } from 'next/server';
import { clearStudentSession } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearStudentSession(response);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
