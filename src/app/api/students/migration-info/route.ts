import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { formatStudentCode } from '@/lib/codeHelper';
import { noStoreJson, getStudentSession, getStaffContext } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryCode = url.searchParams.get('code');
    const isTestParam = url.searchParams.get('test_update') === '1' || url.searchParams.get('preview') === '1' || url.searchParams.get('preview_update') === '1';

    // 1. Determine student code
    let studentCode = '';
    const session = getStudentSession(request);
    if (session?.code) {
      studentCode = session.code;
    }

    // Allow query code if in test mode or if authenticated staff/admin or if no session code
    if (queryCode && (isTestParam || !studentCode)) {
      studentCode = queryCode;
    }

    // Check system settings for global migration enable flag
    const { data: settingsData } = await supabaseAdmin
      .from('system_settings')
      .select('telegram_config')
      .eq('id', 1)
      .maybeSingle();

    const cfg = settingsData?.telegram_config || {};
    const migrationGloballyEnabled = Boolean(cfg.student_migration_screen);

    // If no student code determined, return status
    if (!studentCode) {
      return noStoreJson({
        success: false,
        error: 'لم يتم العثور على جلسة طالب نشطة على هذا المتصفح',
        migration_enabled: migrationGloballyEnabled
      }, { status: 404 });
    }

    const cleanCode = formatStudentCode(studentCode.trim());
    const codeCandidates = Array.from(new Set([studentCode.trim(), cleanCode].filter(Boolean)));

    // Fetch account from student_accounts
    const { data: account, error: accErr } = await supabaseAdmin
      .from('student_accounts')
      .select('id, student_id, student_code, full_name, academic_year, section, mobile, pin_code, status, is_pin_used, created_at')
      .in('student_code', codeCandidates)
      .maybeSingle();

    if (!account) {
      // Check students table fallback
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, student_code, full_name, academic_year, section, telegram_browser_id')
        .in('student_code', codeCandidates)
        .maybeSingle();

      if (student && student.telegram_browser_id) {
        try {
          const parsed = JSON.parse(student.telegram_browser_id);
          return noStoreJson({
            success: true,
            student: {
              student_code: student.student_code,
              full_name: student.full_name,
              pin_code: parsed.pin_code || 'غير محدد',
              academic_year: student.academic_year,
              section: student.section,
              status: parsed.status || 'active'
            },
            apk: {
              version: '1.0.6',
              versionCode: 7,
              downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.6/ArtEdu-Student-Portal-Release.apk',
              changelog: '🔔 v1.0.6: إشعارات فورية حقيقية عبر Firebase تصل حتى والتطبيق مغلق: الحضور، المشاريع الجديدة، اعتماد الدولاب.'
            },
            migration_enabled: migrationGloballyEnabled
          });
        } catch (e) {}
      }

      return noStoreJson({
        success: false,
        error: 'لم يتم العثور على حساب مسجل لهذا الطالب',
        migration_enabled: migrationGloballyEnabled
      }, { status: 404 });
    }

    return noStoreJson({
      success: true,
      student: {
        student_code: account.student_code,
        full_name: account.full_name,
        pin_code: account.pin_code || '',
        academic_year: account.academic_year || '',
        section: account.section || '',
        status: account.status || 'active',
        is_pin_used: account.is_pin_used
      },
      apk: {
        version: '1.0.6',
        versionCode: 7,
        downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.6/ArtEdu-Student-Portal-Release.apk',
        changelog: '🔔 v1.0.6: إشعارات فورية حقيقية عبر Firebase تصل حتى والتطبيق مغلق: الحضور، المشاريع الجديدة، اعتماد الدولاب.'
      },
      migration_enabled: migrationGloballyEnabled
    });
  } catch (err: any) {
    console.error('migration-info error:', err);
    return noStoreJson({ error: 'خطأ في معالجة الطلب' }, { status: 500 });
  }
}
