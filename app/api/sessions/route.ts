import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, gender, campaignId } = body;

    // Validate
    if (!name?.trim()) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }
    if (!['male', 'female'].includes(gender)) {
      return NextResponse.json({ message: 'Gender must be male or female' }, { status: 400 });
    }

    const session = await prisma.session.create({
      data: {
        name: name.trim(),
        phone: normalizePhone(phone.trim()),
        email: email?.trim() || null,
        gender,
        campaignId: campaignId?.trim() || null,
        status: 'created',
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    console.error('[API] Create session error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
