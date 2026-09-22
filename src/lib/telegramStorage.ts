import { supabaseAdmin } from './supabase';

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
  chatId?: string,
  storagePath?: string
): Promise<UploadResult> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId || process.env.TELEGRAM_MEDIA_CHAT_ID;

  // 1. إذا توفر توكن التيليجرام والشات آي دي: رفع إلى تيليجرام صامت
  if (token && targetChatId) {
    try {
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
        const highestPhoto = data.result.photo[data.result.photo.length - 1];
        const fileId = highestPhoto.file_id;

        return {
          success: true,
          url: `/api/media/${fileId}`,
          fileId: fileId,
          source: 'telegram',
        };
      }
    } catch (e: any) {
      console.warn('Telegram upload failed, falling back to Supabase...', e?.message);
    }
  }

  // 2. الرفع إلى سحابة Supabase Storage في مجلد artworks
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const fileName = storagePath || `submissions/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('artworks')
      .upload(fileName, buffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (!uploadError) {
      const { data: publicUrlData } = supabaseAdmin.storage.from('artworks').getPublicUrl(fileName);
      if (publicUrlData?.publicUrl) {
        return {
          success: true,
          url: publicUrlData.publicUrl,
          source: 'supabase',
        };
      }
    } else {
      console.warn('Supabase artworks storage error:', uploadError);
    }
  } catch (err: any) {
    console.warn('Supabase storage exception:', err?.message);
  }

  // 3. بديل آمن: تخزين مضغوط عالي الكفاءة Base64 Data URL
  return {
    success: true,
    url: base64Data,
    source: 'base64',
  };
}
