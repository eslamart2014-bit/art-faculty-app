import { getStudentSession, noStoreJson, createStudentSessionToken } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = getStudentSession(request);
  if (!session) {
    return noStoreJson({ authenticated: false }, { status: 401 });
  }
  const token = createStudentSessionToken(session.code, 180 * 24 * 60 * 60);
  return noStoreJson({ authenticated: true, student_code: session.code, token });
}
