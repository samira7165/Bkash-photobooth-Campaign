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

      const sessions = await prisma.session.findMany({
        where: { createdAt: { gte: from, lte: to } },
      });

      const dayMap = new Map<string, number>();
      for (const s of sessions) {
        const day = s.createdAt.toISOString().slice(0, 10);
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      const dailyCounts = Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

      const statusMap = new Map<string, number>();
      for (const s of sessions) {
        statusMap.set(s.status, (statusMap.get(s.status) || 0) + 1);
      }
      const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

      const jobMap = new Map<string, number>();
      for (const s of sessions) {
        const job = s.customJob || s.selectedJob;
        if (!job) continue;
        jobMap.set(job, (jobMap.get(job) || 0) + 1);
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
