import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { verifyDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';
import { normalizePhone } from '@/lib/utils';
import { renderOriginal, renderBrandedGenerated } from '@/lib/rendered-photo-cache';


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

export async function serveDownloadFile(
  req: NextRequest,
  params: { source: string; id: string; type: string },
  authorizedStaff = false,
) {
  try {
    const { source, id, type } = params;

    if (!['booth', 'mobile'].includes(source)) {
      return NextResponse.json({ message: 'Source must be booth or mobile' }, { status: 400 });
    }
    if (!['original', 'ai', 'comic-book'].includes(type)) {
      return NextResponse.json({ message: 'Type must be original, ai, or comic-book' }, { status: 400 });
    }

    const dlSession = authorizedStaff ? null : verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
    if (!authorizedStaff && !dlSession) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    let filepath: string | null = null;
    let downloadFilenameBase: string;
    let dreamJob: string;
    let pdfNameForFilename: string | null = null;
    let incrementDownload: () => Promise<void>;
    let renderedPath: string | null = null;
    let persistRenderedPath: (renderedPath: string) => Promise<void>;
    const cacheKey = `${source}_${id}`;

    if (source === 'mobile') {
      const image = await prisma.image.findUnique({
        where: { id },
        include: { participant: { include: { event: true } } },
      });
      if (!image) {
        return NextResponse.json({ message: 'Image not found' }, { status: 404 });
      }
      if (!authorizedStaff && dlSession?.phone !== normalizePhone(image.participant.phone)) {
        return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
      }
      // "original" now means the AI-generated photo framed with the bKash
      // pink card (not the raw captured photo) — same source image as "ai",
      // just a different frame — see lib/queue.ts / lib/participant-queue.ts.
      if (type === 'original') { filepath = image.aiImageUrl; renderedPath = image.renderedOriginalPath; }
      else if (type === 'ai') { filepath = image.aiImageUrl; renderedPath = image.renderedAiPath; }
      else {
        // Prefer the PDF uploaded for this participant's event (Admin →
        // Events); fall back to the generic static one if the event never
        // got one uploaded, or its file has gone missing on disk.
        const eventPdfPath = image.participant.event.pdfPath;
        if (eventPdfPath && fs.existsSync(eventPdfPath)) {
          filepath = eventPdfPath;
          pdfNameForFilename = image.participant.event.pdfName || 'Comic.pdf';
        } else {
          filepath = path.join(process.cwd(), 'public', 'documents', 'Comic.pdf');
          pdfNameForFilename = 'Comic.pdf';
        }
      }
      dreamJob = image.participant.career;
      downloadFilenameBase = `dream_career_${sanitize(image.participant.name)}_${sanitize(image.participant.career)}`;
      incrementDownload = async () => {
        await prisma.image.update({
          where: { id: image.id },
          data: {
            downloadCount: { increment: 1 },
            ...(type === 'comic-book' ? { comicDownloadCount: { increment: 1 } } : {}),
          },
        });
      };
      persistRenderedPath = async (p) => {
        const data = type === 'original' ? { renderedOriginalPath: p } : { renderedAiPath: p };
        await prisma.image.update({ where: { id: image.id }, data }).catch(() => {});
      };
    } else {
      const bSession = await prisma.session.findUnique({ where: { id } });
      if (!bSession) {
        return NextResponse.json({ message: 'Session not found' }, { status: 404 });
      }
      if (!authorizedStaff && dlSession?.phone !== normalizePhone(bSession.phone)) {
        return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
      }
      // "original" now means the AI-generated photo framed with the bKash
      // pink card (not the raw captured photo) — same source image as "ai",
      // just a different frame — see lib/queue.ts / lib/participant-queue.ts.
      if (type === 'original') { filepath = bSession.generatedImagePath; renderedPath = bSession.renderedOriginalPath; }
      else if (type === 'ai') { filepath = bSession.generatedImagePath; renderedPath = bSession.renderedGeneratedPath; }
      else {
        // The booth flow has no event of its own (Session isn't tied to an
        // Event the way Participant is), so it uses whichever event is
        // currently active (Admin → Events) — same PDF the mobile QR
        // experience is handing out for that event — falling back to the
        // static default if there's no active event or it has no PDF.
        const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
        if (activeEvent?.pdfPath && fs.existsSync(activeEvent.pdfPath)) {
          filepath = activeEvent.pdfPath;
          pdfNameForFilename = activeEvent.pdfName || 'Comic.pdf';
        } else {
          filepath = path.join(process.cwd(), 'public', 'documents', 'Comic.pdf');
          pdfNameForFilename = 'Comic.pdf';
        }
      }
      downloadFilenameBase = `dream_job_${sanitize(bSession.name)}_${sanitize(bSession.customJob || bSession.selectedJob || 'job')}`;
      dreamJob = bSession.customJob || bSession.selectedJob || '';
      incrementDownload = async () => {
        await prisma.session.update({
          where: { id: bSession.id },
          data: {
            downloadCount: { increment: 1 },
            ...(type === 'comic-book' ? { comicDownloadCount: { increment: 1 } } : {}),
          },
        });
      };
      persistRenderedPath = async (p) => {
        const data = type === 'original' ? { renderedOriginalPath: p } : { renderedGeneratedPath: p };
        await prisma.session.update({ where: { id: bSession.id }, data }).catch(() => {});
      };
    }

    if (!filepath || !fs.existsSync(filepath)) {
      return NextResponse.json({ message: `${type} file not available` }, { status: 404 });
    }

    // The framed/branded copy is normally already baked by the queue right
    // after generation (lib/queue.ts / lib/participant-queue.ts) — this is
    // just the fast path reading that cached file. Only a record generated
    // before that existed, or one whose pre-render failed, falls through to
    // rendering (and caching) it here, on this one request.
    let buffer: Buffer;
    if (type === 'comic-book') {
      buffer = fs.readFileSync(filepath);
    } else if (renderedPath && fs.existsSync(renderedPath)) {
      buffer = fs.readFileSync(renderedPath);
    } else if (type === 'original') {
      const newRenderedPath = await renderOriginal(cacheKey, filepath);
      buffer = fs.readFileSync(newRenderedPath);
      await persistRenderedPath(newRenderedPath);
    } else {
      const newRenderedPath = await renderBrandedGenerated(cacheKey, filepath, dreamJob);
      buffer = fs.readFileSync(newRenderedPath);
      await persistRenderedPath(newRenderedPath);
    }
    const ext = type === 'original' || type === 'ai' ? '.jpg' : path.extname(filepath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    const forceDownload = req.nextUrl.searchParams.get('download') === '1';
    const headers: Record<string, string> = { 'Content-Type': contentType, 'Cache-Control': 'private, no-store' };

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
    }

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error: any) {
    console.error('[API] Serve download file error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
