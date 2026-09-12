// A file that was just written (e.g. an AI provider's fs.writeFileSync, or
// our own re-encoded output) can briefly fail to open again on Windows —
// commonly real-time antivirus scanning a newly-created file — surfacing
// from Sharp as a generic "unknown error, open <path>". Wrap any read of a
// just-written file in this instead of treating a transient lock as a real
// failure and burning a whole rate-limited generation attempt on it.
//
// Observed in practice taking longer than a first pass at this allowed for
// (a 4-attempt/~1.8s-total backoff wasn't enough and still failed) — widened
// to 7 attempts doubling from 500ms, ~31s worst case, before giving up.
const MAX_ATTEMPTS = 7;
const INITIAL_DELAY_MS = 500;

export async function withFileOpenRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      console.warn(`[fs-retry] ${label} attempt ${attempt + 1}/${MAX_ATTEMPTS} failed (likely a transient Windows file lock): ${err.message}`);
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, INITIAL_DELAY_MS * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}
