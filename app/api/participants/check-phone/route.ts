import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone, isValidPhone, phoneSearchVariants } from '@/lib/utils';

// Lets the mobile experience warn "already participated" while the user is
// still typing their phone number on step 1, instead of only after they've
// filled in the rest of the form and picked a career. The rule is global —
// one phone number gets one Participant record ever, across every event —
// so this checks the phone alone, not scoped to any particular event.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get('phone');

    if (!isValidPhone(phone)) {
      return NextResponse.json({ alreadyParticipated: false });
    }

    const normalizedPhone = normalizePhone(phone.trim());
    const participant = await prisma.participant.findFirst({
      where: { phone: { in: phoneSearchVariants(normalizedPhone) } },
      select: { id: true },
    });

    return NextResponse.json({ alreadyParticipated: !!participant });
  } catch (error: any) {
    console.error('[API] Check participant phone error:', error.message);
    return NextResponse.json({ alreadyParticipated: false });
  }
}
