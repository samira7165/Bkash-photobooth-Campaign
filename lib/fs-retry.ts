// A file that was just written (e.g. an AI provider's fs.writeFileSync, or
// our own re-encoded output) can briefly fail to open again on Windows —
// commonly real-time antivirus scanning a newly-created file — surfacing
// from Sharp as a generic "unknown error, open <path>". Wrap any read of a
// just-written file in this instead of treating a transient lock as a real
// failure and burning a whole rate-limited generation attempt on it.
//
// Widened twice now: first to 7 attempts doubling from 500ms (~31s worst
// case) — still not enough on at least one Windows dev machine, where the
// exact same file (confirmed byte-valid, not corrupted) stayed unreadable
// for well over a minute with no identifiable antivirus/watcher cause, but
// did open fine a few minutes later. Rather than keep chasing the exact
// Windows-specific mechanism, this waits long enough to ride it out: capped
// exponential backoff up to 30s per step, ~3.5 minutes worst case total.
const MAX_ATTEMPTS = 12;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export async function withFileOpenRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // err.code/errno pin down whether this is really an OS-level lock
      // (EBUSY/EPERM/sharing violation) versus something else entirely
      // (e.g. libvips rejecting malformed/incomplete image bytes, which
      // would surface here too but isn't a lock and won't resolve by
      // waiting) — the plain .message alone doesn't distinguish these.
      console.warn(
        `[fs-retry] ${label} attempt ${attempt + 1}/${MAX_ATTEMPTS} failed: ${err.message} ` +
        `[code=${err.code} errno=${err.errno} syscall=${err.syscall}]`,
      );
      if (attempt < MAX_ATTEMPTS - 1) {
        const delay = Math.min(MAX_DELAY_MS, INITIAL_DELAY_MS * 2 ** attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}
