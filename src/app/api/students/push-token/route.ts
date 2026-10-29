import { getStudentSession, noStoreJson } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode, getStudentCodeVariants } from '@/lib/codeHelper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = getStudentSession(request);
    const body = await request.json().catch(() => ({}));
    const { token, student_code } = body;

    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
      return noStoreJson({ error: 'invalid token' }, { status: 400 });
    }

    // Determine target student code from session or validated body parameter
    let targetCode = session?.code || null;

    if (!targetCode && typeof student_code === 'string' && student_code.trim()) {
      const clean = formatStudentCode(student_code.trim());
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, student_code')
        .in('student_code', getStudentCodeVariants(clean))
        .maybeSingle();

      if (student?.student_code) {
        targetCode = student.student_code;
      }
    }

    if (!targetCode) {
      return noStoreJson({ error: 'unauthorized' }, { status: 401 });
    }

    const formatted = formatStudentCode(targetCode);

    const { error } = await supabaseAdmin.from('device_tokens').upsert(
      {
        token,
        student_code: formatted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) {
      console.error('[push-token] Error upserting token:', error);
      return noStoreJson({ error: error.message }, { status: 500 });
    }

    // Record installation / active mobile app session in portal_audit_logs
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: formatted,
        action: 'apk_install',
        details: {
          source: 'android_fcm_token_registration',
          token_prefix: token.substring(0, 16),
          registered_at: new Date().toISOString()
        }
      });
    } catch (e) {}

    return noStoreJson({ success: true, registered: formatted });
  } catch (err: any) {
    return noStoreJson({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = getStudentSession(request);
  const body = await request.json().catch(() => ({}));
  const token = body?.token;

  if (typeof token === 'string' && token) {
    await supabaseAdmin.from('device_tokens').delete().eq('token', token);
  }
  return noStoreJson({ success: true });
}
