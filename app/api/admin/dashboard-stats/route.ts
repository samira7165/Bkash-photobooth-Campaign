import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalSessions,
        todaySessions,
        totalGenerations,
        queued,
        processing,
        smsSent,
        failed,
        recent,
        todayBoothGenerations,
        todayMobileGenerations,
        boothComicDownloadAgg,
        mobileComicDownloadAgg,
      ] = await Promise.all([
        prisma.session.count(),
        prisma.session.count({ where: { createdAt: { gte: today } } }),
        prisma.session.count({ where: { status: { in: ['generated', 'sms_sent'] } } }),
        prisma.session.count({ where: { status: 'queued' } }),
        prisma.session.count({ where: { status: 'processing' } }),
        prisma.session.count({ where: { status: 'sms_sent' } }),
        prisma.session.count({ where: { status: 'failed' } }),
        prisma.session.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        // "Today" here means the image actually finished generating today —
        // updatedAt tracks the last status transition, so this counts items
        // that reached generated/sms_sent today, regardless of when the
        // booth session or mobile participant was originally created.
        prisma.session.count({ where: { status: { in: ['generated', 'sms_sent'] }, updatedAt: { gte: today } } }),
        prisma.image.count({ where: { processingStatus: { in: ['generated', 'sms_sent'] }, updatedAt: { gte: today } } }),
        prisma.session.aggregate({ _sum: { comicDownloadCount: true } }),
        prisma.image.aggregate({ _sum: { comicDownloadCount: true } }),
      ]);

      return NextResponse.json({
        totalSessions,
        todaySessions,
        totalGenerations,
        todayGenerations: todayBoothGenerations + todayMobileGenerations,
        totalComicDownloads:
          (boothComicDownloadAgg._sum.comicDownloadCount || 0) + (mobileComicDownloadAgg._sum.comicDownloadCount || 0),
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
          createdAt: s.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('[API] Dashboard stats error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
