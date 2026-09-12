import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone, isValidPhone, PHONE_VALIDATION_MESSAGE, phoneSearchVariants } from '@/lib/utils';
import { sendOtp, OtpRateLimitError } from '@/lib/sms';

// Sends an OTP to prove someone controls the phone number BEFORE a
// Participant record is created for it — otherwise anyone could type in a
// stranger's number, and since phone is now globally unique (one picture
// ever per number), that would permanently block the real owner from ever
// participating themselves.
//
// Inverse precondition from /api/download/request-otp: that endpoint sends
// an OTP only if the phone ALREADY has a submission to retrieve; this one
// sends an OTP only if the phone has NOT already participated.
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ message: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone.trim());

    const existing = await prisma.participant.findFirst({
      where: { phone: { in: phoneSearchVariants(normalizedPhone) } },
    });
    if (existing) {
      return NextResponse.json(
        { message: 'This number has already been used to submit a picture. Check your SMS for the link to get your Future Career image.' },
        { status: 409 },
      );
    }

    try {
      await sendOtp(normalizedPhone);
    } catch (smsErr: any) {
      if (smsErr instanceof OtpRateLimitError) {
        return NextResponse.json({ message: smsErr.message }, { status: 429 });
      }
      console.error('[API] Failed to send participant registration OTP:', smsErr.message);
      return NextResponse.json(
        { message: 'Failed to send verification code. Please try again shortly.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Request participant OTP error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
