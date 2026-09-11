import axios from 'axios';

/**
 * XRI SMS Gateway client — the user's real, whitelisted SMS provider.
 * Server-only (needs to set a real Origin header, which browsers won't
 * allow scripts to override — this must run on the server).
 *
 * Contract:
 *   POST {XRI_SMS_API_URL}  { phone, message? }
 *   -> { success: true, message: "OTP sent successfully" }
 *   -> { success: false, message: "Unauthorized: your IP or website is not whitelisted." }
 */
export async function sendXriSms(phone: string, message: string): Promise<void> {
  const url = process.env.XRI_SMS_API_URL;
  if (!url) {
    throw new Error('XRI_SMS_API_URL is not configured');
  }

  const res = await axios.post(
    url,
    { phone, message },
    {
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      },
      timeout: 15_000,
      validateStatus: () => true, // handle non-2xx ourselves so we can read the real error message
    },
  );

  const ok = res.data?.success ?? res.data?.status;
  if (!ok) {
    throw new Error(res.data?.message || `XRI SMS gateway rejected the request (HTTP ${res.status})`);
  }
}
