import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone, isValidPhone, phoneSearchVariants } from '@/lib/utils';

// Lets the booth flow warn "already used" while the customer is still
// typing their phone number, instead of only after they've filled in the
// rest of the form. Mirrors app/api/participants/check-phone/route.ts for
// the mobile experience's Participant.phone rule.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get('phone');

    if (!isValidPhone(phone)) {
      return NextResponse.json({ alreadyUsed: false });
    }

    const normalizedPhone = normalizePhone(phone.trim());
    const session = await prisma.session.findFirst({
      where: { phone: { in: phoneSearchVariants(normalizedPhone) } },
      select: { id: true },
    });

    return NextResponse.json({ alreadyUsed: !!session });
  } catch (error: any) {
    console.error('[API] Check session phone error:', error.message);
    return NextResponse.json({ alreadyUsed: false });
  }
}
