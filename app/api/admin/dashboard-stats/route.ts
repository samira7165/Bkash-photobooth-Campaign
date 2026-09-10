import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalSessions,
        todaySessions,
        activeCampaigns,
        totalGenerations,
        queued,
        processing,
        smsSent,
        failed,
        recent,
      ] = await Promise.all([
        prisma.session.count(),
        prisma.session.count({ where: { createdAt: { gte: today } } }),
        prisma.campaign.count({ where: { isActive: true } }),
        prisma.session.count({ where: { status: { in: ['generated', 'sms_sent'] } } }),
        prisma.session.count({ where: { status: 'queued' } }),
        prisma.session.count({ where: { status: 'processing' } }),
        prisma.session.count({ where: { status: 'sms_sent' } }),
        prisma.session.count({ where: { status: 'failed' } }),
        prisma.session.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { campaign: { select: { id: true, name: true } } },
        }),
      ]);

      return NextResponse.json({
        totalSessions,
        todaySessions,
        activeCampaigns,
        totalGenerations,
        queued,
        processing,
        smsSent,
        failed,
        recent: recent.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          selectedJob: s.selectedJob,
          customJob: s.customJob,
          status: s.status,
          campaign: s.campaign,
          createdAt: s.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('[API] Dashboard stats error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
