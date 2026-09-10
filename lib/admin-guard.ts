import { NextRequest, NextResponse } from 'next/server';
import { AdminUser } from '@prisma/client';
import { getTokenFromRequest, validateAdminToken } from './auth';

export async function withAdminAuth(
  req: NextRequest,
  handler: (req: NextRequest, admin: AdminUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  const admin = await validateAdminToken(token);
  if (!admin) {
    return NextResponse.json({ message: 'Invalid or expired session' }, { status: 401 });
  }
  return handler(req, admin);
}
