import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { verifyDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';
import { normalizePhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function sanitize(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

export async function GET(
  req: NextRequest,
  { params }: { params: { imageId: string; type: string } },
) {
  try {
    const { imageId, type } = params;

    if (!['original', 'ai', 'comic', 'pdf'].includes(type)) {
      return NextResponse.json({ message: 'Type must be original, ai, comic, or pdf' }, { status: 400 });
    }

    const image = await prisma.image.findUnique({
      where: { id: imageId },
      include: { participant: { include: { event: true } } },
    });

    if (!image) {
      return NextResponse.json({ message: 'Image not found' }, { status: 404 });
    }

    const session = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
    if (!session || session.phone !== normalizePhone(image.participant.phone)) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    let filepath: string | null;
    if (type === 'original') filepath = image.originalImageUrl;
    else if (type === 'ai') filepath = image.aiImageUrl;
    else if (type === 'comic') filepath = image.comicImageUrl;
    else filepath = image.participant.event.pdfPath;

    if (!filepath || !fs.existsSync(filepath)) {
      return NextResponse.json({ message: `${type} file not available` }, { status: 404 });
    }

    const buffer = fs.readFileSync(filepath);
    const ext = path.extname(filepath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    const forceDownload = req.nextUrl.searchParams.get('download') === '1';
    const headers: Record<string, string> = { 'Content-Type': contentType };

    if (forceDownload) {
      let filename: string;
      if (type === 'pdf') {
        const pdfBase = image.participant.event.pdfName
          ? sanitize(path.parse(image.participant.event.pdfName).name)
          : 'event';
        filename = `${pdfBase}${ext}`;
      } else {
        filename = `dream_career_${sanitize(image.participant.name)}_${sanitize(image.participant.career)}_${type}${ext}`;
      }
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
      await prisma.image.update({
        where: { id: image.id },
        data: { downloadCount: { increment: 1 } },
      });
    } else {
      headers['Cache-Control'] = 'private, max-age=3600';
    }

    return new NextResponse(buffer, { headers });
  } catch (error: any) {
    console.error('[API] Serve download file error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
