// Shared across both queue pipelines (booth sessions + mobile participants)
// since they draw on the same AI provider quota (e.g. Gemini: 2 requests per
// minute). This is a strict single-lane, fixed-spacing limiter — at most one
// generation call is ever in flight, and the next one never starts less than
// MIN_INTERVAL_MS after the previous one started, no matter how many
// sessions/participants are queued across both pipelines at once. Correct
// even if an individual call finishes in a second: spacing is measured from
// start-to-start, not end-to-start.

const globalForRateLimit = globalThis as unknown as {
  generationQueueTail?: Promise<void>;
  lastGenerationStartedAt?: number;
};

export const AI_GENERATION_RATE_LIMIT_PER_MINUTE = Math.max(
  1,
  parseInt(process.env.AI_GENERATION_RATE_LIMIT_PER_MINUTE || '2', 10),
);
const MIN_INTERVAL_MS = Math.ceil(60_000 / AI_GENERATION_RATE_LIMIT_PER_MINUTE);

if (globalForRateLimit.generationQueueTail === undefined) {
  globalForRateLimit.generationQueueTail = Promise.resolve();
}

/**
 * Queues `fn` behind every previously-scheduled generation call. Each turn
 * waits out whatever's left of the minimum spacing since the last one
 * started before running, so the whole app never exceeds the provider's
 * rate limit regardless of how many callers are waiting.
 */
export function runRateLimited<T>(fn: () => Promise<T>): Promise<T> {
  // Chain onto the shared tail, but swallow its outcome so one failed
  // generation doesn't wedge every generation queued after it.
  const previousTail = globalForRateLimit.generationQueueTail!.catch(() => {});

  const result = previousTail.then(async () => {
    const wait = Math.max(0, (globalForRateLimit.lastGenerationStartedAt || 0) + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    globalForRateLimit.lastGenerationStartedAt = Date.now();
    return fn();
  });

  globalForRateLimit.generationQueueTail = result.then(() => {}, () => {});
  return result;
}
