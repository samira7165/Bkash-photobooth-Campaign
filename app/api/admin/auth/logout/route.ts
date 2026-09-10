import { NextRequest, NextResponse } from 'next/server';
import { destroyAdminSession, getTokenFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    if (token) {
      await destroyAdminSession(token);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set('admin_token', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (error: any) {
    console.error('[API] Admin logout error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
