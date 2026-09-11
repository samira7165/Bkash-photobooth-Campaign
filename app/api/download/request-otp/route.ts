import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { sendOtp } from '@/lib/sms';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if ((typeof phone !== 'string' || !phone.trim())) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ message: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone.trim());

    const [participant, session] = await Promise.all([
      prisma.participant.findFirst({ where: { phone: normalizedPhone } }),
      prisma.session.findFirst({ where: { phone: normalizedPhone } }),
    ]);

    if (!participant && !session) {
      return NextResponse.json(
        { message: 'No photos found for this phone number. Please check the number and try again.' },
        { status: 404 },
      );
    }

    try {
      await sendOtp(normalizedPhone);
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
