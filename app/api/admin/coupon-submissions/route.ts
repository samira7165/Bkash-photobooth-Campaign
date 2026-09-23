import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

function toResponseShape(s: {
  id: string;
  source: string;
  sourceId: string;
  name: string;
  phone: string;
  postUrl: string | null;
  status: string;
  couponCode: string | null;
  couponValue: string | null;
  couponExpiry: Date | null;
  rejectionReason: string | null;
  submittedAt: Date;
  verifiedAt: Date | null;
}) {
  return {
    id: s.id,
    source: s.source,
    sourceId: s.sourceId,
    name: s.name,
    phone: s.phone,
    postUrl: s.postUrl,
    status: s.status,
    couponCode: s.couponCode,
    couponValue: s.couponValue,
    couponExpiry: s.couponExpiry ? s.couponExpiry.toISOString() : null,
    rejectionReason: s.rejectionReason,
    submittedAt: s.submittedAt.toISOString(),
    verifiedAt: s.verifiedAt ? s.verifiedAt.toISOString() : null,
  };
}

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

      const where: any = {};
      if (status && status !== 'all' && ['pending', 'approved', 'rejected'].includes(status)) {
        where.status = status;
      }

      const [rows, total] = await Promise.all([
        prisma.couponSubmission.findMany({
          where,
          orderBy: { submittedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.couponSubmission.count({ where }),
      ]);

      return NextResponse.json({ data: rows.map(toResponseShape), total, page, limit });
    } catch (error: any) {
      console.error('[API] List coupon submissions error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
