import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import {
  createDownloadSessionToken,
  verifyDownloadSessionToken,
  DOWNLOAD_SESSION_COOKIE,
  DOWNLOAD_REMEMBER_COOKIE,
  DOWNLOAD_SESSION_MAX_AGE,
} from '@/lib/download-session';

export const dynamic = 'force-dynamic';

/**
 * Skip the OTP for a browser that has already proved it owns this number.
 *
 * The only thing trusted here is the signed `dl_remember` cookie — the phone
 * in the request body is just a claim, and is accepted solely when it matches
 * the number inside that cookie's own signature. So a visitor who types
 * someone else's number gets a 401 and the normal OTP path, even though their
 * browser holds a perfectly valid cookie for their own number.
 */
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ message: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }

    const remembered = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_REMEMBER_COOKIE)?.value);
    if (!remembered || remembered.phone !== normalizePhone(phone.trim())) {
      return NextResponse.json({ message: 'This browser needs to verify the code' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(DOWNLOAD_SESSION_COOKIE, createDownloadSessionToken(remembered.phone), {
      httpOnly: true,
      path: '/',
      maxAge: DOWNLOAD_SESSION_MAX_AGE,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (error: any) {
    console.error('[API] Resume download session error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
