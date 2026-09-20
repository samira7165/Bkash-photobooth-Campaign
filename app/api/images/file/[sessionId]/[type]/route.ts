import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

// Admin-only: this serves booth photos by session ID alone, with no OTP or
// other proof that the requester is the actual customer — used exclusively
// by the admin Submissions table (thumbnails, preview, lightbox). Customer
// downloads go through the OTP-verified /api/download/file route instead.
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string; type: string } },
) {
  return withAdminAuth(req, async () => {
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
  // No roles restriction — the Submissions table these thumbnails render in
  // is visible to the read-only "client" role too, not just admin.
  });
}
