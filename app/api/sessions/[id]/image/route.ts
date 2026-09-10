import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { startWorker } from '@/lib/queue';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: params.id },
    });

    if (!session) {
      return NextResponse.json({ message: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'job_selected') {
      return NextResponse.json(
        { message: 'Must select a job before capturing image' },
        { status: 400 },
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ message: 'No image provided' }, { status: 400 });
    }

    // Save original image to disk
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const originalDir = path.join(uploadDir, 'original');
    if (!fs.existsSync(originalDir)) {
      fs.mkdirSync(originalDir, { recursive: true });
    }

    const ext = path.extname(file.name) || '.jpg';
    const filename = `${params.id}_${uuidv4()}${ext}`;
    const filepath = path.join(originalDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Update session
    await prisma.session.update({
      where: { id: params.id },
      data: {
        originalImagePath: filepath,
        status: 'queued',
      },
    });

    // Session is now "queued" — the background poller will pick it up
    startWorker();

    const updated = await prisma.session.findUnique({
      where: { id: params.id },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[API] Upload image error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
