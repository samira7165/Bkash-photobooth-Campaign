import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = [
  'created', 'job_selected', 'image_captured', 'queued',
  'processing', 'generated', 'sms_sent', 'failed',
];

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

      const where: any = {};
      if (status && status !== 'all' && VALID_STATUSES.includes(status)) {
        where.status = status;
      }
      if (search?.trim()) {
        where.phone = { contains: search.trim() };
      }

      const [sessions, total] = await Promise.all([
        prisma.session.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.session.count({ where }),
      ]);

      // CouponSubmission has no Prisma relation to Session/Image (it's
      // addressed generically by source+sourceId, the same pairing
      // lib/download-file.ts already uses) — look these up in one extra
      // query rather than N+1 per row.
      const couponSubmissions = sessions.length
        ? await prisma.couponSubmission.findMany({
            where: { source: 'booth', sourceId: { in: sessions.map((s) => s.id) } },
          })
        : [];
      const couponBySessionId = new Map(couponSubmissions.map((c) => [c.sourceId, c]));

      const data = sessions.map((s) => {
        const coupon = couponBySessionId.get(s.id);
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          college: s.college,
          gender: s.gender,
          selectedJob: s.selectedJob,
          customJob: s.customJob,
          status: s.status,
          hasOriginalImage: !!s.originalImagePath,
          hasGeneratedImage: !!s.generatedImagePath,
          downloadCount: s.downloadCount,
          comicDownloadCount: s.comicDownloadCount,
          smsSent: s.smsSent,
          errorMessage: s.errorMessage,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          couponPostUrl: coupon?.postUrl || null,
          couponPhone: coupon?.phone || null,
          couponScreenshotId: coupon?.id || null,
          couponStatus: coupon?.status || null,
        };
      });

      return NextResponse.json({ data, total, page, limit });
    } catch (error: any) {
      console.error('[API] List submissions error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
