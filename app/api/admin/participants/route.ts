import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const eventId = searchParams.get('eventId');
      const gender = searchParams.get('gender');
      const career = searchParams.get('career');
      const search = searchParams.get('search');
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

      const where: any = {};
      if (eventId && eventId !== 'all') where.eventId = eventId;
      if (gender && gender !== 'all' && ['male', 'female'].includes(gender)) where.gender = gender;
      if (career && career !== 'all') where.career = career;
      if (search?.trim()) where.phone = { contains: search.trim() };

      const [participants, total] = await Promise.all([
        prisma.participant.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            event: { select: { name: true } },
            images: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        }),
        prisma.participant.count({ where }),
      ]);

      // CouponSubmission has no Prisma relation to Session/Image (it's
      // addressed generically by source+sourceId, the same pairing
      // lib/download-file.ts already uses) — look these up in one extra
      // query rather than N+1 per row. sourceId for mobile is the Image id.
      const imageIds = participants.map((p) => p.images[0]?.id).filter((id): id is string => !!id);
      const couponSubmissions = imageIds.length
        ? await prisma.couponSubmission.findMany({ where: { source: 'mobile', sourceId: { in: imageIds } } })
        : [];
      const couponByImageId = new Map(couponSubmissions.map((c) => [c.sourceId, c]));

      const data = participants.map((p) => {
        const imageId = p.images[0]?.id;
        const coupon = imageId ? couponByImageId.get(imageId) : undefined;
        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          gender: p.gender,
          career: p.career,
          college: p.college,
          eventName: p.event.name,
          // A participant with no Image row at all never had a photo reach
          // the server (dropped connection, closed the app, etc.) — distinct
          // from "queued", which means a real job is genuinely waiting on the
          // worker. Reusing "queued" for both made a stalled real job
          // indistinguishable from someone who just never uploaded anything.
          processingStatus: p.images[0]?.processingStatus || 'no_image',
          downloadCount: p.images[0]?.downloadCount || 0,
          comicDownloadCount: p.images[0]?.comicDownloadCount || 0,
          hasOriginalImage: !!p.images[0]?.originalImageUrl,
          hasGeneratedImage: !!p.images[0]?.aiImageUrl,
          createdAt: p.createdAt,
          couponPostUrl: coupon?.postUrl || null,
          couponPhone: coupon?.phone || null,
          couponScreenshotId: coupon?.id || null,
          couponStatus: coupon?.status || null,
        };
      });

      return NextResponse.json({ data, total, page, limit });
    } catch (error: any) {
      console.error('[API] List participants error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
