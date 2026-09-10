import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { sessions: true } } },
    });
    return NextResponse.json(campaigns);
  } catch (error: any) {
    console.error('[API] List campaigns error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, description, logoUrl, brandColor, bgColor, textColor, cardBgColor, fontFamily, isActive } = body;

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ message: 'Name and slug are required' }, { status: 400 });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
        brandColor: brandColor?.trim() || null,
        bgColor: bgColor?.trim() || null,
        textColor: textColor?.trim() || null,
        cardBgColor: cardBgColor?.trim() || null,
        fontFamily: fontFamily?.trim() || null,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ message: 'A campaign with that slug already exists' }, { status: 409 });
    }
    console.error('[API] Create campaign error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
