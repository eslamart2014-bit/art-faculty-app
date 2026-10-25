import { NextResponse } from 'next/server';
import {
  STAFF_COOKIE,
  STUDENT_COOKIE,
  getStaffContext,
  getStudentSession,
  parseCookies,
} from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

async function isAuthorized(request: Request): Promise<boolean> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const hasStaffCookie = Boolean(cookies[STAFF_COOKIE]);
  const hasStudentCookie = Boolean(cookies[STUDENT_COOKIE]);

  if (!hasStaffCookie && !hasStudentCookie) return false;
  if (hasStudentCookie && getStudentSession(request)) return true;
  if (hasStaffCookie) {
    const staff = await getStaffContext(request);
    if (staff) return true;
  }
  return false;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!fileId || !FILE_ID_PATTERN.test(fileId) || !token) {
    return new NextResponse('Media not available', { status: 404 });
  }

  if (!(await isAuthorized(request))) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { cache: 'no-store' }
    );
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result?.file_path) {
      return new NextResponse('Media not available', { status: 404 });
    }

    const filePath = String(fileData.result.file_path);
    if (!/^[A-Za-z0-9_\-./]+$/.test(filePath)) {
      return new NextResponse('Media not available', { status: 404 });
    }

    const imgRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
      cache: 'no-store',
    });

    if (!imgRes.ok || !imgRes.body) {
      return new NextResponse('Media not available', { status: 502 });
    }

    const contentLength = Number(imgRes.headers.get('content-length') || 0);
    if (contentLength > MAX_MEDIA_BYTES) {
      return new NextResponse('Media too large', { status: 413 });
    }

    const contentType = imgRes.headers.get('content-type') || '';
    const safeType = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(contentType)
      ? contentType
      : 'application/octet-stream';

    const headers = new Headers({
      'Content-Type': safeType,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    });
    if (contentLength > 0) headers.set('Content-Length', String(contentLength));

    return new NextResponse(imgRes.body, { status: 200, headers });
  } catch {
    return new NextResponse('Media not available', { status: 502 });
  }
}
