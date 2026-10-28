import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    versionCode: 3,
    versionName: '1.0.2',
    downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.2/ArtEdu-Student-Portal-Release.apk',
    changelog: '✨ مميزات الإصدار v1.0.2:\n• دعم كامل للإشعارات الفورية حتى عند إغلاق التطبيق\n• التحديث التلقائي الذكي بنقرة واحدة من داخل التطبيق\n• تمرير سلس فائق السرعة واستجابة كاملة لأزرار وإيماءات الرجوع',
    minRequiredVersionCode: 1,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
