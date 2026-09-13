import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

const VALID_ROLES = ['admin', 'client'];

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async (req) => {
    try {
      const { displayName, role } = await req.json();
      if (!displayName?.trim()) {
        return NextResponse.json({ message: 'displayName is required' }, { status: 400 });
      }
      if (role && !VALID_ROLES.includes(role)) {
        return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
      }

      const user = await prisma.adminUser.update({
        where: { id: params.id },
        data: { displayName: displayName.trim(), ...(role ? { role } : {}) },
        select: USER_SELECT,
      });

      return NextResponse.json(user);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }
      console.error('[API] Update admin user error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withAdminAuth(req, async (_req, admin) => {
    try {
      if (admin.id === params.id) {
        return NextResponse.json({ message: 'You cannot delete your own account' }, { status: 400 });
      }

      const existing = await prisma.adminUser.findUnique({ where: { id: params.id } });
      if (!existing) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }

      await prisma.adminSession.deleteMany({ where: { userId: params.id } });
      await prisma.adminUser.delete({ where: { id: params.id } });

      return NextResponse.json({ success: true, message: 'User deleted' });
    } catch (error: any) {
      console.error('[API] Delete admin user error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
