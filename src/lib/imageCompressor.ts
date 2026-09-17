/**
 * محرك ضغط الصور الفائق وتحويلها إلى WebP وحساب بصمة الصورة الذكية (dHash) لكشف التشابه
 */

export interface CompressionResult {
  blob: Blob;
  dataUrl: string;
  sizeKb: number;
  width: number;
  height: number;
  dhash: string;
  isGoodLighting: boolean;
  brightnessScore: number;
}

// ضغط الصورة إلى WebP مع تحجيم ذكي وحساب البصمة الرقمية ومستوى الإضاءة
export async function compressImageToWebP(
  source: File | Blob | string,
  maxDimension = 1400,
  quality = 0.75
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // تقليص الأبعاد مع الحفاظ على النسبة
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // رسم الصورة بعد الضبط
      ctx.drawImage(img, 0, 0, width, height);

      // فحص جودة الإضاءة
      const lighting = checkBrightness(ctx, width, height);

      // حساب بصمة الصورة (dHash) للذكاء الاصطناعي
      const dhash = computeDHashFromCanvas(canvas);

      // التحويل إلى صيغة WebP فائقة الصغر
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create WebP blob'));
            return;
          }

          const sizeKb = Math.round(blob.size / 1024);
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              blob,
              dataUrl: reader.result as string,
              sizeKb,
              width,
              height,
              dhash,
              isGoodLighting: lighting.isGoodLighting,
              brightnessScore: lighting.brightnessScore,
            });
          };
          reader.readAsDataURL(blob);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

// فحص متوسط إضاءة الصورة لمنع الصور المعتمة
function checkBrightness(ctx: CanvasRenderingContext2D, width: number, height: number) {
  try {
    // أخذ عينة مصغرة للسرعة
    const sampleWidth = Math.min(width, 100);
    const sampleHeight = Math.min(height, 100);
    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
    const data = imgData.data;

    let totalLuminance = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      // معادلة الإضاءة القياسية ITU-R BT.601
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += lum;
    }

    const avgLum = Math.round(totalLuminance / pixelCount);
    // إذا كان أقل من 40 من 255 فهي معتمة جداً
    const isGood = avgLum >= 35;

    return {
      isGoodLighting: isGood,
      brightnessScore: avgLum,
    };
  } catch (e) {
    return { isGoodLighting: true, brightnessScore: 128 };
  }
}

// حساب بصمة الاختلاف (Difference Hash - dHash) 64-bit لكشف تشابه اللوحات الفنية
export function computeDHashFromCanvas(sourceCanvas: HTMLCanvasElement): string {
  try {
    // 1. تصغير الصورة إلى 9 أعمدة × 8 صفوف
    const hashCanvas = document.createElement('canvas');
    hashCanvas.width = 9;
    hashCanvas.height = 8;
    const ctx = hashCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(sourceCanvas, 0, 0, 9, 8);
    const imgData = ctx.getImageData(0, 0, 9, 8);
    const data = imgData.data;

    // 2. تحويل البكسلات إلى تدرج رمادي Grayscale
    const grays: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      grays.push(gray);
    }

    // 3. مقارنة البكسلات المتجاورة أفقياً لتوليد 64 بت (8 صفوف × 8 مقارنات)
    let bitString = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const leftIndex = row * 9 + col;
        const rightIndex = leftIndex + 1;
        bitString += grays[leftIndex] > grays[rightIndex] ? '1' : '0';
      }
    }

    // 4. تحويل الـ 64 بت إلى نص سداسي عشري من 16 خانة
    let hexHash = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = bitString.substring(i, i + 4);
      hexHash += parseInt(nibble, 2).toString(16);
    }

    return hexHash;
  } catch (e) {
    console.error('dHash calculation error:', e);
    return '';
  }
}

// حساب نسبة التطابق بين بصمتين (Hamming Distance)
export function compareDHashes(hash1: string, hash2: string): { distance: number; similarityPercent: number } {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return { distance: 64, similarityPercent: 0 };
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const val1 = parseInt(hash1[i], 16);
    const val2 = parseInt(hash2[i], 16);
    let xor = val1 ^ val2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  // مسافة صفر تعني 100% تطابق، مسافة 64 تعني اختلاف كامل
  const similarity = Math.max(0, Math.round(((64 - distance) / 64) * 100));
  return { distance, similarityPercent: similarity };
}
