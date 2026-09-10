import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const existingCount = await prisma.adminUser.count();
    if (existingCount > 0) {
      return NextResponse.json({ message: 'Admin already exists' }, { status: 400 });
    }

    const { username, password, displayName } = await req.json();
    if (!username?.trim() || !password || !displayName?.trim()) {
      return NextResponse.json(
        { message: 'username, password and displayName are required' },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    await prisma.adminUser.create({
      data: {
        username: username.trim(),
        passwordHash,
        displayName: displayName.trim(),
      },
    });

    return NextResponse.json({ success: true, message: 'Admin created' });
  } catch (error: any) {
    console.error('[API] Admin seed error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
