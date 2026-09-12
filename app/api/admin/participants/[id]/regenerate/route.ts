import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      // The admin list only surfaces a Participant id (services/api.ts
      // ParticipantRow) — the status/regeneration actually lives on their
      // latest Image row, same one the list reads its processingStatus from.
      const image = await prisma.image.findFirst({
        where: { participantId: params.id },
        orderBy: { createdAt: 'desc' },
      });
      if (!image) {
        return NextResponse.json({ message: 'Participant not found' }, { status: 404 });
      }
      if (image.processingStatus !== 'failed') {
        return NextResponse.json({ message: 'Only a failed image can be regenerated' }, { status: 400 });
      }

      // Hand it back to the queue exactly as if it had just finished
      // uploading — processNextParticipantJob() only ever picks up status
      // "queued".
      const updated = await prisma.image.update({
        where: { id: image.id },
        data: {
          processingStatus: 'queued',
          errorMessage: null,
          aiImageUrl: null,
          renderedOriginalPath: null,
          renderedAiPath: null,
          smsSent: false,
          smsAttempts: 0,
          smsLastAttemptAt: null,
        },
      });

      return NextResponse.json(updated);
    } catch (error: any) {
      console.error('[API] Regenerate participant image error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
