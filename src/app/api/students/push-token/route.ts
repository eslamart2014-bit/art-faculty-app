import { getStudentSession, noStoreJson } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = getStudentSession(request);
  if (!session) return noStoreJson({ error: 'unauthorized' }, { status: 401 });
  const { token } = await request.json().catch(() => ({}));
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    return noStoreJson({ error: 'invalid token' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('device_tokens').upsert(
    { token, student_code: formatStudentCode(session.code), updated_at: new Date().toISOString() },
    { onConflict: 'token' }
  );
  if (error) return noStoreJson({ error: error.message }, { status: 500 });
  return noStoreJson({ success: true });
}

export async function DELETE(request: Request) {
  const session = getStudentSession(request);
  if (!session) return noStoreJson({ error: 'unauthorized' }, { status: 401 });
  const { token } = await request.json().catch(() => ({}));
  if (typeof token === 'string' && token) {
    await supabaseAdmin.from('device_tokens').delete().eq('token', token);
  }
  return noStoreJson({ success: true });
}
