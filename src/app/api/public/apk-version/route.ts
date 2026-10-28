import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    versionCode: 6,
    versionName: '1.0.5',
    downloadUrl: 'https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.5/ArtEdu-Student-Portal-Release.apk',
    changelog: '⚡ مميزات الإصدار الأصلي فائق الاستقرار v1.0.5:\n• دخول فوري ومباشر إلى لوحة الطالب دون وميض شاشات الدخول\n• دعم كامل للعمل بدون نت مع شريط حالة التحديث مثل تطبيقات الاتصالات\n• تحسين التمرير وإلغاء الريفرش التلقائي عند سحب الشاشة\n• دعم كامل لأزرار الرجوع وإيماءات السحب في جميع الهواتف\n• محرك إشعارات ذكي عند تسجيل الحضور، إضافة المشاريع، واعتماد الدواليب',
    minRequiredVersionCode: 1,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
