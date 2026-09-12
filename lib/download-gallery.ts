import prisma from '@/lib/db';
import { phoneSearchVariants } from '@/lib/utils';

// Booth SessionStatus and mobile ImageProcessingStatus overlap on the
// meaningful states (queued/processing/generated/sms_sent/failed) — booth
// adds a few earlier pre-capture states that also just mean "not ready yet".
function mapSessionStatus(status: string): string {
  if (['created', 'job_selected', 'image_captured', 'queued'].includes(status)) return 'queued';
  return status;
}

export async function getDownloadSubmissions(phone: string, fileBase = '/api/download/file') {
    const phoneWhere = { phone: { in: phoneSearchVariants(phone) } };
    const [participants, boothSessions] = await Promise.all([
      prisma.participant.findMany({
        where: phoneWhere,
        include: { event: true, images: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.session.findMany({
        where: phoneWhere,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const mobileSubmissions = participants.flatMap((participant) =>
      participant.images.map((image) => ({
        id: image.id,
        name: participant.name,
        career: participant.career,
        label: `${participant.career} — ${participant.event.name}`,
        originalUrl: image.originalImageUrl ? `${fileBase}/mobile/${image.id}/original` : null,
        aiUrl: image.aiImageUrl ? `${fileBase}/mobile/${image.id}/ai` : null,
        comicBookUrl: `${fileBase}/mobile/${image.id}/comic-book`,
        processingStatus: image.processingStatus,
        createdAt: image.createdAt,
      })),
    );

    const boothSubmissions = boothSessions
      .filter((s) => s.originalImagePath || s.generatedImagePath)
      .map((s) => ({
        id: s.id,
        name: s.name,
        career: s.customJob || s.selectedJob || 'Dream Job',
        label: `${s.customJob || s.selectedJob || 'Dream Job'} — Event Booth`,
        originalUrl: s.originalImagePath ? `${fileBase}/booth/${s.id}/original` : null,
        aiUrl: s.generatedImagePath ? `${fileBase}/booth/${s.id}/ai` : null,
        comicBookUrl: `${fileBase}/booth/${s.id}/comic-book`,
        processingStatus: mapSessionStatus(s.status),
        createdAt: s.createdAt,
      }));

    const submissions = [...mobileSubmissions, ...boothSubmissions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return submissions;
}
