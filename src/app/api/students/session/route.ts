import { getStudentSession, noStoreJson } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = getStudentSession(request);
  if (!session) {
    return noStoreJson({ authenticated: false }, { status: 401 });
  }
  return noStoreJson({ authenticated: true, student_code: session.code });
}
