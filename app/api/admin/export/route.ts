import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: (string | number)[]): string {
  return fields.map((f) => csvEscape(String(f))).join(',');
}

// One combined export covering both flows — `source` scopes it to just
// Session (booth) or Participant/Image (mobile) rows, and every filter is
// optional so the same endpoint serves "export everything," "export just
// male submissions," "export just mobile submissions," or any combination.
export async function GET(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const source = searchParams.get('source') || 'all'; // all | booth | mobile
      const gender = searchParams.get('gender') || 'all'; // all | male | female
      const status = searchParams.get('status');
      const search = searchParams.get('search')?.trim();
      const eventId = searchParams.get('eventId');
      const career = searchParams.get('career');
      const fromParam = searchParams.get('from');
      const toParam = searchParams.get('to');
      // Day-based filtering — "from" and "to" are plain YYYY-MM-DD dates from
      // the admin's date pickers, expanded to cover the full day in each
      // direction so e.g. from=to=today includes every submission made today.
      const createdAtFilter: { gte?: Date; lte?: Date } = {};
      if (fromParam) createdAtFilter.gte = new Date(`${fromParam}T00:00:00.000`);
      if (toParam) createdAtFilter.lte = new Date(`${toParam}T23:59:59.999`);

      const rows: string[] = [
        toCsvRow([
          'Source', 'Name', 'Phone', 'Gender', 'Job/Career', 'College', 'Event', 'Status', 'Downloads', 'Comic Downloads',
          'Coupon Post Link', 'Coupon bKash Number', 'Coupon Screenshot', 'Created At',
        ]),
      ];
      const screenshotUrl = (couponId: string) => `${req.nextUrl.origin}/api/admin/coupon-submissions/${couponId}/screenshot`;

      if (source === 'all' || source === 'booth') {
        const where: any = {};
        if (gender === 'male' || gender === 'female') where.gender = gender;
        if (status && status !== 'all') where.status = status;
        if (search) where.phone = { contains: search };
        if (createdAtFilter.gte || createdAtFilter.lte) where.createdAt = createdAtFilter;

        const sessions = await prisma.session.findMany({ where, orderBy: { createdAt: 'desc' } });
        const boothCoupons = sessions.length
          ? await prisma.couponSubmission.findMany({ where: { source: 'booth', sourceId: { in: sessions.map((s) => s.id) } } })
          : [];
        const boothCouponBySessionId = new Map(boothCoupons.map((c) => [c.sourceId, c]));
        for (const s of sessions) {
          const coupon = boothCouponBySessionId.get(s.id);
          rows.push(toCsvRow([
            'Booth', s.name, s.phone, s.gender, s.customJob || s.selectedJob || '', s.college || '',
            '', s.status, s.downloadCount, s.comicDownloadCount,
            coupon?.postUrl || '', coupon?.phone || '', coupon ? screenshotUrl(coupon.id) : '',
            s.createdAt.toISOString(),
          ]));
        }
      }

      if (source === 'all' || source === 'mobile') {
        const where: any = {};
        if (gender === 'male' || gender === 'female') where.gender = gender;
        if (eventId && eventId !== 'all') where.eventId = eventId;
        if (career && career !== 'all') where.career = career;
        if (search) where.phone = { contains: search };
        if (createdAtFilter.gte || createdAtFilter.lte) where.createdAt = createdAtFilter;

        const participants = await prisma.participant.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            event: { select: { name: true } },
            images: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        });
        const imageIds = participants.map((p) => p.images[0]?.id).filter((id): id is string => !!id);
        const mobileCoupons = imageIds.length
          ? await prisma.couponSubmission.findMany({ where: { source: 'mobile', sourceId: { in: imageIds } } })
          : [];
        const mobileCouponByImageId = new Map(mobileCoupons.map((c) => [c.sourceId, c]));
        for (const p of participants) {
          const image = p.images[0];
          const coupon = image ? mobileCouponByImageId.get(image.id) : undefined;
          rows.push(toCsvRow([
            'Mobile', p.name, p.phone, p.gender, p.career, p.college || '',
            p.event.name, image?.processingStatus || 'no_image', image?.downloadCount || 0, image?.comicDownloadCount || 0,
            coupon?.postUrl || '', coupon?.phone || '', coupon ? screenshotUrl(coupon.id) : '',
            p.createdAt.toISOString(),
          ]));
        }
      }

      const csv = rows.join('\r\n');
      const dateSuffix = fromParam || toParam
        ? `_${fromParam || 'start'}_to_${toParam || 'now'}`
        : `_${new Date().toISOString().slice(0, 10)}`;
      const filename = `submissions_${source}_${gender}${dateSuffix}.csv`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (error: any) {
      console.error('[API] Export CSV error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
