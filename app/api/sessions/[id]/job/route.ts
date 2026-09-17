import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

const VALID_JOBS = [
  'Military', 'Painter', 'Scientist', 'Professional Gamer',
  'Doctor', 'Engineer', 'Pilot', 'Journalist',
  'Photographer', 'Lawyer', 'Singer', 'Footballer',
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: params.id },
    });

    if (!session) {
      return NextResponse.json({ message: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'created') {
      return NextResponse.json({ message: 'Job already selected' }, { status: 400 });
    }

    const body = await req.json();
    const { job, customJob } = body;

    if (!VALID_JOBS.includes(job)) {
      return NextResponse.json({ message: 'Invalid job selection' }, { status: 400 });
    }
    if (job === 'Other' && !customJob?.trim()) {
      return NextResponse.json({ message: 'Custom job is required when selecting Other' }, { status: 400 });
    }

    const updated = await prisma.session.update({
      where: { id: params.id },
      data: {
        selectedJob: job,
        customJob: job === 'Other' ? customJob.trim() : null,
        status: 'job_selected',
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[API] Select job error:', error.message);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
