import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';

export const dynamic = 'force-dynamic';

// Booth SessionStatus and mobile ImageProcessingStatus overlap on the
// meaningful states (queued/processing/generated/sms_sent/failed) — booth
// adds a few earlier pre-capture states that also just mean "not ready yet".
function mapSessionStatus(status: string): string {
  if (['created', 'job_selected', 'image_captured', 'queued'].includes(status)) return 'queued';
  return status;
}

export async function GET(req: NextRequest) {
  try {
    const session = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    const [participants, boothSessions] = await Promise.all([
      prisma.participant.findMany({
        where: { phone: session.phone },
        include: { event: true, images: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.session.findMany({
        where: { phone: session.phone },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const mobileSubmissions = participants.flatMap((participant) =>
      participant.images.map((image) => ({
        id: image.id,
        name: participant.name,
        career: participant.career,
        label: `${participant.career} — ${participant.event.name}`,
        originalUrl: image.originalImageUrl ? `/api/download/file/mobile/${image.id}/original` : null,
        aiUrl: image.aiImageUrl ? `/api/download/file/mobile/${image.id}/ai` : null,
        comicBookUrl: participant.event.pdfPath ? `/api/download/file/mobile/${image.id}/comic-book` : null,
        processingStatus: image.processingStatus,
        createdAt: image.createdAt,
      })),
    );

    const activeEvent = boothSessions.length > 0
      ? await prisma.event.findFirst({ where: { isActive: true } })
      : null;

    const boothSubmissions = boothSessions
      .filter((s) => s.originalImagePath || s.generatedImagePath)
      .map((s) => ({
        id: s.id,
        name: s.name,
        career: s.customJob || s.selectedJob || 'Dream Job',
        label: `${s.customJob || s.selectedJob || 'Dream Job'} — Event Booth`,
        originalUrl: s.originalImagePath ? `/api/download/file/booth/${s.id}/original` : null,
        aiUrl: s.generatedImagePath ? `/api/download/file/booth/${s.id}/ai` : null,
        comicBookUrl: activeEvent?.pdfPath ? `/api/download/file/booth/${s.id}/comic-book` : null,
        processingStatus: mapSessionStatus(s.status),
        createdAt: s.createdAt,
      }));

    const submissions = [...mobileSubmissions, ...boothSubmissions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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
