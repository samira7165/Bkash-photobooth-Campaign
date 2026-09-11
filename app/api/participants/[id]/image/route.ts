import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { startWorker } from '@/lib/queue';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: params.id },
    });

    if (!participant) {
      return NextResponse.json({ message: 'Participant not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ message: 'No image provided' }, { status: 400 });
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const originalDir = path.join(uploadDir, 'participant-original');
    if (!fs.existsSync(originalDir)) {
      fs.mkdirSync(originalDir, { recursive: true });
    }

    const ext = path.extname(file.name) || '.jpg';
    const filename = `${params.id}_${uuidv4()}${ext}`;
    const filepath = path.join(originalDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    const ttlDays = parseInt(process.env.DOWNLOAD_TOKEN_TTL_DAYS || '30', 10);

    const image = await prisma.image.create({
      data: {
        participantId: params.id,
        originalImageUrl: filepath,
        downloadToken: crypto.randomBytes(32).toString('hex'),
        tokenExpiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        processingStatus: 'queued',
      },
    });

    // Image is now "queued" — the background poller will pick it up
    startWorker();

    return NextResponse.json({ imageId: image.id });
  } catch (error: any) {
    console.error('[API] Upload participant image error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
