import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-guard';
import { getDownloadSubmissions } from '@/lib/download-gallery';
import { isValidPhone, normalizePhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    const phone = req.nextUrl.searchParams.get('phone');
    if (!isValidPhone(phone)) {
      return NextResponse.json({ message: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }
    try {
      const normalized = normalizePhone(phone).replace(/^\+88/, '');
      const groups = await Promise.all([normalized, `+88${normalized}`].map(
        (value) => getDownloadSubmissions(value, '/api/bp/file'),
      ));
      const submissions = groups.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return NextResponse.json({ submissions }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
      console.error('[BP] Search failed:', error);
      return NextResponse.json({ message: 'Unable to load photos. Please try again.' }, { status: 500 });
    }
  });
}
