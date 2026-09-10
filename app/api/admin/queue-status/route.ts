import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const campaignId = searchParams.get('campaignId');

      const where: any = {};
      if (campaignId && campaignId !== 'all') {
        where.campaignId = campaignId;
      }

      const [queued, processing, generated, smsSent, failed, total] = await Promise.all([
        prisma.session.count({ where: { ...where, status: 'queued' } }),
        prisma.session.count({ where: { ...where, status: 'processing' } }),
        prisma.session.count({ where: { ...where, status: 'generated' } }),
        prisma.session.count({ where: { ...where, status: 'sms_sent' } }),
        prisma.session.count({ where: { ...where, status: 'failed' } }),
        prisma.session.count({ where }),
      ]);

      return NextResponse.json({ queued, processing, generated, smsSent, failed, total });
    } catch (error: any) {
      console.error('[API] Queue status error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
