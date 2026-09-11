import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { verifyOtp } from '@/lib/sms';
import { createDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';

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

    const sessionToken = createDownloadSessionToken(normalizedPhone);

    const res = NextResponse.json({ success: true });
    res.cookies.set(DOWNLOAD_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      path: '/',
      maxAge: 45 * 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (error: any) {
    console.error('[API] Verify download OTP error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
