import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizePhone } from '@/lib/utils';
import { createDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone?.trim()) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone.trim());
    const participant = await prisma.participant.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: 'desc' },
      include: {
        event: true,
        images: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (participant && participant.images[0]) {
      const image = participant.images[0];
      const response = NextResponse.json({
        name: participant.name,
        career: participant.career,
        createdAt: image.createdAt,
        status: image.processingStatus,
        generatedUrl: image.aiImageUrl ? `/api/download/file/${image.id}/ai` : null,
        originalUrl: image.originalImageUrl ? `/api/download/file/${image.id}/original` : null,
        pdfUrl: participant.event.pdfPath ? `/api/download/file/${image.id}/pdf` : null,
      });

      response.cookies.set(DOWNLOAD_SESSION_COOKIE, createDownloadSessionToken(participant.id), {
        httpOnly: true,
        path: '/',
        maxAge: 45 * 60,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      return response;
    }

    const session = await prisma.session.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return NextResponse.json({ message: 'No photos found for this phone number' }, { status: 404 });
    }

    return NextResponse.json({
      name: session.name,
      career: session.customJob || session.selectedJob || 'Dream career',
      createdAt: session.createdAt,
      status: session.status,
      generatedUrl: session.generatedImagePath ? `/api/images/file/${session.id}/generated` : null,
      originalUrl: session.originalImagePath ? `/api/images/file/${session.id}/original` : null,
      pdfUrl: null,
    });
  } catch (error: any) {
    console.error('[API] Download portal search error:', error.message);
    return NextResponse.json({ message: 'Unable to search right now. Please try again.' }, { status: 500 });
  }
}
