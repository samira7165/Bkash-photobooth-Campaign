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

      const rows: string[] = [
        toCsvRow(['Source', 'Name', 'Phone', 'Gender', 'Job/Career', 'College', 'Event', 'Status', 'Downloads', 'Created At']),
      ];

      if (source === 'all' || source === 'booth') {
        const where: any = {};
        if (gender === 'male' || gender === 'female') where.gender = gender;
        if (status && status !== 'all') where.status = status;
        if (search) where.phone = { contains: search };

        const sessions = await prisma.session.findMany({ where, orderBy: { createdAt: 'desc' } });
        for (const s of sessions) {
          rows.push(toCsvRow([
            'Booth', s.name, s.phone, s.gender, s.customJob || s.selectedJob || '', s.college || '',
            '', s.status, s.downloadCount, s.createdAt.toISOString(),
          ]));
        }
      }

      if (source === 'all' || source === 'mobile') {
        const where: any = {};
        if (gender === 'male' || gender === 'female') where.gender = gender;
        if (eventId && eventId !== 'all') where.eventId = eventId;
        if (career && career !== 'all') where.career = career;
        if (search) where.phone = { contains: search };

        const participants = await prisma.participant.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            event: { select: { name: true } },
            images: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        });
        for (const p of participants) {
          const image = p.images[0];
          rows.push(toCsvRow([
            'Mobile', p.name, p.phone, p.gender, p.career, p.college || '',
            p.event.name, image?.processingStatus || 'queued', image?.downloadCount || 0, p.createdAt.toISOString(),
          ]));
        }
      }

      const csv = rows.join('\r\n');
      const filename = `submissions_${source}_${gender}_${new Date().toISOString().slice(0, 10)}.csv`;

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
