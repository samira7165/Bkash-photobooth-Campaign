import { generateImage } from './ai-generation';
import { sendXriSms } from './sms-gateway';
import { renderOriginal, renderBrandedGenerated } from './rendered-photo-cache';
import type { Image, Participant } from '@prisma/client';
import prisma from './db';

// ─── Mobile QR experience queue ───
// Mirrors lib/queue.ts's Session-polling shape, but against the
// Participant/Image tables that back the mobile QR + download-portal
// journeys. Kept as a separate pipeline (not merged into processNextJob)
// since the two operate on distinct models with distinct SMS text/links.
// generateImage() itself rate-limits and serializes just the network call to
// the AI provider, shared with lib/queue.ts since both draw on the same
// quota — see lib/generation-rate-limiter.ts. Everything else here (local
// file work, DB updates, SMS) can run concurrently across images.

const globalForParticipantWorker = globalThis as unknown as {
  isRetryingParticipantSms?: boolean;
};

const SMS_RETRY_BACKOFF_MS = 5 * 60 * 1000; // wait 5 minutes between attempts
const SMS_RETRY_MAX_ATTEMPTS = 10; // ~50 minutes of retrying before giving up

async function processParticipantImage(image: Image & { participant: Participant }) {
  console.log(`[ParticipantQueue] Processing image ${image.id}`);

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

    // Bake the framed/branded copies now, while the queue is processing
    // this image anyway — so the download portal never has to run Sharp
    // on a live request. Non-fatal: if it fails, download-file.ts falls
    // back to rendering (and caching) on first view instead.
    //
    // The "original" download slot puts the bKash pink card frame around
    // the AI-generated photo (not the raw captured one) — so the user's two
    // downloads are "AI photo + career frame" and "AI photo + bKash frame".
    try {
      const [renderedOriginalPath, renderedAiPath] = await Promise.all([
        renderOriginal(`mobile_${image.id}`, aiImageUrl),
        renderBrandedGenerated(`mobile_${image.id}`, aiImageUrl, participant.career),
      ]);
      await prisma.image.update({
        where: { id: image.id },
        data: { renderedOriginalPath, renderedAiPath },
      });
    } catch (renderErr: any) {
      console.error(`[ParticipantQueue] Pre-rendering images failed for image ${image.id} (will render on first view instead): ${renderErr.message}`);
    }

    const downloadLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/download`;
    const message = `[LIVE Beats] Hi ${participant.name}, your Dream Career image is ready! Download it here:\n${downloadLink}`;

    try {
      await sendXriSms(participant.phone, message);
      await prisma.image.update({
        where: { id: image.id },
        data: { smsSent: true, processingStatus: 'sms_sent' },
      });
      console.log(`[ParticipantQueue] SMS sent for image ${image.id}`);
    } catch (smsErr: any) {
      console.error(`[ParticipantQueue] SMS failed (will retry): ${smsErr.message}`);
      await prisma.image.update({
        where: { id: image.id },
        data: {
          smsSent: false,
          smsAttempts: { increment: 1 },
          smsLastAttemptAt: new Date(),
        },
      });
    }
  } catch (err: any) {
    console.error(`[ParticipantQueue] Generation failed: ${err.message}`);
    await prisma.image.update({
      where: { id: image.id },
      data: { processingStatus: 'failed', errorMessage: err.message },
    });
  }
}

export async function processNextParticipantJob() {
  const image = await prisma.image.findFirst({
    where: { processingStatus: 'queued' },
    orderBy: { createdAt: 'asc' },
    include: { participant: true },
  });

  if (!image) return;

  // Marking it "processing" immediately (before its turn in the rate
  // limiter) means the next tick won't pick it up again — so however many
  // sessions/participant images end up queued behind the rate limiter at
  // once, each row is only ever claimed by one processParticipantImage call.
  await prisma.image.update({
    where: { id: image.id },
    data: { processingStatus: 'processing' },
  });

  await processParticipantImage(image);
}

/**
 * Retry the notification SMS for an image whose generation succeeded but
 * whose SMS never went out. Mirrors retryPendingSessionSms in lib/queue.ts
 * for the mobile QR / Participant pipeline.
 */
export async function retryPendingParticipantSms() {
  if (globalForParticipantWorker.isRetryingParticipantSms) return;
  globalForParticipantWorker.isRetryingParticipantSms = true;

  try {
    const cutoff = new Date(Date.now() - SMS_RETRY_BACKOFF_MS);
    const image = await prisma.image.findFirst({
      where: {
        processingStatus: 'generated',
        smsSent: false,
        smsAttempts: { lt: SMS_RETRY_MAX_ATTEMPTS },
        OR: [{ smsLastAttemptAt: null }, { smsLastAttemptAt: { lt: cutoff } }],
      },
      orderBy: { createdAt: 'asc' },
      include: { participant: true },
    });

    if (!image) return;

    const { participant } = image;
    const downloadLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/download`;
    const message = `[LIVE Beats] Hi ${participant.name}, your Dream Career image is ready! Download it here:\n${downloadLink}`;

    console.log(`[ParticipantQueue] Retrying SMS for image ${image.id} (attempt ${image.smsAttempts + 1})`);

    try {
      await sendXriSms(participant.phone, message);
      await prisma.image.update({
        where: { id: image.id },
        data: { smsSent: true, processingStatus: 'sms_sent' },
      });
      console.log(`[ParticipantQueue] SMS retry succeeded for image ${image.id}`);
    } catch (err: any) {
      const attempts = image.smsAttempts + 1;
      console.error(`[ParticipantQueue] SMS retry ${attempts}/${SMS_RETRY_MAX_ATTEMPTS} failed for image ${image.id}: ${err.message}`);
      await prisma.image.update({
        where: { id: image.id },
        data: {
          smsAttempts: { increment: 1 },
          smsLastAttemptAt: new Date(),
          ...(attempts >= SMS_RETRY_MAX_ATTEMPTS && {
            errorMessage: `SMS delivery failed after ${attempts} attempts: ${err.message}`,
          }),
        },
      });
    }
  } finally {
    globalForParticipantWorker.isRetryingParticipantSms = false;
  }
}
