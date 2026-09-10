import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

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
      type === 'original'
        ? session.originalImagePath
        : session.generatedImagePath;

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

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeMap[ext] || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('[API] Serve image error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
