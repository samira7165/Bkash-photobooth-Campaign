import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const events = await prisma.event.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { participants: true } } },
      });

      const data = events.map((e) => ({
        id: e.id,
        name: e.name,
        isActive: e.isActive,
        hasComicBook: !!e.pdfPath,
        participantCount: e._count.participants,
        createdAt: e.createdAt,
      }));

      return NextResponse.json(data);
    } catch (error: any) {
      console.error('[API] List events error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const formData = await req.formData();
      const name = formData.get('name') as string | null;
      const isActive = formData.get('isActive');
      const pdf = formData.get('pdf') as File | null;

      if (!name?.trim()) {
        return NextResponse.json({ message: 'name is required' }, { status: 400 });
      }

      let pdfPath: string | null = null;
      let pdfName: string | null = null;

      if (pdf && pdf.size > 0) {
        const pdfDir = path.join(process.env.UPLOAD_DIR || './uploads', 'event-pdfs');
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
        const filepath = path.join(pdfDir, `${uuidv4()}.pdf`);
        fs.writeFileSync(filepath, Buffer.from(await pdf.arrayBuffer()));
        pdfPath = filepath;
        pdfName = pdf.name;
      }

      const event = await prisma.event.create({
        data: {
          name: name.trim(),
          isActive: isActive === undefined ? true : isActive === 'true',
          pdfPath,
          pdfName,
        },
      });

      return NextResponse.json(event, { status: 201 });
    } catch (error: any) {
      console.error('[API] Create event error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
