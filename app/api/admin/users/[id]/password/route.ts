import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import { hashPassword } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async (req) => {
    try {
      const { password } = await req.json();
      if (!password || password.length < 6) {
        return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);
      await prisma.adminUser.update({
        where: { id: params.id },
        data: { passwordHash },
      });

      return NextResponse.json({ success: true, message: 'Password updated' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }
      console.error('[API] Reset password error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
