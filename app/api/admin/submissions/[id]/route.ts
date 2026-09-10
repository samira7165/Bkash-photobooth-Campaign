import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import * as fs from 'fs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const session = await prisma.session.findUnique({
        where: { id: params.id },
      });

      if (!session) {
        return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
      }

      return NextResponse.json(session);
    } catch (error: any) {
      console.error('[API] Get submission error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const session = await prisma.session.findUnique({ where: { id: params.id } });

      if (!session) {
        return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
      }

      if (session.originalImagePath) {
        try {
          fs.unlinkSync(session.originalImagePath);
        } catch {
          // ignore missing file
        }
      }
      if (session.generatedImagePath) {
        try {
          fs.unlinkSync(session.generatedImagePath);
        } catch {
          // ignore missing file
        }
      }

      await prisma.session.delete({ where: { id: params.id } });

      return NextResponse.json({ success: true, message: 'Submission deleted' });
    } catch (error: any) {
      console.error('[API] Delete submission error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
