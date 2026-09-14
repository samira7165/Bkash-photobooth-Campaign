import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const [
        totalParticipants,
        totalCompletedImages,
        downloadAgg,
        comicDownloadImageAgg,
        comicDownloadSessionAgg,
        events,
        totalOtpSent,
        otpVerified,
        otpFailed,
        totalQrScans,
        qrScansByCode,
      ] = await Promise.all([
        prisma.participant.count(),
        prisma.image.count({ where: { processingStatus: { in: ['generated', 'sms_sent'] } } }),
        prisma.image.aggregate({ _sum: { downloadCount: true } }),
        prisma.image.aggregate({ _sum: { comicDownloadCount: true } }),
        prisma.session.aggregate({ _sum: { comicDownloadCount: true } }),
        prisma.event.findMany({
          select: { id: true, name: true, _count: { select: { participants: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.otp.count(),
        prisma.otp.count({ where: { verified: true } }),
        prisma.otp.count({ where: { verified: false, expiresAt: { lt: new Date() } } }),
        prisma.qrScan.count(),
        prisma.qrScan.groupBy({
          by: ['code'],
          _count: { code: true },
          orderBy: { _count: { code: 'desc' } },
        }),
      ]);

      return NextResponse.json({
        totalParticipants,
        totalCompletedImages,
        totalDownloads: downloadAgg._sum.downloadCount || 0,
        totalComicDownloads:
          (comicDownloadImageAgg._sum.comicDownloadCount || 0) + (comicDownloadSessionAgg._sum.comicDownloadCount || 0),
        totalOtpSent,
        otpVerified,
        otpFailed,
        totalQrScans,
        byQrCode: qrScansByCode.map((row) => ({
          code: row.code,
          count: row._count.code,
        })),
        byEvent: events.map((e) => ({
          eventId: e.id,
          eventName: e.name,
          count: e._count.participants,
        })),
      });
    } catch (error: any) {
      console.error('[API] Participant stats error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
