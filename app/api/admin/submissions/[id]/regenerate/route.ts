import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const session = await prisma.session.findUnique({ where: { id: params.id } });
      if (!session) {
        return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
      }
      if (session.status !== 'failed') {
        return NextResponse.json({ message: 'Only a failed submission can be regenerated' }, { status: 400 });
      }

      // Hand it back to the queue exactly as if it had just finished the
      // camera step — processNextJob() only ever picks up status "queued".
      const updated = await prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'queued',
          errorMessage: null,
          generatedImagePath: null,
          renderedOriginalPath: null,
          renderedGeneratedPath: null,
          smsSent: false,
          smsAttempts: 0,
          smsLastAttemptAt: null,
        },
      });

      return NextResponse.json(updated);
    } catch (error: any) {
      console.error('[API] Regenerate submission error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
