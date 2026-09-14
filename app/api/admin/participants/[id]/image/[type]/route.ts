import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

function sanitize(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; type: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const { id, type } = params;

      if (!['original', 'generated'].includes(type)) {
        return NextResponse.json({ message: 'Type must be original or generated' }, { status: 400 });
      }

      const participant = await prisma.participant.findUnique({
        where: { id },
        include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      if (!participant) {
        return NextResponse.json({ message: 'Participant not found' }, { status: 404 });
      }

      const image = participant.images[0];
      const filepath = type === 'original' ? image?.originalImageUrl : image?.aiImageUrl;

      if (!filepath || !fs.existsSync(filepath)) {
        return NextResponse.json({ message: `${type} image not available` }, { status: 404 });
      }

      const buffer = fs.readFileSync(filepath);
      const ext = path.extname(filepath).toLowerCase();
      const headers: Record<string, string> = {
        'Content-Type': MIME_MAP[ext] || 'image/jpeg',
        'Cache-Control': 'private, no-store',
      };

      if (req.nextUrl.searchParams.get('download') === '1') {
        const filename = `mobile_${sanitize(participant.name)}_${sanitize(participant.career)}_${type}${ext || '.jpg'}`;
        headers['Content-Disposition'] = `attachment; filename="${filename}"`;
      }

      return new NextResponse(new Uint8Array(buffer), { headers });
    } catch (error: any) {
      console.error('[API] Serve participant image error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
