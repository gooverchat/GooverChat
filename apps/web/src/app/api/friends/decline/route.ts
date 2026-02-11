import { NextRequest, NextResponse } from 'next/server';
import { friendActionSchema } from '@gooverchat/shared';
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
  const parsed = friendActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  await prisma.friendRequest.updateMany({
    where: { fromId: parsed.data.userId, toId: payload.sub, status: 'pending' },
    data: { status: 'declined', updatedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
