import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    versionCode: 8,
    versionName: '1.0.7',
    downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.7/ArtEdu-Student-Portal-Release.apk',
    changelog: '🔔 v1.0.7: تحديث أيقونة الإشعارات في شريط الحالة لتظهر كلمة "فنية" مفرغة وبدقة فائقة، مع تحسينات الأداء واستقرار الإشعارات.',
    minRequiredVersionCode: 1,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
