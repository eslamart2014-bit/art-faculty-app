import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { getStudentSession, noStoreJson } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = getStudentSession(request);
    const body = await request.json().catch(() => ({}));
    const rawCode = body.student_code || session?.code || '';
    const action = body.action === 'install' ? 'apk_install' : 'apk_download';
    const version = body.version || '1.0.6';

    if (!rawCode) {
      return noStoreJson({ success: false, error: 'student_code required' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(String(rawCode).trim());

    // Record event to portal_audit_logs
    await supabaseAdmin.from('portal_audit_logs').insert({
      student_code: cleanCode,
      action: action,
      details: {
        version,
        source: 'migration_screen',
        user_agent: request.headers.get('user-agent') || 'unknown',
        recorded_at: new Date().toISOString()
      }
    });

    return noStoreJson({ success: true, recorded: cleanCode, action });
  } catch (err: any) {
    return noStoreJson({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawCode = url.searchParams.get('code') || '';
    const action = url.searchParams.get('action') === 'install' ? 'apk_install' : 'apk_download';
    const version = url.searchParams.get('version') || '1.0.6';

    if (!rawCode) {
      return noStoreJson({ success: false, error: 'code required' }, { status: 400 });
    }

    const cleanCode = formatStudentCode(rawCode.trim());

    await supabaseAdmin.from('portal_audit_logs').insert({
      student_code: cleanCode,
      action: action,
      details: {
        version,
        source: 'migration_screen_get',
        user_agent: request.headers.get('user-agent') || 'unknown',
        recorded_at: new Date().toISOString()
      }
    });

    return noStoreJson({ success: true, recorded: cleanCode, action });
  } catch (err: any) {
    return noStoreJson({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
