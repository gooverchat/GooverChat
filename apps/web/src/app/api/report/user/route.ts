import { NextRequest, NextResponse } from 'next/server';
import { reportUserSchema } from '@gooverchat/shared';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const body = await req.json();
  const parsed = reportUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  if (parsed.data.userId === payload.sub) {
    return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
  }
  await prisma.report.create({
    data: {
      reporterId: payload.sub,
      reportedUserId: parsed.data.userId,
      type: 'user',
      reason: parsed.data.reason ?? undefined,
      details: parsed.data.details ?? undefined,
    },
  });
  return NextResponse.json({ ok: true });
}
