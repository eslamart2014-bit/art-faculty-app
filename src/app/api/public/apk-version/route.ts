import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    versionCode: 8,
    versionName: '1.0.7',
    downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.7/ArtEdu-Student-Portal-Release.apk',
    changelog: 'يتوفر تحديث جديد للتطبيق.',
    minRequiredVersionCode: 1,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
