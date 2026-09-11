import { NextRequest, NextResponse } from 'next/server';
import { getDownloadSubmissions } from '@/lib/download-gallery';
import { verifyDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }
    const submissions = await getDownloadSubmissions(session.phone);
    if (submissions.length === 0) {
      return NextResponse.json({ message: 'No photos found for this phone number' }, { status: 404 });
    }

    return NextResponse.json({ submissions });
  } catch (error: any) {
    console.error('[API] Get download gallery error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
