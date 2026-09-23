import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAdminAuth(req, async () => {
    try {
      const submission = await prisma.couponSubmission.findUnique({ where: { id: params.id } });
      if (!submission || !fs.existsSync(submission.screenshotPath)) {
        return NextResponse.json({ message: 'Screenshot not found' }, { status: 404 });
      }

      const buffer = fs.readFileSync(submission.screenshotPath);
      const ext = path.extname(submission.screenshotPath).toLowerCase();

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': MIME_MAP[ext] || 'image/jpeg',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (error: any) {
      console.error('[API] Serve coupon screenshot error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
