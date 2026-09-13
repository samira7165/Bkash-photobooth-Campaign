import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async (req) => {
    try {
      const existing = await prisma.event.findUnique({ where: { id: params.id } });
      if (!existing) {
        return NextResponse.json({ message: 'Event not found' }, { status: 404 });
      }

      const formData = await req.formData();
      const name = formData.get('name') as string | null;
      const isActive = formData.get('isActive');
      const pdf = formData.get('pdf') as File | null;

      let pdfPath = existing.pdfPath;
      let pdfName = existing.pdfName;

      if (pdf && pdf.size > 0) {
        const pdfDir = path.join(process.env.UPLOAD_DIR || './uploads', 'event-pdfs');
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
        const filepath = path.join(pdfDir, `${uuidv4()}.pdf`);
        fs.writeFileSync(filepath, Buffer.from(await pdf.arrayBuffer()));
        if (existing.pdfPath && fs.existsSync(existing.pdfPath)) {
          try { fs.unlinkSync(existing.pdfPath); } catch { /* ignore missing file */ }
        }
        pdfPath = filepath;
        pdfName = pdf.name;
      }

      const updated = await prisma.event.update({
        where: { id: params.id },
        data: {
          ...(name?.trim() && { name: name.trim() }),
          ...(isActive !== null && { isActive: isActive === 'true' }),
          pdfPath,
          pdfName,
        },
      });

      return NextResponse.json(updated);
    } catch (error: any) {
      console.error('[API] Update event error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
