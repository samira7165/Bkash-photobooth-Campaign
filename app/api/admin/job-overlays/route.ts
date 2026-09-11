import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

const VALID_JOBS = [
  'Military', 'Painter', 'Scientist', 'Professional Gamer',
  'Doctor', 'Engineer', 'Pilot', 'Journalist',
  'Photographer', 'Lawyer', 'Singer', 'Footballer', 'Other',
];

// Canonical poster size — every overlay is normalized to this on upload so
// every job produces the same final output size, matching the 1200x1800
// crop already applied to captured/uploaded user photos.
const OVERLAY_WIDTH = 1200;
const OVERLAY_HEIGHT = 1800;

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const overlays = await prisma.jobOverlay.findMany({ orderBy: { job: 'asc' } });
      return NextResponse.json(overlays);
    } catch (error: any) {
      console.error('[API] List job overlays error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const formData = await req.formData();
      const job = formData.get('job') as string | null;
      const file = formData.get('file') as File | null;

      if (!job || !VALID_JOBS.includes(job)) {
        return NextResponse.json({ message: 'A valid job is required' }, { status: 400 });
      }
      if (!file || file.size === 0) {
        return NextResponse.json({ message: 'An overlay image file is required' }, { status: 400 });
      }

      const overlayDir = path.join(process.cwd(), 'public', 'overlays');
      if (!fs.existsSync(overlayDir)) fs.mkdirSync(overlayDir, { recursive: true });

      const slug = job.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const filename = `${slug}_${uuidv4()}.png`;
      const filepath = path.join(overlayDir, filename);
      const inputBuffer = Buffer.from(await file.arrayBuffer());

      // Normalize every upload to the canonical poster size (cropping to
      // fit, never stretching) and always re-encode as PNG. This is sent
      // to the AI as a reference image, not composited by code, so it
      // doesn't need to be transparent — it can be a fully opaque design.
      let normalized: Buffer;
      try {
        normalized = await sharp(inputBuffer)
          .resize(OVERLAY_WIDTH, OVERLAY_HEIGHT, { fit: 'cover', position: 'center' })
          .png()
          .toBuffer();
      } catch {
        return NextResponse.json({ message: 'Could not read the uploaded image' }, { status: 400 });
      }

      fs.writeFileSync(filepath, normalized);

      const existing = await prisma.jobOverlay.findUnique({ where: { job } });
      if (existing && fs.existsSync(existing.imagePath)) {
        try { fs.unlinkSync(existing.imagePath); } catch { /* ignore missing file */ }
      }

      const overlay = await prisma.jobOverlay.upsert({
        where: { job },
        create: {
          job,
          imagePath: filepath,
          imageUrl: `/overlays/${filename}`,
          width: OVERLAY_WIDTH,
          height: OVERLAY_HEIGHT,
        },
        update: {
          imagePath: filepath,
          imageUrl: `/overlays/${filename}`,
          width: OVERLAY_WIDTH,
          height: OVERLAY_HEIGHT,
        },
      });

      return NextResponse.json(overlay, { status: 201 });
    } catch (error: any) {
      console.error('[API] Upload job overlay error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
