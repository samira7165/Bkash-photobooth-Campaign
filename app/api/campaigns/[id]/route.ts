import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: { _count: { select: { sessions: true } } },
    });

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error: any) {
    console.error('[API] Get campaign error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const { name, slug, description, logoUrl, brandColor, bgColor, textColor, cardBgColor, fontFamily, isActive } = body;

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ message: 'Name cannot be empty' }, { status: 400 });
    }
    if (slug !== undefined && !slug.trim()) {
      return NextResponse.json({ message: 'Slug cannot be empty' }, { status: 400 });
    }

    const campaign = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(slug !== undefined && { slug: slug.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl?.trim() || null }),
        ...(brandColor !== undefined && { brandColor: brandColor?.trim() || null }),
        ...(bgColor !== undefined && { bgColor: bgColor?.trim() || null }),
        ...(textColor !== undefined && { textColor: textColor?.trim() || null }),
        ...(cardBgColor !== undefined && { cardBgColor: cardBgColor?.trim() || null }),
        ...(fontFamily !== undefined && { fontFamily: fontFamily?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { _count: { select: { sessions: true } } },
    });

    return NextResponse.json(campaign);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ message: 'A campaign with that slug already exists' }, { status: 409 });
    }
    console.error('[API] Update campaign error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.campaign.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Campaign deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }
    console.error('[API] Delete campaign error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
