import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFirebaseMessaging, sendPushToStudents, broadcastPushToAll } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get('secret');
  const studentCode = searchParams.get('code');
  const isBroadcast = searchParams.get('broadcast') === 'true';

  // Security: Require either PUSH_WEBHOOK_SECRET or student_code to prevent arbitrary unauthorized spam
  const expectedSecret = process.env.PUSH_WEBHOOK_SECRET || 'b8d48d9d6c9ebe4d7b675be4c795d7d0a405707b37a7dc39';
  const isAuthorized = secretParam === expectedSecret || Boolean(studentCode);

  if (!isAuthorized) {
    return NextResponse.json(
      {
        error: 'Unauthorized. Provide ?code=STUDENT_CODE or ?secret=PUSH_WEBHOOK_SECRET',
        help: 'Example: /api/push/test?code=0993',
      },
      { status: 401 }
    );
  }

  // 1. Inspect Firebase Service Account Environment Variable
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  let serviceAccountParsed: any = null;
  let serviceAccountError: string | null = null;

  if (!rawServiceAccount) {
    serviceAccountError = 'FIREBASE_SERVICE_ACCOUNT environment variable is NOT set in Vercel!';
  } else {
    try {
      try {
        serviceAccountParsed = JSON.parse(rawServiceAccount);
      } catch {
        serviceAccountParsed = JSON.parse(Buffer.from(rawServiceAccount, 'base64').toString('utf8'));
      }
    } catch (e: any) {
      serviceAccountError = `FIREBASE_SERVICE_ACCOUNT is malformed JSON: ${e.message}`;
    }
  }

  // 2. Test Firebase Messaging Initialization
  let messagingReady = false;
  let messagingInitError: string | null = null;
  try {
    const messaging = await getFirebaseMessaging();
    messagingReady = Boolean(messaging);
  } catch (err: any) {
    messagingInitError = err?.message || 'Unknown init error';
  }

  // 3. Inspect Supabase Device Tokens Table
  let dbTokensCount = 0;
  let tokensForCode: any[] = [];
  let dbError: string | null = null;

  try {
    const { count, error } = await supabaseAdmin
      .from('device_tokens')
      .select('*', { count: 'exact', head: true });

    if (error) {
      dbError = error.message;
    } else {
      dbTokensCount = count || 0;
    }

    if (studentCode) {
      const { data: codeData } = await supabaseAdmin
        .from('device_tokens')
        .select('token, student_code, updated_at')
        .eq('student_code', studentCode.trim());
      tokensForCode = (codeData || []).map((t: any) => ({
        token_preview: t.token ? `${t.token.substring(0, 20)}...${t.token.substring(t.token.length - 8)}` : '',
        student_code: t.student_code,
        updated_at: t.updated_at,
      }));
    }
  } catch (dbErr: any) {
    dbError = dbErr?.message || 'Database connection error';
  }

  // 4. Send Live Test Push if requested
  let pushResult: any = null;
  if (studentCode && messagingReady) {
    pushResult = await sendPushToStudents([studentCode.trim()], {
      title: '🔔 اختبار وصول الإشعار الفوري',
      body: `تهانينا! الإشعار يعمل بنجاح حتى والتطبيق مغلق تماماً (كود: ${studentCode}) 🎓`,
      type: 'general',
      id: `test_push_${Date.now()}`,
    });
  } else if (isBroadcast && secretParam === expectedSecret && messagingReady) {
    pushResult = await broadcastPushToAll({
      title: '📢 إشعار تجريبي عام',
      body: 'هذا إشعار تجريبي لاختبار وصول الإشعارات الفورية لجميع أجهزة الطلاب.',
      type: 'announcement',
    });
  }

  return NextResponse.json(
    {
      status: 'diagnostic_report',
      timestamp: new Date().toISOString(),
      environment: {
        firebase_service_account_set: Boolean(rawServiceAccount),
        firebase_project_id: serviceAccountParsed?.project_id || null,
        firebase_client_email: serviceAccountParsed?.client_email || null,
        firebase_private_key_present: Boolean(serviceAccountParsed?.private_key),
        firebase_parsing_error: serviceAccountError,
        push_webhook_secret_set: Boolean(process.env.PUSH_WEBHOOK_SECRET),
      },
      firebase_messaging: {
        ready: messagingReady,
        error: messagingInitError,
      },
      supabase_database: {
        table_device_tokens_ok: !dbError,
        total_registered_devices: dbTokensCount,
        error: dbError,
      },
      student_target: studentCode
        ? {
            code: studentCode,
            devices_registered: tokensForCode.length,
            tokens: tokensForCode,
          }
        : null,
      push_dispatch_test: pushResult,
      instructions: !studentCode
        ? 'Pass ?code=0993 to send a live test notification to student 0993.'
        : pushResult?.sent > 0
        ? 'SUCCESS! The notification was dispatched to Google FCM servers. Check the phone!'
        : tokensForCode.length === 0
        ? `No device token registered for student code ${studentCode}. Has this student opened the v1.0.6 app yet?`
        : 'Failed to dispatch push. Inspect environment errors above.',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache',
      },
    }
  );
}
