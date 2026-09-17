import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !fileId) {
    return new NextResponse('Media not available', { status: 404 });
  }

  try {
    // 1. استخراج مسار الملف عبر Telegram getFile
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result?.file_path) {
      return new NextResponse('File path not found', { status: 404 });
    }

    const filePath = fileData.result.file_path;
    const directUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    // 2. جلب محتوى الصورة وتمريره للمتصفح مع كاش سريع جداً
    const imgRes = await fetch(directUrl);
    const contentType = imgRes.headers.get('content-type') || 'image/webp';
    const buffer = await imgRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    return new NextResponse('Media fetch error: ' + err.message, { status: 500 });
  }
}
