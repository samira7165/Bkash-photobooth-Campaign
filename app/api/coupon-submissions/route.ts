import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { normalizePhone, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { verifyDownloadSessionToken, DOWNLOAD_SESSION_COOKIE } from '@/lib/download-session';
import { getTokenFromRequest, validateAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function toResponseShape(s: {
  id: string;
  status: string;
  couponCode: string | null;
  couponValue: string | null;
  couponExpiry: Date | null;
  rejectionReason: string | null;
  submittedAt: Date;
}) {
  return {
    id: s.id,
    status: s.status,
    couponCode: s.couponCode,
    couponValue: s.couponValue,
    couponExpiry: s.couponExpiry ? s.couponExpiry.toISOString() : null,
    rejectionReason: s.rejectionReason,
    submittedAt: s.submittedAt.toISOString(),
  };
}

// Same dual auth as /api/bp/file: a signed-in staff member (BP Photo
// Portal) can act on behalf of any customer — helping someone claim a
// coupon in person at the event, no OTP required — while a regular visitor
// must still have verified their own number via OTP. Returns null if
// neither is present.
async function resolveStaffOrCustomerPhone(req: NextRequest): Promise<{ phone: string | null; isStaff: boolean }> {
  const adminToken = getTokenFromRequest(req);
  if (adminToken) {
    const admin = await validateAdminToken(adminToken);
    if (admin) return { phone: null, isStaff: true };
  }
  const dlSession = verifyDownloadSessionToken(req.cookies.get(DOWNLOAD_SESSION_COOKIE)?.value);
  return { phone: dlSession?.phone || null, isStaff: false };
}

// Confirms `source`/`sourceId` refers to a real photo, and — for a
// non-staff caller — that it actually belongs to the phone number on their
// verified download session, otherwise anyone with a valid OTP session for
// their own number could claim a coupon against someone else's photo just
// by guessing/enumerating IDs. Staff callers are trusted to act on behalf
// of whichever customer they looked up.
async function resolveOwnerPhone(source: string, sourceId: string): Promise<string | null> {
  if (source === 'booth') {
    const session = await prisma.session.findUnique({ where: { id: sourceId }, select: { phone: true } });
    return session ? normalizePhone(session.phone) : null;
  }
  if (source === 'mobile') {
    const image = await prisma.image.findUnique({
      where: { id: sourceId },
      select: { participant: { select: { phone: true } } },
    });
    return image ? normalizePhone(image.participant.phone) : null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { phone, isStaff } = await resolveStaffOrCustomerPhone(req);
    if (!isStaff && !phone) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source');
    const sourceId = searchParams.get('sourceId');
    if (!source || !sourceId) {
      return NextResponse.json({ message: 'source and sourceId are required' }, { status: 400 });
    }

    const ownerPhone = await resolveOwnerPhone(source, sourceId);
    if (!ownerPhone || (!isStaff && ownerPhone !== phone)) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const submission = await prisma.couponSubmission.findUnique({ where: { source_sourceId: { source, sourceId } } });
    return NextResponse.json({ submission: submission ? toResponseShape(submission) : null });
  } catch (error: any) {
    console.error('[API] Get coupon submission error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { phone: sessionPhone, isStaff } = await resolveStaffOrCustomerPhone(req);
    if (!isStaff && !sessionPhone) {
      return NextResponse.json({ message: 'Please verify your phone number first' }, { status: 401 });
    }

    const formData = await req.formData();
    const source = formData.get('source') as string | null;
    const sourceId = formData.get('sourceId') as string | null;
    const name = (formData.get('name') as string | null)?.trim();
    // This is the bKash account number the coupon should be issued
    // against — deliberately independent of the phone number verified
    // earlier in the download portal (a bKash wallet may be registered to
    // a different number), so it is NOT cross-checked against the session.
    const phoneRaw = formData.get('phone') as string | null;
    const postUrl = (formData.get('postUrl') as string | null)?.trim() || null;
    const screenshot = formData.get('screenshot') as File | null;

    if (!source || !sourceId || !['booth', 'mobile'].includes(source)) {
      return NextResponse.json({ message: 'Invalid source' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }
    if (!phoneRaw || !isValidPhone(phoneRaw)) {
      return NextResponse.json({ message: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }
    if (postUrl) {
      try {
        new URL(postUrl);
      } catch {
        return NextResponse.json({ message: 'Post link must be a valid URL' }, { status: 400 });
      }
    }
    if (!screenshot) {
      return NextResponse.json({ message: 'Screenshot is required' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TO_EXT[screenshot.type]) {
      return NextResponse.json({ message: 'Screenshot must be a JPG, PNG, or WEBP image' }, { status: 400 });
    }
    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ message: 'Screenshot must be smaller than 8MB' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phoneRaw);

    // Which photo this claim is for is still locked to the session that
    // was actually OTP-verified (or a trusted staff lookup) — that's a
    // separate check from the bKash account number typed into the form
    // above, which is free-form and unrelated to the download session.
    const ownerPhone = await resolveOwnerPhone(source, sourceId);
    if (!ownerPhone || (!isStaff && ownerPhone !== sessionPhone)) {
      return NextResponse.json({ message: 'Photo not found for this phone number' }, { status: 404 });
    }

    const existing = await prisma.couponSubmission.findUnique({ where: { source_sourceId: { source, sourceId } } });
    if (existing && existing.status !== 'rejected') {
      return NextResponse.json(
        { message: 'A coupon claim has already been submitted for this photo', submission: toResponseShape(existing) },
        { status: 409 },
      );
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const screenshotDir = path.join(uploadDir, 'coupon-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const ext = ALLOWED_MIME_TO_EXT[screenshot.type];
    const filename = `${source}_${sourceId}_${uuidv4()}${ext}`;
    const filepath = path.join(screenshotDir, filename);
    const buffer = Buffer.from(await screenshot.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Clean up the previous screenshot on a resubmit after rejection — no
    // point keeping a rejected image around once it's been replaced.
    if (existing?.screenshotPath) {
      try {
        fs.unlinkSync(existing.screenshotPath);
      } catch {
        // best-effort
      }
    }

    const submission = await prisma.couponSubmission.upsert({
      where: { source_sourceId: { source, sourceId } },
      create: {
        source,
        sourceId,
        name,
        phone: normalizedPhone,
        postUrl,
        screenshotPath: filepath,
        status: 'pending',
      },
      update: {
        name,
        phone: normalizedPhone,
        postUrl,
        screenshotPath: filepath,
        status: 'pending',
        couponCode: null,
        couponValue: null,
        couponExpiry: null,
        rejectionReason: null,
        verifiedAt: null,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({ submission: toResponseShape(submission) }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Submit coupon claim error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
