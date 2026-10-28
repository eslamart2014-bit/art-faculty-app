import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    versionCode: 4,
    versionName: '1.0.3',
    downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.3/ArtEdu-Student-Portal-Release.apk',
    changelog: '✨ مميزات الإصدار المعتمد v1.0.3:\n• توقيع أمني رسمي معتمد من الكلية وتجاوز تحذيرات الحماية\n• تنقية الأذونات الحساسة وحماية أمان الهاتف بالكامل\n• استقرار فائق في الإشعارات الفورية والتحديثات',
    minRequiredVersionCode: 1,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
