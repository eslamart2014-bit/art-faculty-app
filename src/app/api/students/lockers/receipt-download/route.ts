import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase';
import { getStudentSession } from '@/lib/auth/serverAuth';
import { getStudentCodeVariants } from '@/lib/students/codeHelper';
import { getStudentTelegramButtons, getActiveTelegramBotToken } from '@/lib/telegram/push';

export const dynamic = 'force-dynamic';

async function sendPdfToTelegramChat(
  chatId: string | number,
  pdfBuffer: Buffer,
  filename: string,
  lockerCode: string,
  cohort?: string
): Promise<boolean> {
  const botToken = await getActiveTelegramBotToken();
  if (!botToken || !chatId || String(chatId) === '999888777') return false;

  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
    formData.append('document', blob, filename);
    formData.append(
      'caption',
      `📄 <b>استمارة تسجيل الدولاب رقم (${lockerCode})</b>\n` +
        `🎓 ${cohort || 'قسم التربية الفنية - جامعة قنا'}\n\n` +
        `✅ تم تجهيز ملف الاستمارة (PDF) بدقة عالية، يمكنك فتحه وطباعته مباشرة من هنا.`
    );
    formData.append('parse_mode', 'HTML');
    formData.append('reply_markup', JSON.stringify(getStudentTelegramButtons()));

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    return Boolean(data?.ok);
  } catch (err) {
    console.error('[receipt-download] Telegram sendDocument error:', err);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, pdfBase64, lockerCode, cohort, studentCode, studentCodes, telegramId } = body;

    if (!pdfBase64) {
      return NextResponse.json({ error: 'Missing pdfBase64' }, { status: 400 });
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const safeCode = (lockerCode || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = filename || `استمارة_دولاب_${safeCode}.pdf`;
    const storagePath = `receipts/${Date.now()}_locker_${safeCode}.pdf`;

    // 1. Collect target Telegram chat ID(s) to deliver the PDF directly in Bot chat
    const targetChatIds = new Set<string>();
    if (telegramId && String(telegramId).trim() && String(telegramId).trim() !== '999888777') {
      targetChatIds.add(String(telegramId).trim());
    }

    const session = getStudentSession(request);
    const primaryCode = studentCode || session?.code;
    if (primaryCode) {
      const { data: st } = await supabaseAdmin
        .from('students')
        .select('telegram_id')
        .in('student_code', getStudentCodeVariants(String(primaryCode)))
        .maybeSingle();
      if (st?.telegram_id && String(st.telegram_id) !== '999888777') {
        targetChatIds.add(String(st.telegram_id));
      }
    }

    // If still no chat ID found (e.g. testing locally or partner clicked download), check locker members
    if (targetChatIds.size === 0 && Array.isArray(studentCodes) && studentCodes.length > 0) {
      const allVariants = studentCodes
        .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
        .flatMap((c: string) => getStudentCodeVariants(c.trim()));
      if (allVariants.length > 0) {
        const { data: members } = await supabaseAdmin
          .from('students')
          .select('telegram_id')
          .in('student_code', allVariants)
          .not('telegram_id', 'is', null);
        for (const m of members || []) {
          if (m?.telegram_id && String(m.telegram_id) !== '999888777') {
            targetChatIds.add(String(m.telegram_id));
          }
        }
      }
    }

    let sentToTelegram = false;
    for (const chatId of targetChatIds) {
      const ok = await sendPdfToTelegramChat(chatId, buffer, safeFilename, lockerCode || safeCode, cohort);
      if (ok) sentToTelegram = true;
    }

    // 2. Upload to Supabase Storage (artworks bucket)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('artworks')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[receipt-download POST] Storage upload error:', uploadError);
      return NextResponse.json({
        success: true,
        downloadUrl: pdfBase64,
        filename: safeFilename,
        sentToTelegram,
        isFallback: true,
      });
    }

    // 3. Generate direct attachment download URL
    const attachmentUrl = `/api/students/lockers/receipt-download?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(safeFilename)}`;

    // Also get public storage URL
    const { data: publicData } = supabaseAdmin.storage
      .from('artworks')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      downloadUrl: attachmentUrl,
      publicUrl: publicData?.publicUrl || attachmentUrl,
      filename: safeFilename,
      sentToTelegram,
    });
  } catch (err: any) {
    console.error('[receipt-download POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');
    const filename = url.searchParams.get('filename') || 'استمارة_دولاب.pdf';

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from('artworks')
      .download(filePath);

    if (error || !data) {
      console.error('[receipt-download GET] Download error:', error);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="locker_receipt.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err: any) {
    console.error('[receipt-download GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
