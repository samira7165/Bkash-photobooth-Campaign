import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { job: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const job = decodeURIComponent(params.job);
      const existing = await prisma.jobOverlay.findUnique({ where: { job } });
      if (!existing) {
        return NextResponse.json({ message: 'Overlay not found' }, { status: 404 });
      }

      if (fs.existsSync(existing.imagePath)) {
        try { fs.unlinkSync(existing.imagePath); } catch { /* ignore missing file */ }
      }

      await prisma.jobOverlay.delete({ where: { job } });

      return NextResponse.json({ success: true, message: 'Overlay deleted' });
    } catch (error: any) {
      console.error('[API] Delete job overlay error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
