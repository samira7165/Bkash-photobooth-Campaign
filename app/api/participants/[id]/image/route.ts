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
    const participant = await prisma.participant.findUnique({
      where: { id: params.id },
    });

    if (!participant) {
      return NextResponse.json({ message: 'Participant not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File;
    const clientRequestId = formData.get('clientRequestId') as string | null;

    if (!file) {
      return NextResponse.json({ message: 'No image provided' }, { status: 400 });
    }

    // A client-side retry (e.g. the first attempt's response was lost to a
    // network drop but actually reached the server) reuses the same request
    // id — return the image already created for it instead of making a
    // duplicate, which would otherwise mean two generations and two SMS.
    if (clientRequestId) {
      const existing = await prisma.image.findUnique({ where: { clientRequestId } });
      if (existing) {
        return NextResponse.json({ imageId: existing.id });
      }
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

    const image = await prisma.image.create({
      data: {
        participantId: params.id,
        originalImageUrl: filepath,
        processingStatus: 'queued',
        clientRequestId: clientRequestId || undefined,
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
