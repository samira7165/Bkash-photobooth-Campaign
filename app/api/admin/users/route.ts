import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';
import { hashPassword } from '@/lib/auth';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const users = await prisma.adminUser.findMany({
        orderBy: { createdAt: 'asc' },
        select: USER_SELECT,
      });
      return NextResponse.json(users);
    } catch (error: any) {
      console.error('[API] List admin users error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const { username, password, displayName } = await req.json();

      if (!username?.trim() || !password || !displayName?.trim()) {
        return NextResponse.json(
          { message: 'username, password and displayName are required' },
          { status: 400 },
        );
      }
      if (password.length < 6) {
        return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.adminUser.create({
        data: {
          username: username.trim(),
          passwordHash,
          displayName: displayName.trim(),
        },
        select: USER_SELECT,
      });

      return NextResponse.json(user, { status: 201 });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
      }
      console.error('[API] Create admin user error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
