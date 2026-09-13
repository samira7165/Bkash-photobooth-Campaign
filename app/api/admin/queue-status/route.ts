import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const [queued, processing, generated, smsSent, failed, total] = await Promise.all([
        prisma.session.count({ where: { status: 'queued' } }),
        prisma.session.count({ where: { status: 'processing' } }),
        prisma.session.count({ where: { status: 'generated' } }),
        prisma.session.count({ where: { status: 'sms_sent' } }),
        prisma.session.count({ where: { status: 'failed' } }),
        prisma.session.count(),
      ]);

      return NextResponse.json({ queued, processing, generated, smsSent, failed, total });
    } catch (error: any) {
      console.error('[API] Queue status error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
