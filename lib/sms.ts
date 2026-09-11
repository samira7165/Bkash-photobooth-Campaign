import axios from 'axios';
import * as crypto from 'crypto';
import prisma from './db';
import { sendXriSms } from './sms-gateway';
import {
  getNextSmsProvider,
  markSmsProviderFailed,
  markSmsProviderSuccess,
} from './provider-manager';

/**
 * Send an SMS message.
 *
 * Tries SMS providers (stored in the DB) in priority order, falling
 * back to the next one on failure. Falls back to SMS_API_URL/SMS_API_KEY
 * in .env if no providers are configured, and to demo mode (just logs)
 * if neither is set up.
 */
export async function sendSms(phone: string, message: string): Promise<boolean> {
  const maxAttempts = 3;
  let lastError = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const provider = await getNextSmsProvider();

    if (!provider) {
      // No providers configured — fall back to .env values
      const envUrl = process.env.SMS_API_URL;
      const envKey = process.env.SMS_API_KEY;
      if (!envUrl || !envKey) {
        // Demo mode — just log
        console.warn(`[SMS DEMO] To ${phone}: ${message}`);
        return true;
      }
      try {
        await callSmsApi(envUrl, envKey, process.env.SMS_SENDER_ID || 'PHOTOBOOTH', phone, message);
        return true;
      } catch (err: any) {
        throw new Error(`All SMS providers failed: ${err.message}`);
      }
    }

    try {
      console.log(`[SMS] Trying provider: ${provider.name} (priority ${provider.priority})`);
      await callSmsApi(provider.apiUrl, provider.apiKey, provider.senderId || 'PHOTOBOOTH', phone, message);
      await markSmsProviderSuccess(provider.id);
      return true;
    } catch (err: any) {
      lastError = err.message;
      console.error(`[SMS] Provider ${provider.name} failed: ${lastError}`);
      await markSmsProviderFailed(provider.id, lastError);
      // Loop continues to next provider
    }
  }

  throw new Error(`All SMS providers failed. Last: ${lastError}`);
}

async function callSmsApi(
  apiUrl: string,
  apiKey: string,
  senderId: string,
  phone: string,
  message: string,
): Promise<void> {
  await axios.post(apiUrl, {
    api_key: apiKey,
    sender_id: senderId,
    contacts: phone,
    msg: message,
    type: 'text',
  });
}

/**
 * OTP support for the download portal — persists to the `Otp` table and
 * verifies against it (phone + code + not expired + not already used).
 */
export async function sendOtp(phone: string): Promise<void> {
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const ttlMinutes = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);

  // Invalidate any previously-issued, still-unverified codes for this phone
  // so only the newest one can ever be verified.
  await prisma.otp.updateMany({
    where: { phone, verified: false },
    data: { expiresAt: new Date(0) },
  });

  await prisma.otp.create({
    data: {
      phone,
      otpCode,
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });

  await sendXriSms(phone, `Your verification code is: ${otpCode}. It expires in ${ttlMinutes} minutes.`);
}

export async function verifyOtp(phone: string, otpCode: string): Promise<boolean> {
  const record = await prisma.otp.findFirst({
    where: { phone, otpCode, verified: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return false;

  await prisma.otp.update({
    where: { id: record.id },
    data: { verified: true },
  });

  return true;
}
