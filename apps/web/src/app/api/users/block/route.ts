import { NextRequest, NextResponse } from 'next/server';
import { blockUserSchema } from '@gooverchat/shared';
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
  const parsed = blockUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  if (parsed.data.userId === payload.sub) return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  await prisma.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId: payload.sub, blockedId: parsed.data.userId } },
    create: { blockerId: payload.sub, blockedId: parsed.data.userId },
    update: {},
  });
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userId: payload.sub, friendId: parsed.data.userId },
        { userId: parsed.data.userId, friendId: payload.sub },
      ],
    },
  });
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { fromId: payload.sub, toId: parsed.data.userId },
        { fromId: parsed.data.userId, toId: payload.sub },
      ],
    },
  });
  return NextResponse.json({ ok: true });
}
