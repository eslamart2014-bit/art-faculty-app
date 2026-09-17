/**
 * محرك تخزين الوسائط السحابي الصامت (Silent Telegram Media Storage Engine)
 * يرفع الصور في الخلفية إلى تيليجرام ليوفر سعة تخزين غير محدودة ومجانية 100%
 * مع دعم بديل فوري في حال عدم توفر التوكن.
 */

export interface UploadResult {
  success: boolean;
  url: string;
  fileId?: string;
  source: 'telegram' | 'supabase' | 'base64';
  error?: string;
}

export async function uploadImageToStorage(
  base64Data: string,
  caption = 'بوابة فنية - صورة عمل فني',
  botToken?: string,
  chatId?: string
): Promise<UploadResult> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId || process.env.TELEGRAM_MEDIA_CHAT_ID;

  // 1. إذا توفر توكن التيليجرام والشات آي دي: رفع إلى تيليجرام صامت
  if (token && targetChatId) {
    try {
      // تحويل base64 إلى Buffer
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      const formData = new FormData();
      formData.append('chat_id', targetChatId);
      formData.append('caption', caption);
      const blob = new Blob([buffer], { type: 'image/webp' });
      formData.append('photo', blob, 'artwork.webp');

      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.ok && data.result?.photo?.length > 0) {
        // نأخذ أعلى جودة للصورة (آخر عنصر في المصفوفة)
        const highestPhoto = data.result.photo[data.result.photo.length - 1];
        const fileId = highestPhoto.file_id;

        // الحصول على مسار الملف المباشر
        const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();

        if (fileData.ok && fileData.result?.file_path) {
          const directUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
          // استخدام رابط وسيط داخلي لحماية التوكن من الظهور في كود المتصفح
          const safeProxyUrl = `/api/media/${fileId}`;
          return {
            success: true,
            url: safeProxyUrl,
            fileId: fileId,
            source: 'telegram',
          };
        }
      }
    } catch (e: any) {
      console.warn('Telegram upload failed, falling back...', e?.message);
    }
  }

  // 2. بديل آمن: تخزين مضغوط عالي الكفاءة
  // الصور مضغوطة بالفعل لـ ~50KB عبر WebP فيمكن تخزينها بأمان
  return {
    success: true,
    url: base64Data, // DataURL خفيف جداً (~50KB)
    source: 'base64',
  };
}
