import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

function sanitize(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string; type: string } },
) {
  try {
    const { sessionId, type } = params;

    if (!['original', 'generated'].includes(type)) {
      return NextResponse.json({ message: 'Type must be original or generated' }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ message: 'Session not found' }, { status: 404 });
    }

    const filepath =
      type === 'original' ? session.originalImagePath : session.generatedImagePath;

    if (!filepath || !fs.existsSync(filepath)) {
      return NextResponse.json(
        { message: `${type} image not available` },
        { status: 404 },
      );
    }

    const buffer = fs.readFileSync(filepath);
    const ext = path.extname(filepath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    const job = session.selectedJob || session.customJob || 'photo';
    const filename = `photobooth_${sanitize(session.name)}_${sanitize(job)}_${type}${ext || '.jpg'}`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeMap[ext] || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[API] Download image error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
