import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    const sessions = await prisma.session.findMany({
      where: { phone: normalized },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        selectedJob: true,
        customJob: true,
        status: true,
        createdAt: true,
        originalImagePath: true,
        generatedImagePath: true,
      },
    });

    if (!sessions.length) {
      return NextResponse.json(
        { message: 'No images found for this phone number' },
        { status: 404 },
      );
    }

    // Map to safe response with image URLs (not raw paths)
    const results = sessions.map((s) => ({
      id: s.id,
      name: s.name,
      selectedJob: s.customJob || s.selectedJob,
      originalImage: s.originalImagePath
        ? `/api/images/file/${s.id}/original`
        : null,
      generatedImage: s.generatedImagePath
        ? `/api/images/file/${s.id}/generated`
        : null,
      status: s.status,
      createdAt: s.createdAt,
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[API] Search by phone error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
