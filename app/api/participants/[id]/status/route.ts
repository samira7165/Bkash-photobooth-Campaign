import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const image = await prisma.image.findFirst({
      where: { participantId: params.id },
      orderBy: { createdAt: 'desc' },
      select: { processingStatus: true, errorMessage: true },
    });

    if (!image) {
      return NextResponse.json({ message: 'No image found for this participant' }, { status: 404 });
    }

    return NextResponse.json(image);
  } catch (error: any) {
    console.error('[API] Get participant status error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
