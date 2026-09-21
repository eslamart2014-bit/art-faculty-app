import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { complaint_id, reply_text, admin_name } = await request.json();

    if (!complaint_id || !reply_text?.trim()) {
      return NextResponse.json({ error: 'معرف الشكوى ونص الرد مطلوبان' }, { status: 400 });
    }

    const trimmedReply = reply_text.trim();
    const responder = admin_name || 'إدارة الكلية';
    const now = new Date().toISOString();

    // 1. Fetch complaint details
    const { data: complaint, error: compErr } = await supabaseAdmin
      .from('student_complaints')
      .select('*')
      .eq('id', complaint_id)
      .maybeSingle();

    if (compErr || !complaint) {
      return NextResponse.json({ error: 'الشكوى غير موجودة' }, { status: 404 });
    }

    // 2. Update complaint status to 'تم الرد'
    await supabaseAdmin
      .from('student_complaints')
      .update({ status: 'تم الرد' })
      .eq('id', complaint_id);

    // 3. Save reply to system_settings.telegram_config.complaint_replies
    try {
      const { data: settingsData } = await supabaseAdmin
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 1)
        .maybeSingle();

      const existingConfig = settingsData?.telegram_config || {};
      const existingReplies = existingConfig.complaint_replies || {};

      existingReplies[complaint_id] = {
        reply: trimmedReply,
        replied_at: now,
        replied_by: responder
      };

      await supabaseAdmin
        .from('system_settings')
        .update({
          telegram_config: {
            ...existingConfig,
            complaint_replies: existingReplies
          }
        })
        .eq('id', 1);
    } catch (cfgErr) {
      console.warn('Could not store reply in system_settings:', cfgErr);
    }

    // 4. Send official reply into suggestions_chat for the student
    try {
      await supabaseAdmin.from('suggestions_chat').insert({
        user_id: complaint.student_code,
        message: `💬 [رد رسمي من ${responder} بخصوص الشكوى]:\n${trimmedReply}`,
        is_admin: true,
        read_by_admin: true,
        read_by_user: false,
      });
    } catch (chatErr) {
      console.warn('Could not forward reply to suggestions_chat:', chatErr);
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال الرد الرسمي للطالب وحفظه بنجاح',
      reply: {
        admin_reply: trimmedReply,
        replied_at: now,
        replied_by: responder,
        status: 'تم الرد'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
