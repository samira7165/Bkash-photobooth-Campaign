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

      const data = participants.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        gender: p.gender,
        career: p.career,
        college: p.college,
        eventName: p.event.name,
        processingStatus: p.images[0]?.processingStatus || 'queued',
        downloadCount: p.images[0]?.downloadCount || 0,
        createdAt: p.createdAt,
      }));

      return NextResponse.json({ data, total, page, limit });
    } catch (error: any) {
      console.error('[API] List participants error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
