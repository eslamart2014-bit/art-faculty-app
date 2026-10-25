import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

function buildWebhookUrl(request: Request): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  if (configured) {
    return `${configured.replace(/\/+$/, '')}/api/bot/webhook`;
  }
  const host = request.headers.get('host');
  if (!host) return null;
  const protocol = host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}/api/bot/webhook`;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error: Missing Supabase keys.' }, { status: 500 });
  }
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    
    const sessionToken = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(sessionToken);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'مدير') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const reqBody = await request.json();
    const { action } = reqBody;

    if (action === 'save_token') {
      const { botToken } = reqBody;
      if (!botToken) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

      // 1. Validate Token with Telegram API
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const tgData = await tgRes.json();

      if (!tgData.ok) {
        return NextResponse.json({ error: 'Token is invalid or bot not found on Telegram.' }, { status: 400 });
      }

      const botInfo = tgData.result;

      // 2. Set Webhook with a per-install secret token so forged updates are rejected
      const webhookUrl = buildWebhookUrl(request);
      if (!webhookUrl) {
        return NextResponse.json({ error: 'تعذر تحديد رابط الموقع لربط الويبهوك' }, { status: 500 });
      }

      const { data: sysData } = await supabaseAdmin.from('system_settings').select('telegram_config').eq('id', 1).maybeSingle();
      const currentConfig = sysData?.telegram_config || {};
      const webhookSecret = typeof currentConfig.webhook_secret === 'string' && currentConfig.webhook_secret.length >= 32
        ? currentConfig.webhook_secret
        : randomBytes(32).toString('hex');

      const hookRes = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(webhookSecret)}`
      );
      const hookData = await hookRes.json();

      if (!hookData.ok) {
        return NextResponse.json({ error: 'Failed to set webhook: ' + hookData.description }, { status: 500 });
      }

      const settingsValue = {
        ...currentConfig,
        token: botToken,
        botInfo: botInfo,
        webhookUrl: webhookUrl,
        webhook_secret: webhookSecret
      };

      const { error: dbError } = await supabaseAdmin
        .from('system_settings')
        .update({ telegram_config: settingsValue, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (dbError) throw dbError;

      return NextResponse.json({ success: true, botInfo, data: settingsValue });
    }

    if (action === 'register_webhook') {
      const { data: sysData } = await supabaseAdmin.from('system_settings').select('telegram_config').eq('id', 1).maybeSingle();
      const currentConfig = sysData?.telegram_config || {};
      const botToken = typeof currentConfig.token === 'string' ? currentConfig.token : '';
      if (!botToken) {
        return NextResponse.json({ error: 'لم يتم حفظ توكن البوت بعد' }, { status: 400 });
      }

      const webhookUrl = buildWebhookUrl(request);
      if (!webhookUrl) {
        return NextResponse.json({ error: 'تعذر تحديد رابط الموقع لربط الويبهوك' }, { status: 500 });
      }

      const webhookSecret = typeof currentConfig.webhook_secret === 'string' && currentConfig.webhook_secret.length >= 32
        ? currentConfig.webhook_secret
        : randomBytes(32).toString('hex');

      const hookRes = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(webhookSecret)}`
      );
      const hookData = await hookRes.json();
      if (!hookData.ok) {
        return NextResponse.json({ error: 'Failed to set webhook: ' + hookData.description }, { status: 500 });
      }

      const settingsValue = { ...currentConfig, webhookUrl, webhook_secret: webhookSecret };
      const { error: dbError } = await supabaseAdmin
        .from('system_settings')
        .update({ telegram_config: settingsValue, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (dbError) throw dbError;

      return NextResponse.json({ success: true, webhookUrl });
    }

    if (action === 'save_student_permissions') {
      const { showProjectScores, showStudentAttendance } = reqBody;
      
      const { data: sysData } = await supabaseAdmin.from('system_settings').select('telegram_config').eq('id', 1).maybeSingle();
      const currentConfig = sysData?.telegram_config || {};

      const updatedConfig = {
        ...currentConfig,
        show_project_scores_to_students: showProjectScores !== undefined ? showProjectScores : true,
        show_attendance_to_students: showStudentAttendance !== undefined ? showStudentAttendance : true
      };

      const { error: dbError } = await supabaseAdmin
        .from('system_settings')
        .update({ telegram_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (dbError) throw dbError;

      return NextResponse.json({ success: true, data: updatedConfig });
    }

    if (action === 'get_token') {
      const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('telegram_config')
        .eq('id', 1)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data && data.telegram_config) {
        return NextResponse.json({ success: true, data: data.telegram_config });
      }
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error("TELEGRAM API ERROR:", error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تنفيذ العملية' }, { status: 500 });
  }
}
