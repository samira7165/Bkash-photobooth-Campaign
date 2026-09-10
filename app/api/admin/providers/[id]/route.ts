import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isMaskedApiKey, maskApiKey } from '@/lib/utils';
import { withAdminAuth } from '@/lib/admin-guard';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async (req) => {
    try {
      const body = await req.json();
      const { name, apiUrl, apiKey, model, senderId, priority, isActive } = body;

      const skipKey = apiKey !== undefined && isMaskedApiKey(apiKey);

      const aiExisting = await prisma.aiProvider.findUnique({ where: { id: params.id } });
      if (aiExisting) {
        const updated = await prisma.aiProvider.update({
          where: { id: params.id },
          data: {
            ...(name !== undefined && { name: name.trim() }),
            ...(apiUrl !== undefined && { apiUrl: apiUrl.trim() }),
            ...(apiKey !== undefined && !skipKey && { apiKey: apiKey.trim() }),
            ...(model !== undefined && { model: model?.trim() || null }),
            ...(priority !== undefined && { priority }),
            ...(isActive !== undefined && { isActive }),
          },
        });
        return NextResponse.json({ ...updated, apiKey: maskApiKey(updated.apiKey) });
      }

      const smsExisting = await prisma.smsProvider.findUnique({ where: { id: params.id } });
      if (smsExisting) {
        const updated = await prisma.smsProvider.update({
          where: { id: params.id },
          data: {
            ...(name !== undefined && { name: name.trim() }),
            ...(apiUrl !== undefined && { apiUrl: apiUrl.trim() }),
            ...(apiKey !== undefined && !skipKey && { apiKey: apiKey.trim() }),
            ...(senderId !== undefined && { senderId: senderId?.trim() || null }),
            ...(priority !== undefined && { priority }),
            ...(isActive !== undefined && { isActive }),
          },
        });
        return NextResponse.json({ ...updated, apiKey: maskApiKey(updated.apiKey) });
      }

      return NextResponse.json({ message: 'Provider not found' }, { status: 404 });
    } catch (error: any) {
      console.error('[API] Update provider error:', error.message);
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
      const aiExisting = await prisma.aiProvider.findUnique({ where: { id: params.id } });
      if (aiExisting) {
        await prisma.aiProvider.delete({ where: { id: params.id } });
        return NextResponse.json({ message: 'Provider deleted' });
      }

      const smsExisting = await prisma.smsProvider.findUnique({ where: { id: params.id } });
      if (smsExisting) {
        await prisma.smsProvider.delete({ where: { id: params.id } });
        return NextResponse.json({ message: 'Provider deleted' });
      }

      return NextResponse.json({ message: 'Provider not found' }, { status: 404 });
    } catch (error: any) {
      console.error('[API] Delete provider error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
