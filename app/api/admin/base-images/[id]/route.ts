import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async (req) => {
    try {
      const body = await req.json();
      const { job, gender, isActive } = body;

      if (gender !== undefined && gender !== 'male' && gender !== 'female') {
        return NextResponse.json({ message: 'gender must be "male" or "female"' }, { status: 400 });
      }
      if (job !== undefined && !job.trim()) {
        return NextResponse.json({ message: 'job cannot be empty' }, { status: 400 });
      }

      const updated = await prisma.jobBaseImage.update({
        where: { id: params.id },
        data: {
          ...(job !== undefined && { job: job.trim() }),
          ...(gender !== undefined && { gender }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      return NextResponse.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Base image not found' }, { status: 404 });
      }
      console.error('[API] Update base image error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async () => {
    try {
      const existing = await prisma.jobBaseImage.findUnique({ where: { id: params.id } });
      if (!existing) {
        return NextResponse.json({ message: 'Base image not found' }, { status: 404 });
      }

      if (existing.imagePath) {
        try {
          fs.unlinkSync(existing.imagePath);
        } catch {
          // ignore missing file
        }
      }

      await prisma.jobBaseImage.delete({ where: { id: params.id } });
      return NextResponse.json({ success: true, message: 'Base image deleted' });
    } catch (error: any) {
      console.error('[API] Delete base image error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
