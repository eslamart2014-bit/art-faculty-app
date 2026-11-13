/**
 * مساعد استخراج بصمة اللوحة الفنية من الـ Canvas في المتصفح
 * يُستدعى بعد ضغط الصورة في imageCompressor
 */
import { extractArtSignature, packArtSignature } from '@/lib/art-vision/engine';

/**
 * يستخرج البصمة البصرية المتقدمة من عنصر canvas ويعيدها كنص مضغوط
 */
export function extractArtSigFromCanvas(canvas: HTMLCanvasElement): string {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const w = canvas.width;
    const h = canvas.height;
    if (w < 64 || h < 64) return '';
    const imgData = ctx.getImageData(0, 0, w, h);
    const sig = extractArtSignature(imgData.data, w, h);
    if (sig.n < 10) return '';
    return packArtSignature(sig);
  } catch (e) {
    console.error('extractArtSigFromCanvas error:', e);
    return '';
  }
}
