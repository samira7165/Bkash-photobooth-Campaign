import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createAdminSession, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username?.trim() || !password) {
      return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
    }

    const admin = await prisma.adminUser.findUnique({ where: { username: username.trim() } });
    if (!admin) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createAdminSession(admin.id);
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const res = NextResponse.json({ success: true, displayName: admin.displayName });
    res.cookies.set('admin_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 86400,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (error: any) {
    console.error('[API] Admin login error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
