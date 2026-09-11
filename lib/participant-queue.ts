import { generateImage } from './ai-generation';
import { sendXriSms } from './sms-gateway';
import prisma from './db';

// ─── Mobile QR experience queue ───
// Mirrors lib/queue.ts's Session-polling shape, but against the
// Participant/Image tables that back the mobile QR + download-portal
// journeys. Kept as a separate pipeline (not merged into processNextJob)
// since the two operate on distinct models with distinct SMS text/links.

const globalForParticipantWorker = globalThis as unknown as {
  isProcessingParticipant?: boolean;
};

export async function processNextParticipantJob() {
  if (globalForParticipantWorker.isProcessingParticipant) return;
  globalForParticipantWorker.isProcessingParticipant = true;

  try {
    const image = await prisma.image.findFirst({
      where: { processingStatus: 'queued' },
      orderBy: { createdAt: 'asc' },
      include: { participant: true },
    });

    if (!image) return;

    console.log(`[ParticipantQueue] Processing image ${image.id}`);

    await prisma.image.update({
      where: { id: image.id },
      data: { processingStatus: 'processing' },
    });

    const { participant } = image;

    try {
      const aiImageUrl = await generateImage({
        originalImagePath: image.originalImageUrl!,
        job: participant.career,
        gender: participant.gender,
        name: participant.name,
      });

      await prisma.image.update({
        where: { id: image.id },
        data: { aiImageUrl, processingStatus: 'generated' },
      });

      const downloadLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/download`;
      const message = `Hi ${participant.name}, Your Dream Career image is ready. Visit ${downloadLink} and enter your phone number to view and download your image.`;

      try {
        await sendXriSms(participant.phone, message);
        await prisma.image.update({
          where: { id: image.id },
          data: { smsSent: true, processingStatus: 'sms_sent' },
        });
        console.log(`[ParticipantQueue] SMS sent for image ${image.id}`);
      } catch (smsErr: any) {
        console.error(`[ParticipantQueue] SMS failed: ${smsErr.message}`);
        await prisma.image.update({
          where: { id: image.id },
          data: { smsSent: false },
        });
      }
    } catch (err: any) {
      console.error(`[ParticipantQueue] Generation failed: ${err.message}`);
      await prisma.image.update({
        where: { id: image.id },
        data: { processingStatus: 'failed', errorMessage: err.message },
      });
    }
  } finally {
    globalForParticipantWorker.isProcessingParticipant = false;
  }
}
