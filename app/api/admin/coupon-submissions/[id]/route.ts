import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import * as fs from 'fs';

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAdminAuth(req, async () => {
    try {
      const submission = await prisma.couponSubmission.findUnique({ where: { id: params.id } });
      if (!submission) {
        return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
      }

      const body = await req.json();
      const { action } = body;

      if (action === 'approve') {
        const couponCode = (body.couponCode as string | undefined)?.trim();
        const couponValue = (body.couponValue as string | undefined)?.trim();
        const couponExpiry = body.couponExpiry as string | undefined;
        if (!couponCode || !couponValue || !couponExpiry) {
          return NextResponse.json(
            { message: 'couponCode, couponValue, and couponExpiry are required to approve' },
            { status: 400 },
          );
        }
        const expiryDate = new Date(couponExpiry);
        if (Number.isNaN(expiryDate.getTime())) {
          return NextResponse.json({ message: 'couponExpiry must be a valid date' }, { status: 400 });
        }

        const updated = await prisma.couponSubmission.update({
          where: { id: params.id },
          data: {
            status: 'approved',
            couponCode,
            couponValue,
            couponExpiry: expiryDate,
            rejectionReason: null,
            verifiedAt: new Date(),
          },
        });
        return NextResponse.json(toResponseShape(updated));
      }

      if (action === 'reject') {
        const rejectionReason = (body.rejectionReason as string | undefined)?.trim() || null;
        const updated = await prisma.couponSubmission.update({
          where: { id: params.id },
          data: {
            status: 'rejected',
            rejectionReason,
            couponCode: null,
            couponValue: null,
            couponExpiry: null,
            verifiedAt: new Date(),
          },
        });
        return NextResponse.json(toResponseShape(updated));
      }

      return NextResponse.json({ message: 'action must be "approve" or "reject"' }, { status: 400 });
    } catch (error: any) {
      console.error('[API] Update coupon submission error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withAdminAuth(req, async () => {
    try {
      const submission = await prisma.couponSubmission.findUnique({ where: { id: params.id } });
      if (!submission) {
        return NextResponse.json({ message: 'Submission not found' }, { status: 404 });
      }

      if (submission.screenshotPath) {
        try {
          fs.unlinkSync(submission.screenshotPath);
        } catch {
          // best-effort — file may already be gone
        }
      }
      await prisma.couponSubmission.delete({ where: { id: params.id } });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error('[API] Delete coupon submission error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
