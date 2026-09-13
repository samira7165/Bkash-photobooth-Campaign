import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async (_req, admin) => {
    return NextResponse.json({
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    });
  });
}
