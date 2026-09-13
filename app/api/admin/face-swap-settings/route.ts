import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-guard';
import { getRawFaceSwapRow, upsertFaceSwapSettings } from '@/lib/face-swap-settings';
import { isMaskedApiKey, maskApiKey } from '@/lib/utils';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const row = await getRawFaceSwapRow();

      return NextResponse.json({
        apiUrl: row?.apiUrl || process.env.FACE_SWAP_API_URL || '',
        apiKey: row?.apiKey ? maskApiKey(row.apiKey) : (process.env.FACE_SWAP_API_KEY ? '(using .env value)' : ''),
        model: row?.model || process.env.FACE_SWAP_MODEL || 'codeplugtech/face-swap',
        configured: !!(row?.apiKey || process.env.FACE_SWAP_API_KEY),
        source: row?.apiKey ? 'database' : (process.env.FACE_SWAP_API_KEY ? 'env' : 'none'),
      });
    } catch (error: any) {
      console.error('[API] Get face swap settings error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}

export async function PUT(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const body = await req.json();
      const { apiUrl, apiKey, model } = body;

      const data: { apiUrl?: string | null; apiKey?: string | null; model?: string | null } = {};
      if (apiUrl !== undefined) data.apiUrl = apiUrl?.trim() || null;
      if (model !== undefined) data.model = model?.trim() || null;
      if (apiKey !== undefined && !isMaskedApiKey(apiKey) && apiKey !== '(using .env value)') {
        data.apiKey = apiKey?.trim() || null;
      }

      const updated = await upsertFaceSwapSettings(data);

      return NextResponse.json({
        apiUrl: updated.apiUrl || '',
        apiKey: updated.apiKey ? maskApiKey(updated.apiKey) : '',
        model: updated.model || '',
      });
    } catch (error: any) {
      console.error('[API] Update face swap settings error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
