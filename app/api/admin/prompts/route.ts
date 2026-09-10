import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

const DEFAULT_TEMPLATE = {
  name: 'Default Dream Job Portrait',
  isDefault: true,
  promptText:
    'A professional portrait photo of a young {{genderWord}} working as a {{job}}, wearing the appropriate {{job}} professional uniform and gear, in a realistic professional workplace environment, high quality, ultra detailed, natural studio lighting, sharp focus, 4k resolution, professional photography',
  negativePrompt:
    'blurry, low quality, distorted, deformed, ugly, bad anatomy, bad hands, extra fingers, missing fingers, watermark, text, signature, logo, cartoon, anime, illustration, painting, drawing',
  requestBodyTemplate: null,
  notes: 'Default template. Customize as needed.',
};

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const count = await prisma.promptTemplate.count();
      if (count === 0) {
        await prisma.promptTemplate.create({ data: DEFAULT_TEMPLATE });
      }

      const templates = await prisma.promptTemplate.findMany({
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      });

      return NextResponse.json(templates);
    } catch (error: any) {
      console.error('[API] List prompt templates error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const body = await req.json();
      const { name, isDefault, promptText, negativePrompt, requestBodyTemplate, notes } = body;

      if (!name?.trim() || !promptText?.trim()) {
        return NextResponse.json({ message: 'name and promptText are required' }, { status: 400 });
      }

      if (requestBodyTemplate?.trim()) {
        try {
          JSON.parse(requestBodyTemplate);
        } catch {
          return NextResponse.json({ message: 'requestBodyTemplate must be valid JSON' }, { status: 400 });
        }
      }

      if (isDefault) {
        await prisma.promptTemplate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const template = await prisma.promptTemplate.create({
        data: {
          name: name.trim(),
          isDefault: !!isDefault,
          promptText: promptText.trim(),
          negativePrompt: negativePrompt?.trim() || null,
          requestBodyTemplate: requestBodyTemplate?.trim() || null,
          notes: notes?.trim() || null,
        },
      });

      return NextResponse.json(template, { status: 201 });
    } catch (error: any) {
      console.error('[API] Create prompt template error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
