import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const template = await prisma.promptTemplate.findUnique({
        where: { id: params.id },
      });

      if (!template) {
        return NextResponse.json({ message: 'Template not found' }, { status: 404 });
      }

      return NextResponse.json(template);
    } catch (error: any) {
      console.error('[API] Get prompt template error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async (req) => {
    try {
      const body = await req.json();
      const { name, isDefault, isDefaultForCustom, promptText, negativePrompt, requestBodyTemplate, notes } = body;

      if (name !== undefined && !name.trim()) {
        return NextResponse.json({ message: 'name cannot be empty' }, { status: 400 });
      }
      if (promptText !== undefined && !promptText.trim()) {
        return NextResponse.json({ message: 'promptText cannot be empty' }, { status: 400 });
      }
      if (requestBodyTemplate !== undefined && requestBodyTemplate?.trim()) {
        try {
          JSON.parse(requestBodyTemplate);
        } catch {
          return NextResponse.json({ message: 'requestBodyTemplate must be valid JSON' }, { status: 400 });
        }
      }

      if (isDefault === true) {
        await prisma.promptTemplate.updateMany({
          where: { isDefault: true, NOT: { id: params.id } },
          data: { isDefault: false },
        });
      }
      if (isDefaultForCustom === true) {
        await prisma.promptTemplate.updateMany({
          where: { isDefaultForCustom: true, NOT: { id: params.id } },
          data: { isDefaultForCustom: false },
        });
      }

      const updated = await prisma.promptTemplate.update({
        where: { id: params.id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(isDefault !== undefined && { isDefault: !!isDefault }),
          ...(isDefaultForCustom !== undefined && { isDefaultForCustom: !!isDefaultForCustom }),
          ...(promptText !== undefined && { promptText: promptText.trim() }),
          ...(negativePrompt !== undefined && { negativePrompt: negativePrompt?.trim() || null }),
          ...(requestBodyTemplate !== undefined && {
            requestBodyTemplate: requestBodyTemplate?.trim() || null,
          }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
        },
      });

      return NextResponse.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Template not found' }, { status: 404 });
      }
      console.error('[API] Update prompt template error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const existing = await prisma.promptTemplate.findUnique({ where: { id: params.id } });
      if (!existing) {
        return NextResponse.json({ message: 'Template not found' }, { status: 404 });
      }
      if (existing.isDefault) {
        return NextResponse.json(
          { message: 'Cannot delete the default template. Set another as default first.' },
          { status: 400 },
        );
      }
      if (existing.isDefaultForCustom) {
        return NextResponse.json(
          { message: 'Cannot delete the default template for custom careers. Set another as default first.' },
          { status: 400 },
        );
      }

      await prisma.promptTemplate.delete({ where: { id: params.id } });
      return NextResponse.json({ success: true, message: 'Template deleted' });
    } catch (error: any) {
      console.error('[API] Delete prompt template error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
