import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone } from '@/lib/utils';
import { verifyOtp } from '@/lib/sms';
import { createDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { phone, otp } = await req.json();
    if (!phone?.trim() || !otp?.trim()) {
      return NextResponse.json({ message: 'Phone number and code are required' }, { status: 400 });
    }

    const image = await prisma.image.findUnique({
      where: { downloadToken: params.token },
      include: { participant: true },
    });

    if (!image || image.tokenExpiresAt < new Date()) {
      return NextResponse.json({ message: 'This download link is invalid or has expired' }, { status: 404 });
    }

    if (normalizePhone(phone.trim()) !== normalizePhone(image.participant.phone)) {
      return NextResponse.json(
        { message: 'That phone number does not match this download link' },
        { status: 403 },
      );
    }

    const valid = await verifyOtp(image.participant.phone, otp.trim());
    if (!valid) {
      return NextResponse.json({ message: 'Invalid or expired code' }, { status: 401 });
    }

    const sessionToken = createDownloadSessionToken(image.participantId);

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
