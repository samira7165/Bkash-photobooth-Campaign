import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import * as fs from 'fs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const participant = await prisma.participant.findUnique({
        where: { id: params.id },
        include: { images: true },
      });
      if (!participant) {
        return NextResponse.json({ message: 'Participant not found' }, { status: 404 });
      }

      for (const image of participant.images) {
        for (const filePath of [image.originalImageUrl, image.aiImageUrl, image.renderedOriginalPath, image.renderedAiPath]) {
          if (filePath) {
            try {
              fs.unlinkSync(filePath);
            } catch {
              // ignore missing file
            }
          }
        }
      }

      // Images reference the participant via a required foreign key — clear
      // them out first so the parent row can be deleted.
      await prisma.image.deleteMany({ where: { participantId: participant.id } });
      await prisma.participant.delete({ where: { id: participant.id } });

      return NextResponse.json({ success: true, message: 'Participant deleted' });
    } catch (error: any) {
      console.error('[API] Delete participant error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
