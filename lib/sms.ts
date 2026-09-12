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

/** Thrown by sendOtp when a phone is requesting codes too fast — distinct from
 * a genuine SMS gateway failure so callers can surface the real reason
 * (with a 429) instead of a generic "failed to send" message. */
export class OtpRateLimitError extends Error {}

const OTP_MIN_INTERVAL_SECONDS = 60; // minimum gap between requests for the same phone
const OTP_MAX_PER_HOUR = 5; // hard cap even when spaced out, so a number can't be harassed all day

/**
 * OTP support for the download portal and the mobile experience's phone
 * verification step — persists to the `Otp` table and verifies against it
 * (phone + code + not expired + not already used). Both callers request an
 * OTP for a phone number someone else typed in, not necessarily their own,
 * so this throttles per-phone to stop that number being spammed with texts.
 */
export async function sendOtp(phone: string): Promise<void> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.otp.findMany({
    where: { phone, createdAt: { gt: hourAgo } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (recent.length > 0) {
    const secondsSinceLast = (Date.now() - recent[0].createdAt.getTime()) / 1000;
    if (secondsSinceLast < OTP_MIN_INTERVAL_SECONDS) {
      const waitSeconds = Math.ceil(OTP_MIN_INTERVAL_SECONDS - secondsSinceLast);
      throw new OtpRateLimitError(`Please wait ${waitSeconds}s before requesting another code.`);
    }
  }
  if (recent.length >= OTP_MAX_PER_HOUR) {
    throw new OtpRateLimitError('Too many verification code requests for this number. Please try again later.');
  }

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
