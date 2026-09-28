import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { localStore } from '@/lib/localFallbackStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      student_code, 
      student_name, 
      academic_year, 
      section, 
      action = 'student_search', 
      query, 
      device_id,
      device_info 
    } = body;

    const userAgent = request.headers.get('user-agent') || device_info?.userAgent || '';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';

    const logEntry = {
      student_code: student_code || (query ? `query:${query}` : 'unknown'),
      action: action, // 'student_search' | 'download_card' | 'view_card'
      device_id: device_id || device_info?.deviceId || 'unknown_device',
      user_agent: userAgent,
      details: {
        student_name: student_name || null,
        academic_year: academic_year || null,
        section: section || null,
        query: query || null,
        ip: ip,
        platform: device_info?.platform || null,
        screen: device_info?.screenResolution || null,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };

    // 1. حفظ في Supabase
    try {
      await supabaseAdmin.from('portal_audit_logs').insert({
        student_code: logEntry.student_code,
        action: logEntry.action,
        device_id: logEntry.device_id,
        user_agent: logEntry.user_agent,
        details: logEntry.details
      });
    } catch (dbErr) {
      console.warn('Supabase search log insert fallback:', dbErr);
    }

    // 2. حفظ محلي احتياطي (Local Fallback)
    try {
      localStore.saveAuditLog(logEntry);
    } catch (localErr) {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error logging student search:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
