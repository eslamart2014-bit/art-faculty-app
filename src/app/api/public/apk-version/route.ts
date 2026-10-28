import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    versionCode: 5,
    versionName: '1.0.4',
    downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.4/ArtEdu-Student-Portal-Release.apk',
    changelog: '⚡ مميزات الإصدار المحلي فائق السرعة v1.0.4:\n• واجهة رسومية محلية محملة في ذاكرة الهاتف تفتح فورياً (0 ثانية)\n• إلغاء شريط المتصفح العلوي وتوفير تجربة تطبيق أصلي بالكامل\n• توفير 95% من استهلاك بيانات الهاتف وعمل سلس حتى بدون إنترنت',
    minRequiredVersionCode: 1,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
