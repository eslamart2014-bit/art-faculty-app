import { formatStudentCode } from '@/lib/codeHelper';
import { isAndroidAppClient, isIOSClient } from '@/lib/deviceFingerprint';

export interface QrCardOptions {
  student_code: string;
  full_name: string;
  academic_year?: string;
  section?: string;
  svgElementId?: string;
}

/**
 * دالة ذكية وشاملة لحفظ بطاقة الـ QR الخاصة بالطالب كصورة عالية الدقة (PNG).
 * - داخل تطبيق أندرويد الأصلي (APK): تُحفظ مباشرة في مجلد التحميلات (Downloads) عبر Native Bridge مع إشعار نظام.
 * - على أجهزة آيفون (iOS): تفتح نافذة المشاركة الرسمية (Share Sheet) ليتمكن الطالب من الضغط على "حفظ الصورة" في ألبوم الصور.
 * - على متصفحات الويب: يتم التنزيل التلقائي كملف PNG فائق النقاء.
 */
export async function saveStudentQrCard(options: QrCardOptions): Promise<{ success: boolean; method: string }> {
  if (typeof window === 'undefined') return { success: false, method: 'server' };

  const { student_code, full_name, academic_year, section, svgElementId = 'student-qr-code' } = options;
  const svg = document.getElementById(svgElementId) as SVGSVGElement | null;
  if (!svg) {
    throw new Error('لم يتم العثور على عنصر كود الـ QR في الصفحة.');
  }

  // 1. تجهيز كود الـ SVG بأبعاد صريحة لتفادي خطأ الصورة الفارغة (0x0) في بعض المتصفحات
  const cloned = svg.cloneNode(true) as SVGSVGElement;
  cloned.setAttribute('width', '600');
  cloned.setAttribute('height', '600');
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const svgString = new XMLSerializer().serializeToString(cloned);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgBlobUrl = URL.createObjectURL(svgBlob);

  const qrImage = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error('فشل تحميل رمز الـ QR'));
    qrImage.src = svgBlobUrl;
  });
  URL.revokeObjectURL(svgBlobUrl);

  // 2. إنشاء لوحة رسم فائقة الدقة (1000 × 1350 بكسل) لبطاقة الهوية الرقمية
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر إنشاء لوحة الرسم (Canvas)');

  // خلفية كحلية متدرجة فخمة
  const bgGrad = ctx.createLinearGradient(0, 0, 1000, 1350);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(0.5, '#131e33');
  bgGrad.addColorStop(1, '#080d19');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1000, 1350);

  // شريط علوي ملون أنيق
  const barGrad = ctx.createLinearGradient(0, 0, 1000, 0);
  barGrad.addColorStop(0, '#06b6d4');
  barGrad.addColorStop(0.5, '#3b82f6');
  barGrad.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, 1000, 24);

  // إطار البطاقة الخارجي
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 4;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(30, 45, 940, 1265, 24);
    ctx.stroke();
  } else {
    ctx.strokeRect(30, 45, 940, 1265);
  }

  // ترويسة الكلية الأكاديمية
  ctx.textAlign = 'center';
  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 28px Cairo, system-ui, sans-serif';
  ctx.fillText('جامعة حلوان • كلية التربية الفنية', 500, 95);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px Cairo, system-ui, sans-serif';
  ctx.fillText('منظومة التعليم الذكي • بطاقة الهوية الرقمية', 500, 135);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 160);
  ctx.lineTo(880, 160);
  ctx.stroke();

  // حاوية الـ QR البيضاء الواضحة (سهلة المسح من كاميرات الأساتذة)
  const qrBoxSize = 720;
  const qrBoxX = (1000 - qrBoxSize) / 2;
  const qrBoxY = 190;

  ctx.fillStyle = '#ffffff';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
  }

  // رسم رمز الـ QR في المنتصف بهامش أبيض متناسق
  const qrPadding = 30;
  ctx.drawImage(
    qrImage,
    qrBoxX + qrPadding,
    qrBoxY + qrPadding,
    qrBoxSize - qrPadding * 2,
    qrBoxSize - qrPadding * 2
  );

  // اسم الطالب بخط عريض وواضح
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Cairo, system-ui, sans-serif';
  ctx.fillText(full_name || 'طالب جامعي', 500, 975);

  // شارة الفرقة والسكشن
  if (academic_year || section) {
    const badgeText = `${academic_year || 'الفرقة الدراسية'} • سكشن ${section || 'عام'}`;
    ctx.fillStyle = '#1e293b';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(200, 1005, 600, 56, 28);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 26px Cairo, system-ui, sans-serif';
    ctx.fillText(badgeText, 500, 1042);
  }

  // كود الطالب البارز
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 22px Cairo, system-ui, sans-serif';
  ctx.fillText('الكود الجامعي المعتمد', 500, 1105);

  const cleanCode = formatStudentCode(student_code);
  ctx.fillStyle = '#f59e0b';
  ctx.font = '900 60px monospace, Cairo, sans-serif';
  ctx.fillText(cleanCode, 500, 1165);

  // تعليمات الاستخدام
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(80, 1200, 840, 60, 14);
    ctx.fill();
  }
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 20px Cairo, system-ui, sans-serif';
  ctx.fillText('📸 احتفظ بهذه البطاقة لتسجيل حضورك وتقييمك اليومي بالكلية', 500, 1238);

  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const safeName = (full_name || 'طالب').replace(/\s+/g, '_').substring(0, 25);
  const fileName = `بطاقة_طالب_${cleanCode}_${safeName}.png`;

  // --- آلية الحفظ والتسليم الذكية حسب نوع الجهاز ---

  // 1. تطبيق أندرويد الأصلي (عبر الجسر الأصلي ArtEduNativeBridge)
  if (typeof window !== 'undefined' && (window as any).ArtEduNativeBridge?.saveBase64File) {
    try {
      (window as any).ArtEduNativeBridge.saveBase64File(dataUrl, fileName, 'image/png');
      return { success: true, method: 'android_native' };
    } catch (e) {
      console.warn('Native bridge call failed, falling back:', e);
    }
  }

  // 2. إنشاء Blob لملف الصورة
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
  if (!blob) throw new Error('فشل إنشاء ملف الصورة');

  // 3. أجهزة الآيفون (iOS) أو المتصفحات المحمولة الداعمة للمشاركة (Share Sheet)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `بطاقة الطالب QR - ${cleanCode}`,
          text: `بطاقة الطالب الجامعية: ${full_name} (${cleanCode})`,
        });
        return { success: true, method: 'ios_share' };
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        return { success: true, method: 'share_aborted' };
      }
    }
  }

  // 4. متصفحات الكمبيوتر والمتصفحات العادية (تنزيل كملف مباشر)
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = blobUrl;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 4000);

  return { success: true, method: 'browser_download' };
}
