import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch complaints from student_complaints
    const { data: complaints, error } = await supabaseAdmin
      .from('student_complaints')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching student complaints:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Fetch replies map from system_settings
    let complaintRepliesMap: Record<string, any> = {};
    try {
      const { data: settingsData } = await supabaseAdmin
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 1)
        .maybeSingle();

      if (settingsData?.telegram_config?.complaint_replies) {
        complaintRepliesMap = settingsData.telegram_config.complaint_replies;
      }
    } catch (e) {
      console.warn('Failed to load complaint replies from settings:', e);
    }

    // 3. Enrich complaints
    const enrichedComplaints = (complaints || []).map((c: any) => {
      const rep = complaintRepliesMap[c.id];
      const hasReply = !!(c.admin_reply || rep?.reply);
      return {
        ...c,
        admin_reply: c.admin_reply || rep?.reply || null,
        replied_at: c.replied_at || rep?.replied_at || null,
        replied_by: c.replied_by || rep?.replied_by || null,
        status: hasReply ? 'تم الرد' : (c.status || 'جديدة')
      };
    });

    return NextResponse.json({
      success: true,
      complaints: enrichedComplaints
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
