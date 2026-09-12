import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { verifyOtp } from '@/lib/sms';
import {
  createDownloadSessionToken,
  createDownloadRememberToken,
  DOWNLOAD_SESSION_COOKIE,
  DOWNLOAD_REMEMBER_COOKIE,
  DOWNLOAD_SESSION_MAX_AGE,
  DOWNLOAD_REMEMBER_MAX_AGE,
} from '@/lib/download-session';

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();
    if ((typeof phone !== 'string' || !phone.trim()) || !otp?.trim()) {
      return NextResponse.json({ message: 'Phone number and code are required' }, { status: 400 });
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ message: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone.trim());

    const valid = await verifyOtp(normalizedPhone, otp.trim());
    if (!valid) {
      return NextResponse.json({ message: 'Invalid or expired code' }, { status: 401 });
    }

    const cookieOptions = {
      httpOnly: true,
      path: '/',
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    };

    const res = NextResponse.json({ success: true });
    res.cookies.set(DOWNLOAD_SESSION_COOKIE, createDownloadSessionToken(normalizedPhone), {
      ...cookieOptions,
      maxAge: DOWNLOAD_SESSION_MAX_AGE,
    });
    // Remember this browser so the same person can come back to /download
    // later and skip the OTP. This is what makes registering on the index
    // page carry over — that flow verifies through this very endpoint.
    res.cookies.set(DOWNLOAD_REMEMBER_COOKIE, createDownloadRememberToken(normalizedPhone), {
      ...cookieOptions,
      maxAge: DOWNLOAD_REMEMBER_MAX_AGE,
    });
    return res;
  } catch (error: any) {
    console.error('[API] Verify download OTP error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
