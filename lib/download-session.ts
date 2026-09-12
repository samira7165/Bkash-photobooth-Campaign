import * as crypto from 'crypto';

// ─── Download-portal session ───
// After OTP verification, the user gets a short-lived, HMAC-signed cookie
// instead of a fifth database table. The signature proves the server issued
// it; the embedded expiry and participantId are re-checked on every request.

const SESSION_TTL_MS = 45 * 60 * 1000; // 45 minutes
// The "remember this browser" credential. Same signed-token scheme, just a far
// longer life: it lets someone who already proved they own this number (when
// registering, or on a previous visit) reach their gallery without another OTP.
// It is never accepted in place of a session — it only mints a fresh one, and
// only for the exact phone number embedded in its own signature.
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const DOWNLOAD_SESSION_COOKIE = 'dl_session';
export const DOWNLOAD_REMEMBER_COOKIE = 'dl_remember';

/** Cookie max-age values in seconds, so routes don't restate the TTLs. */
export const DOWNLOAD_SESSION_MAX_AGE = SESSION_TTL_MS / 1000;
export const DOWNLOAD_REMEMBER_MAX_AGE = REMEMBER_TTL_MS / 1000;

interface DownloadSessionPayload {
  phone: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.DOWNLOAD_SESSION_SECRET;
  if (!secret) {
    throw new Error('DOWNLOAD_SESSION_SECRET is not configured');
  }
  return secret;
}

function sign(payloadB64: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('hex');
}

function createToken(phone: string, ttlMs: number): string {
  const payload: DownloadSessionPayload = {
    phone,
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function createDownloadSessionToken(phone: string): string {
  return createToken(phone, SESSION_TTL_MS);
}

export function createDownloadRememberToken(phone: string): string {
  return createToken(phone, REMEMBER_TTL_MS);
}

export function verifyDownloadSessionToken(token: string | undefined | null): DownloadSessionPayload | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return null;

  const expectedSignature = sign(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload: DownloadSessionPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
