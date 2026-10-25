import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';
import { noStoreJson } from '@/lib/serverAuth';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const ALLOWED_ACTIONS = new Set(['student_search', 'download_card', 'view_card']);
const MAX_TEXT = 120;

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_TEXT);
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(`search-log:${ip}`, 60, 60_000)) {
      return noStoreJson({ success: false, error: 'too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const action = ALLOWED_ACTIONS.has(body.action) ? body.action : 'student_search';
    const query = cleanText(body.query);
    const studentCode = cleanText(body.student_code);
    const studentName = cleanText(body.student_name);
    const academicYear = cleanText(body.academic_year);
    const section = cleanText(body.section);

    const codeValue = studentCode || (query ? `query:${query}` : null);
    if (!codeValue) {
      return noStoreJson({ success: false, error: 'missing student reference' }, { status: 400 });
    }

    const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
    const deviceId = cleanText(body.device_id) || 'unknown_device';

    const logEntry = {
      student_code: codeValue,
      action,
      device_id: deviceId,
      user_agent: userAgent,
      details: {
        student_name: studentName,
        academic_year: academicYear,
        section,
        query,
        ip,
        platform: cleanText(body.device_info?.platform),
        screen: cleanText(body.device_info?.screenResolution),
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    };

    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: logEntry.student_code,
        action: logEntry.action,
        device_id: logEntry.device_id,
        user_agent: logEntry.user_agent,
        details: logEntry.details,
      });
    } catch (dbErr) {
      console.warn('Supabase search log insert fallback:', dbErr);
    }

    try {
      localStore.saveAuditLog(logEntry);
    } catch (localErr) {}

    return noStoreJson({ success: true });
  } catch (err: any) {
    console.error('Error logging student search:', err);
    return noStoreJson({ success: false, error: 'log failed' }, { status: 500 });
  }
}
