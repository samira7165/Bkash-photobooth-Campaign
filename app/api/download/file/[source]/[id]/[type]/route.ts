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
  { params }: { params: { source: string; id: string; type: string } },
) {
  try {
    const { source, id, type } = params;

    if (!['booth', 'mobile'].includes(source)) {
      return NextResponse.json({ message: 'Source must be booth or mobile' }, { status: 400 });
    }
    if (!['original', 'ai', 'comic-book'].includes(type)) {
      return NextResponse.json({ message: 'Type must be original, ai, or comic-book' }, { status: 400 });
    }

    const dlSession = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
    if (!dlSession) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    let filepath: string | null = null;
    let downloadFilenameBase: string;
    let pdfNameForFilename: string | null = null;
    let incrementDownload: () => Promise<void>;

    if (source === 'mobile') {
      const image = await prisma.image.findUnique({
        where: { id },
        include: { participant: { include: { event: true } } },
      });
      if (!image) {
        return NextResponse.json({ message: 'Image not found' }, { status: 404 });
      }
      if (dlSession.phone !== normalizePhone(image.participant.phone)) {
        return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
      }
      if (type === 'original') filepath = image.originalImageUrl;
      else if (type === 'ai') filepath = image.aiImageUrl;
      else filepath = image.participant.event.pdfPath;
      pdfNameForFilename = image.participant.event.pdfName;
      downloadFilenameBase = `dream_career_${sanitize(image.participant.name)}_${sanitize(image.participant.career)}`;
      incrementDownload = async () => {
        await prisma.image.update({ where: { id: image.id }, data: { downloadCount: { increment: 1 } } });
      };
    } else {
      const bSession = await prisma.session.findUnique({ where: { id } });
      if (!bSession) {
        return NextResponse.json({ message: 'Session not found' }, { status: 404 });
      }
      if (dlSession.phone !== normalizePhone(bSession.phone)) {
        return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
      }
      if (type === 'original') filepath = bSession.originalImagePath;
      else if (type === 'ai') filepath = bSession.generatedImagePath;
      else {
        const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
        filepath = activeEvent?.pdfPath || null;
        pdfNameForFilename = activeEvent?.pdfName || null;
      }
      downloadFilenameBase = `dream_job_${sanitize(bSession.name)}_${sanitize(bSession.customJob || bSession.selectedJob || 'job')}`;
      incrementDownload = async () => {
        await prisma.session.update({ where: { id: bSession.id }, data: { downloadCount: { increment: 1 } } });
      };
    }

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
      if (type === 'comic-book') {
        const pdfBase = pdfNameForFilename ? sanitize(path.parse(pdfNameForFilename).name) : 'comic_book';
        filename = `${pdfBase}${ext}`;
      } else {
        filename = `${downloadFilenameBase}_${type}${ext}`;
      }
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
      await incrementDownload();
    } else {
      headers['Cache-Control'] = 'private, max-age=3600';
    }

    return new NextResponse(buffer, { headers });
  } catch (error: any) {
    console.error('[API] Serve download file error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
