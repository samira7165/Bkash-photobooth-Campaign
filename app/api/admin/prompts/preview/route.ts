import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-guard';
import { resolveTemplate } from '@/lib/prompt-builder';

export async function POST(req: NextRequest) {
  return withAdminAuth(req, async (req) => {
    try {
      const body = await req.json();
      const { promptText, negativePrompt, requestBodyTemplate, gender, job, name } = body;

      if (!promptText?.trim()) {
        return NextResponse.json({ message: 'promptText is required' }, { status: 400 });
      }
      if (gender !== 'male' && gender !== 'female') {
        return NextResponse.json({ message: 'gender must be "male" or "female"' }, { status: 400 });
      }
      if (!job?.trim()) {
        return NextResponse.json({ message: 'job is required' }, { status: 400 });
      }

      const result = resolveTemplate(
        { name: 'Preview', promptText, negativePrompt, requestBodyTemplate },
        { name: name?.trim() || 'Test User', gender, job },
        '[BASE64_IMAGE_DATA]',
      );

      return NextResponse.json({
        prompt: result.prompt,
        negativePrompt: result.negativePrompt,
        requestBody: result.requestBody,
        requestBodyError: result.requestBodyError || null,
      });
    } catch (error: any) {
      console.error('[API] Preview prompt error:', error.message);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}
