import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone } from '@/lib/utils';
import { sendOtp } from '@/lib/sms';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { phone } = await req.json();
    if (!phone?.trim()) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
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

    try {
      await sendOtp(image.participant.phone);
    } catch (smsErr: any) {
      console.error('[API] Failed to send download OTP SMS:', smsErr.message);
      return NextResponse.json(
        { message: 'Failed to send verification code. Please try again shortly.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Request download OTP error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
