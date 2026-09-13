import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { maskApiKey } from '@/lib/utils';
import { withAdminAuth } from '@/lib/admin-guard';

export async function GET(req: NextRequest) {
  return withAdminAuth(req, async () => {
    try {
      const [ai, sms] = await Promise.all([
        prisma.aiProvider.findMany({ orderBy: { priority: 'asc' } }),
        prisma.smsProvider.findMany({ orderBy: { priority: 'asc' } }),
      ]);

      return NextResponse.json({
        ai: ai.map((p) => ({ ...p, apiKey: maskApiKey(p.apiKey) })),
        sms: sms.map((p) => ({ ...p, apiKey: maskApiKey(p.apiKey) })),
      });
    } catch (error: any) {
      console.error('[API] List providers error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}

export async function POST(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const body = await req.json();
      const { type, name, apiUrl, apiKey, model, senderId, priority } = body;

      if (type !== 'ai' && type !== 'sms') {
        return NextResponse.json({ message: 'type must be "ai" or "sms"' }, { status: 400 });
      }
      if (!name?.trim() || !apiUrl?.trim() || !apiKey?.trim()) {
        return NextResponse.json({ message: 'name, apiUrl and apiKey are required' }, { status: 400 });
      }

      if (type === 'ai') {
        const provider = await prisma.aiProvider.create({
          data: {
            name: name.trim(),
            apiUrl: apiUrl.trim(),
            apiKey: apiKey.trim(),
            model: model?.trim() || null,
            priority: priority ?? 0,
          },
        });
        return NextResponse.json({ ...provider, apiKey: maskApiKey(provider.apiKey) }, { status: 201 });
      }

      const provider = await prisma.smsProvider.create({
        data: {
          name: name.trim(),
          apiUrl: apiUrl.trim(),
          apiKey: apiKey.trim(),
          senderId: senderId?.trim() || null,
          priority: priority ?? 0,
        },
      });
      return NextResponse.json({ ...provider, apiKey: maskApiKey(provider.apiKey) }, { status: 201 });
    } catch (error: any) {
      console.error('[API] Create provider error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  }, { roles: ['admin'] });
}
