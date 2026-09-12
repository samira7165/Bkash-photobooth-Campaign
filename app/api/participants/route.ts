import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { verifyDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';

const VALID_CAREERS = [
  'Military', 'Painter', 'Scientist', 'Professional Gamer',
  'Doctor', 'Engineer', 'Pilot', 'Journalist',
  'Photographer', 'Lawyer', 'Singer', 'Footballer', 'Other',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, college, gender, career, customCareer, eventId } = body;

    if (!name?.trim()) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }
    if ((typeof phone !== 'string' || !phone.trim())) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ message: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone.trim());

    // Requires the OTP verification step (ExperienceVerifyPhone /
    // /api/download/verify-otp) to have already proven this browser controls
    // this exact phone number — otherwise anyone could submit someone else's
    // number, and since phone is now globally unique, that would permanently
    // lock the real owner out of ever participating.
    const dlSession = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
    if (dlSession?.phone !== normalizedPhone) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    if (!['male', 'female'].includes(gender)) {
      return NextResponse.json({ message: 'Gender must be male or female' }, { status: 400 });
    }
    if (!career || !VALID_CAREERS.includes(career)) {
      return NextResponse.json({ message: 'A valid career must be selected' }, { status: 400 });
    }
    if (career === 'Other' && !customCareer?.trim()) {
      return NextResponse.json({ message: 'Custom career is required when selecting Other' }, { status: 400 });
    }
    if (!eventId?.trim()) {
      return NextResponse.json({ message: 'eventId is required' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || !event.isActive) {
      return NextResponse.json({ message: 'This event is not currently active' }, { status: 400 });
    }

    const participant = await prisma.participant.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        email: email?.trim() || null,
        college: college?.trim() || null,
        gender,
        career: career === 'Other' ? customCareer.trim() : career,
        eventId,
      },
    });

    return NextResponse.json({ participantId: participant.id }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { message: 'You have already participated. Please check your SMS for your image.' },
        { status: 409 },
      );
    }
    console.error('[API] Create participant error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
