import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    const participants = await prisma.participant.findMany({
      where: { phone: session.phone },
      include: { event: true, images: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    const submissions = participants.flatMap((participant) =>
      participant.images.map((image) => ({
        imageId: image.id,
        eventName: participant.event.name,
        career: participant.career,
        originalUrl: image.originalImageUrl ? `/api/download/file/${image.id}/original` : null,
        aiUrl: image.aiImageUrl ? `/api/download/file/${image.id}/ai` : null,
        comicUrl: image.comicImageUrl ? `/api/download/file/${image.id}/comic` : null,
        pdfUrl: participant.event.pdfPath ? `/api/download/file/${image.id}/pdf` : null,
        processingStatus: image.processingStatus,
        createdAt: image.createdAt,
      })),
    );

    if (submissions.length === 0) {
      return NextResponse.json({ message: 'No photos found for this phone number' }, { status: 404 });
    }

    return NextResponse.json({ submissions });
  } catch (error: any) {
    console.error('[API] Get download gallery error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
