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
  notes: 'Default template, used for the 12 known careers (Gemini). Customize as needed.',
};

// Used for custom "Other" careers (routed to OpenAI — no pre-made frame PNG
// exists for an arbitrary typed career, so the prompt asks the model to draw
// its own frame border directly into the image).
const DEFAULT_CUSTOM_TEMPLATE = {
  name: 'Default Custom Career Portrait (OpenAI)',
  isDefaultForCustom: true,
  promptText:
    'A high quality photorealistic portrait of the exact same person from the input photo. ' +
    '{{face_preservation_instruction}} Change their clothing and outfit into: {{job_clothing}}. ' +
    'Change the background and surroundings into: {{job_surroundings}}. Seamless composition, ' +
    'natural lighting, professional photography, crisp focus, 8k resolution, highly detailed. ' +
    "Add a stylish decorative photo-frame border around the entire edge of the image, thematically " +
    "matching the {{job}} career, like a framed portrait card — the frame must sit within the outer " +
    "5-8% margin of the image and must not cover the subject's face.",
  negativePrompt:
    'different face, changed face, altered facial features, distorted eyes, bad anatomy, deformed hands, cartoon, 3d render, anime, illustration, painting, blurry, low resolution, artifacts, watermark, text, signature',
  requestBodyTemplate: null,
  notes: 'Default template for custom "Other" careers (OpenAI path). Customize as needed.',
};

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const count = await prisma.promptTemplate.count();
      if (count === 0) {
        await prisma.promptTemplate.createMany({ data: [DEFAULT_TEMPLATE, DEFAULT_CUSTOM_TEMPLATE] });
      }

      const templates = await prisma.promptTemplate.findMany({
        orderBy: [{ isDefault: 'desc' }, { isDefaultForCustom: 'desc' }, { updatedAt: 'desc' }],
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
      const { name, isDefault, isDefaultForCustom, promptText, negativePrompt, requestBodyTemplate, notes } = body;

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
      if (isDefaultForCustom) {
        await prisma.promptTemplate.updateMany({
          where: { isDefaultForCustom: true },
          data: { isDefaultForCustom: false },
        });
      }

      const template = await prisma.promptTemplate.create({
        data: {
          name: name.trim(),
          isDefault: !!isDefault,
          isDefaultForCustom: !!isDefaultForCustom,
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
