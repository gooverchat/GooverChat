import { NextRequest, NextResponse } from 'next/server';
import { friendActionSchema } from '@gooverchat/shared';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    const payload = await requireAuth();
    userId = payload.sub;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const parsed = friendActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const reqRow = await prisma.friendRequest.findUnique({
    where: { fromId_toId: { fromId: parsed.data.userId, toId: userId } },
  });
  if (!reqRow || reqRow.status !== 'pending') {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  await prisma.$transaction([
    prisma.friendRequest.update({
      where: { id: reqRow.id },
      data: { status: 'accepted', updatedAt: new Date() },
    }),
    prisma.friendship.createMany({
      data: [
        { userId: reqRow.fromId, friendId: userId, status: 'accepted' },
        { userId, friendId: reqRow.fromId, status: 'accepted' },
      ],
      skipDuplicates: true,
    }),
  ]);
  await prisma.notification.create({
    data: {
      userId: reqRow.fromId,
      type: 'friend_accepted',
      title: 'Friend request accepted',
      body: 'Your friend request was accepted',
      payload: { userId },
    },
  });
  return NextResponse.json({ ok: true });
}
