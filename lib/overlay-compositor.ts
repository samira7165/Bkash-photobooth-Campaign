import prisma from './db';
import type { JobOverlay } from '@prisma/client';

/**
 * Looks up the reference poster for a job by exact name (covers the 12
 * presets), falling back to the shared 'Other' row for any custom job
 * title that doesn't have its own upload. Sent to the AI alongside the
 * user's photo as a reference to preserve exactly — see
 * lib/ai-generation.ts's buildReferencePosterPrompt.
 */
export async function findOverlayForJob(job: string): Promise<JobOverlay | null> {
  const exact = await prisma.jobOverlay.findFirst({ where: { job } });
  if (exact) return exact;
  return prisma.jobOverlay.findFirst({ where: { job: 'Other' } });
}
