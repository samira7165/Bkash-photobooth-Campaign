import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const image = await prisma.image.findUnique({
      where: { downloadToken: params.token },
    });

    if (!image || image.tokenExpiresAt < new Date()) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error('[API] Resolve download token error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
