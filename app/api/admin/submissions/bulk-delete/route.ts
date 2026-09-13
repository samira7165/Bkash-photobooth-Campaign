import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import * as fs from 'fs';

export async function POST(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const { ids } = await req.json();

      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ message: 'ids must be a non-empty array' }, { status: 400 });
      }

      const sessions = await prisma.session.findMany({ where: { id: { in: ids } } });

      let deleted = 0;
      for (const session of sessions) {
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
        await prisma.session.delete({ where: { id: session.id } });
        deleted += 1;
      }

      return NextResponse.json({ success: true, deleted });
    } catch (error: any) {
      console.error('[API] Bulk delete submissions error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
