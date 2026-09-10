import { generateImage } from './ai-generation';
import { sendSms } from './sms';
import prisma from './db';

// ─── Simple DB-backed queue ───
// No Redis, no Bull — a poller picks up sessions with status "queued"
// from the sessions table and processes them one at a time.

const globalForWorker = globalThis as unknown as {
  workerStarted?: boolean;
  isProcessing?: boolean;
};

export async function processNextJob() {
  if (globalForWorker.isProcessing) return;
  globalForWorker.isProcessing = true;

  try {
    const session = await prisma.session.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });

    if (!session) return;

    console.log(`[Queue] Processing session ${session.id}`);

    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'processing' },
    });

    const selectedJob = session.customJob || session.selectedJob || '';

    try {
      const generatedImagePath = await generateImage({
        originalImagePath: session.originalImagePath!,
        job: selectedJob,
        gender: session.gender,
        name: session.name,
      });

      await prisma.session.update({
        where: { id: session.id },
        data: { generatedImagePath, status: 'generated' },
      });

      const retrievalUrl = `${process.env.RETRIEVAL_URL || 'http://localhost:3000/gallery'}?p=${encodeURIComponent(session.phone)}`;
      const message = `Hi ${session.name}! Your dream job photo as a ${selectedJob} is ready! View: ${retrievalUrl}`;

      try {
        await sendSms(session.phone, message);
        await prisma.session.update({
          where: { id: session.id },
          data: {
            smsSent: true,
            smsShortUrl: retrievalUrl,
            status: 'sms_sent',
          },
        });
        console.log(`[Queue] SMS sent for session ${session.id}`);
      } catch (smsErr: any) {
        console.error(`[Queue] SMS failed: ${smsErr.message}`);
        await prisma.session.update({
          where: { id: session.id },
          data: { smsShortUrl: retrievalUrl, smsSent: false },
        });
      }
    } catch (err: any) {
      console.error(`[Queue] Generation failed: ${err.message}`);
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'failed', errorMessage: err.message },
      });
    }
  } finally {
    globalForWorker.isProcessing = false;
  }
}

export function startWorker() {
  if (globalForWorker.workerStarted) return;
  globalForWorker.workerStarted = true;
  setInterval(processNextJob, 5000);
  console.log('[Queue] Worker started — polling every 5s');
}
