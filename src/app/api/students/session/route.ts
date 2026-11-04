import { getStudentSession, noStoreJson, createStudentSessionToken, setStudentSession } from '@/lib/auth/serverAuth';
import { supabaseAdmin } from '@/lib/core/supabase';
import { formatStudentCode } from '@/lib/students/codeHelper';

export const dynamic = 'force-dynamic';

const PERMANENT_TTL_SECONDS = 365 * 24 * 60 * 60; // 365 days

export async function GET(request: Request) {
  const session = getStudentSession(request);
  if (session) {
    const token = createStudentSessionToken(session.code, PERMANENT_TTL_SECONDS);
    const res = noStoreJson({ authenticated: true, student_code: session.code, token });
    setStudentSession(res, session.code, request, PERMANENT_TTL_SECONDS);
    return res;
  }

  // Fallback for persistent device/Telegram sessions where WebView dropped the cookie:
  // If the client provides its saved student_code, verify the student exists and restore the session token
  const { searchParams } = new URL(request.url);
  const savedCode = (searchParams.get('code') || '').trim();
  if (savedCode) {
    const cleanCode = formatStudentCode(savedCode);
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('student_code')
      .or(`student_code.eq.${savedCode},student_code.eq.${cleanCode}`)
      .limit(1)
      .maybeSingle();

    if (student?.student_code) {
      const token = createStudentSessionToken(student.student_code, PERMANENT_TTL_SECONDS);
      const res = noStoreJson({ authenticated: true, student_code: student.student_code, token });
      setStudentSession(res, student.student_code, request, PERMANENT_TTL_SECONDS);
      return res;
    }
  }

  return noStoreJson({ authenticated: false }, { status: 401 });
}
