import * as crypto from 'crypto';

// ─── Download-portal session ───
// After OTP verification, the user gets a short-lived, HMAC-signed cookie
// instead of a fifth database table. The signature proves the server issued
// it; the embedded expiry and participantId are re-checked on every request.

const SESSION_TTL_MS = 45 * 60 * 1000; // 45 minutes
export const DOWNLOAD_SESSION_COOKIE = 'dl_session';

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

export function createDownloadSessionToken(phone: string): string {
  const payload: DownloadSessionPayload = {
    phone,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
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
