import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Codes are printed on physical material, so they stay short and boring.
// Bounding the shape here keeps junk (and oversized payloads) out of the
// stats table, since this endpoint is necessarily public.
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;

/**
 * Record a QR-code scan — a landing-page hit carrying `?qr=<code>`.
 *
 * Public by design: the visitor hasn't identified themselves yet. It writes
 * nothing but a code and a timestamp, and never reports whether a code is
 * "known", so there's nothing to enumerate.
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
      return NextResponse.json({ message: 'Invalid QR code' }, { status: 400 });
    }

    await prisma.qrScan.create({ data: { code } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] QR scan error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
