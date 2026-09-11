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

      const data = sessions.map((s) => ({
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
        smsSent: s.smsSent,
        errorMessage: s.errorMessage,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      return NextResponse.json({ data, total, page, limit });
    } catch (error: any) {
      console.error('[API] List submissions error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
