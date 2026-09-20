import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const fromParam = searchParams.get('from');
      const toParam = searchParams.get('to');

      const from = fromParam ? new Date(`${fromParam}T00:00:00.000`) : new Date(0);
      const to = toParam ? new Date(`${toParam}T23:59:59.999`) : new Date();

      // Combines both flows — booth (Session) and mobile (Participant/Image)
      // — into one set of date-wise/status/job breakdowns. Previously this
      // only counted booth sessions, so "date wise analytics" silently
      // missed every mobile QR-experience submission.
      const [sessions, participants] = await Promise.all([
        prisma.session.findMany({ where: { createdAt: { gte: from, lte: to } } }),
        prisma.participant.findMany({
          where: { createdAt: { gte: from, lte: to } },
          include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } },
        }),
      ]);

      const dayMap = new Map<string, number>();
      for (const s of sessions) {
        const day = s.createdAt.toISOString().slice(0, 10);
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      for (const p of participants) {
        const day = p.createdAt.toISOString().slice(0, 10);
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      const dailyCounts = Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

      const statusMap = new Map<string, number>();
      for (const s of sessions) {
        statusMap.set(s.status, (statusMap.get(s.status) || 0) + 1);
      }
      for (const p of participants) {
        const status = p.images[0]?.processingStatus || 'no_image';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      }
      const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

      const jobMap = new Map<string, number>();
      for (const s of sessions) {
        const job = s.customJob || s.selectedJob;
        if (!job) continue;
        jobMap.set(job, (jobMap.get(job) || 0) + 1);
      }
      for (const p of participants) {
        jobMap.set(p.career, (jobMap.get(p.career) || 0) + 1);
      }
      const byJob = Array.from(jobMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([job, count]) => ({ job, count }));

      return NextResponse.json({ dailyCounts, byStatus, byJob });
    } catch (error: any) {
      console.error('[API] Analytics error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
