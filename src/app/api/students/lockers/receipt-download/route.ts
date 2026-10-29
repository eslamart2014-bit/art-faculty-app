import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, pdfBase64, lockerCode } = body;

    if (!pdfBase64) {
      return NextResponse.json({ error: 'Missing pdfBase64' }, { status: 400 });
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    const safeCode = (lockerCode || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = filename || `استمارة_دولاب_${safeCode}.pdf`;
    const storagePath = `receipts/${Date.now()}_locker_${safeCode}.pdf`;

    // 1. Upload to Supabase Storage (artworks bucket)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('artworks')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('[receipt-download POST] Storage upload error:', uploadError);
      // Fallback: return data URI directly
      return NextResponse.json({
        success: true,
        downloadUrl: pdfBase64,
        filename: safeFilename,
        isFallback: true
      });
    }

    // 2. Generate direct attachment download URL
    const attachmentUrl = `/api/students/lockers/receipt-download?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(safeFilename)}`;
    
    // Also get public storage URL
    const { data: publicData } = supabaseAdmin.storage
      .from('artworks')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      downloadUrl: attachmentUrl,
      publicUrl: publicData?.publicUrl || attachmentUrl,
      filename: safeFilename
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
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  } catch (err: any) {
    console.error('[receipt-download GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
