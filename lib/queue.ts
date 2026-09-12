import { generateImage } from './ai-generation';
import { sendXriSms } from './sms-gateway';
import { processNextParticipantJob, retryPendingParticipantSms } from './participant-queue';
import { renderOriginal, renderBrandedGenerated } from './rendered-photo-cache';
import { runRateLimited } from './generation-rate-limiter';
import type { Session } from '@prisma/client';
import prisma from './db';

// ─── Simple DB-backed queue ───
// No Redis, no Bull — a poller picks up sessions with status "queued" from
// the sessions table and marks them "processing" right away. The actual AI
// call is routed through runRateLimited (lib/generation-rate-limiter.ts),
// which is shared with the participant queue below and enforces the AI
// provider's real rate limit (e.g. 2/minute) — so however many sessions and
// participant images get marked "processing" across both pipelines, the
// provider only ever sees one call at a time, correctly spaced.

const globalForWorker = globalThis as unknown as {
  workerStarted?: boolean;
  isRetryingSms?: boolean;
};

// ─── SMS delivery retry ───
// The result-ready SMS is best-effort at generation time (lib/queue.ts /
// lib/participant-queue.ts). If the gateway is briefly down, the image was
// still generated successfully — we must not let the notification get lost
// just because the first attempt failed. This picks up any "generated" row
// that never got its SMS out and keeps retrying it on a backoff, regardless
// of whether the customer is still on the page.
const SMS_RETRY_BACKOFF_MS = 5 * 60 * 1000; // wait 5 minutes between attempts
const SMS_RETRY_MAX_ATTEMPTS = 10; // ~50 minutes of retrying before giving up

async function processSession(session: Session) {
  console.log(`[Queue] Processing session ${session.id}`);

  const selectedJob = session.customJob || session.selectedJob || '';

  try {
    const generatedImagePath = await runRateLimited(() => generateImage({
      originalImagePath: session.originalImagePath!,
      job: selectedJob,
      gender: session.gender,
      name: session.name,
    }));

    await prisma.session.update({
      where: { id: session.id },
      data: { generatedImagePath, status: 'generated' },
    });

    // Bake the framed/branded copies now, while the queue is processing
    // this session anyway — so the download portal never has to run Sharp
    // on a live request. Non-fatal: if it fails, download-file.ts falls
    // back to rendering (and caching) on first view instead.
    try {
      const [renderedOriginalPath, renderedGeneratedPath] = await Promise.all([
        renderOriginal(session.id, session.originalImagePath!),
        renderBrandedGenerated(session.id, generatedImagePath, selectedJob),
      ]);
      await prisma.session.update({
        where: { id: session.id },
        data: { renderedOriginalPath, renderedGeneratedPath },
      });
    } catch (renderErr: any) {
      console.error(`[Queue] Pre-rendering images failed for session ${session.id} (will render on first view instead): ${renderErr.message}`);
    }

    const downloadLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/download`;
    const message = `Hi ${session.name}! Your dream job photo as a ${selectedJob} is ready. Visit ${downloadLink} and enter your phone number to view and download your image.`;

    try {
      await sendXriSms(session.phone, message);
      await prisma.session.update({
        where: { id: session.id },
        data: {
          smsSent: true,
          smsShortUrl: downloadLink,
          status: 'sms_sent',
        },
      });
      console.log(`[Queue] SMS sent for session ${session.id}`);
    } catch (smsErr: any) {
      console.error(`[Queue] SMS failed (will retry): ${smsErr.message}`);
      await prisma.session.update({
        where: { id: session.id },
        data: {
          smsShortUrl: downloadLink,
          smsSent: false,
          smsAttempts: { increment: 1 },
          smsLastAttemptAt: new Date(),
        },
      });
    }
  } catch (err: any) {
    console.error(`[Queue] Generation failed: ${err.message}`);
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'failed', errorMessage: err.message },
    });
  }
}

export async function processNextJob() {
  const session = await prisma.session.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
  });

  if (!session) return;

  // Marking it "processing" immediately (before its turn in the rate
  // limiter) means the next tick won't pick it up again — so however many
  // sessions/participant images end up queued behind the rate limiter at
  // once, each row is only ever claimed by one processSession call.
  await prisma.session.update({
    where: { id: session.id },
    data: { status: 'processing' },
  });

  await processSession(session);
}

/**
 * Retry the notification SMS for a session whose image was generated but
 * whose SMS never went out — e.g. the gateway was down at the time. Keeps
 * retrying on a backoff up to SMS_RETRY_MAX_ATTEMPTS regardless of what the
 * customer does client-side, since this is pure server-side polling.
 */
export async function retryPendingSessionSms() {
  if (globalForWorker.isRetryingSms) return;
  globalForWorker.isRetryingSms = true;

  try {
    const cutoff = new Date(Date.now() - SMS_RETRY_BACKOFF_MS);
    const session = await prisma.session.findFirst({
      where: {
        status: 'generated',
        smsSent: false,
        smsAttempts: { lt: SMS_RETRY_MAX_ATTEMPTS },
        OR: [{ smsLastAttemptAt: null }, { smsLastAttemptAt: { lt: cutoff } }],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!session) return;

    const selectedJob = session.customJob || session.selectedJob || '';
    const downloadLink = session.smsShortUrl
      || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/download`;
    const message = `Hi ${session.name}! Your dream job photo as a ${selectedJob} is ready. Visit ${downloadLink} and enter your phone number to view and download your image.`;

    console.log(`[Queue] Retrying SMS for session ${session.id} (attempt ${session.smsAttempts + 1})`);

    try {
      await sendXriSms(session.phone, message);
      await prisma.session.update({
        where: { id: session.id },
        data: { smsSent: true, status: 'sms_sent' },
      });
      console.log(`[Queue] SMS retry succeeded for session ${session.id}`);
    } catch (err: any) {
      const attempts = session.smsAttempts + 1;
      console.error(`[Queue] SMS retry ${attempts}/${SMS_RETRY_MAX_ATTEMPTS} failed for session ${session.id}: ${err.message}`);
      await prisma.session.update({
        where: { id: session.id },
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
    globalForWorker.isRetryingSms = false;
  }
}

export function startWorker() {
  if (globalForWorker.workerStarted) return;
  globalForWorker.workerStarted = true;
  setInterval(() => {
    processNextJob().catch((err) => console.error('[Queue] processNextJob crashed:', err.message));
    processNextParticipantJob().catch((err) => console.error('[ParticipantQueue] processNextParticipantJob crashed:', err.message));
    retryPendingSessionSms().catch((err) => console.error('[Queue] retryPendingSessionSms crashed:', err.message));
    retryPendingParticipantSms().catch((err) => console.error('[ParticipantQueue] retryPendingParticipantSms crashed:', err.message));
  }, 5000);
  console.log('[Queue] Worker started — polling every 5s (sessions + participants + SMS retries), generation rate-limited to AI_GENERATION_RATE_LIMIT_PER_MINUTE/min');
}
