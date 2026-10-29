import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    versionCode: 7,
    versionName: '1.0.6',
    downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.6/ArtEdu-Student-Portal-Release.apk',
    changelog: '🔔 v1.0.6: إشعارات فورية حقيقية عبر Firebase تصل حتى والتطبيق مغلق: الحضور، المشاريع الجديدة، اعتماد الدولاب.',
    minRequiredVersionCode: 1,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
