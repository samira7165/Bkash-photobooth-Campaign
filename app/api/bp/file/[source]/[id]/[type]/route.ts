import { NextRequest } from 'next/server';
import { withAdminAuth } from '@/lib/admin-guard';
import { serveDownloadFile } from '@/lib/download-file';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { source: string; id: string; type: string } }) {
  return withAdminAuth(req, async () => serveDownloadFile(req, params, true));
}
