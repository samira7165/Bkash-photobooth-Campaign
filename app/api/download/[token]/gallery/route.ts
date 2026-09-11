import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const image = await prisma.image.findUnique({
      where: { downloadToken: params.token },
      include: { participant: { include: { event: true } } },
    });

    if (!image || image.tokenExpiresAt < new Date()) {
      return NextResponse.json({ message: 'This download link is invalid or has expired' }, { status: 404 });
    }

    const session = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
    if (!session || session.participantId !== image.participantId) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    return NextResponse.json({
      originalUrl: image.originalImageUrl ? `/api/download/file/${image.id}/original` : null,
      aiUrl: image.aiImageUrl ? `/api/download/file/${image.id}/ai` : null,
      comicUrl: image.comicImageUrl ? `/api/download/file/${image.id}/comic` : null,
      pdfUrl: image.participant.event.pdfPath ? `/api/download/file/${image.id}/pdf` : null,
      processingStatus: image.processingStatus,
    });
  } catch (error: any) {
    console.error('[API] Get download gallery error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
