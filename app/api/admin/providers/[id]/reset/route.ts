import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { maskApiKey } from '@/lib/utils';
import { withAdminAuth } from '@/lib/admin-guard';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const aiExisting = await prisma.aiProvider.findUnique({ where: { id: params.id } });
      if (aiExisting) {
        const updated = await prisma.aiProvider.update({
          where: { id: params.id },
          data: { failCount: 0, lastFailAt: null },
        });
        return NextResponse.json({ ...updated, apiKey: maskApiKey(updated.apiKey) });
      }

      const smsExisting = await prisma.smsProvider.findUnique({ where: { id: params.id } });
      if (smsExisting) {
        const updated = await prisma.smsProvider.update({
          where: { id: params.id },
          data: { failCount: 0, lastFailAt: null },
        });
        return NextResponse.json({ ...updated, apiKey: maskApiKey(updated.apiKey) });
      }

      return NextResponse.json({ message: 'Provider not found' }, { status: 404 });
    } catch (error: any) {
      console.error('[API] Reset provider error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
