import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: params.id },
    });

    if (!session) {
      return NextResponse.json({ message: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('[API] Get session error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
