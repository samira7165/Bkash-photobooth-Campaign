import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const event = await prisma.event.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });

    return NextResponse.json(event);
  } catch (error: any) {
    console.error('[API] Get active event error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
