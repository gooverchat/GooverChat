import { NextRequest, NextResponse } from 'next/server';
import { friendRequestSchema } from '@gooverchat/shared';
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
  const parsed = friendRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const toId = parsed.data.toId;
  if (toId === userId) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 });
  const existing = await prisma.friendRequest.findUnique({
    where: { fromId_toId: { fromId: userId, toId } },
  });
  if (existing) return NextResponse.json({ error: 'Request already sent' }, { status: 409 });
  const blocked = await prisma.blockedUser.findFirst({
    where: { OR: [{ blockerId: userId, blockedId: toId }, { blockerId: toId, blockedId: userId }] },
  });
  if (blocked) return NextResponse.json({ error: 'Cannot send request' }, { status: 403 });
  await prisma.friendRequest.create({
    data: { fromId: userId, toId, status: 'pending' },
  });
  await prisma.notification.create({
    data: {
      userId: toId,
      type: 'friend_request',
      title: 'Friend request',
      body: 'You have a new friend request',
      payload: { fromId: userId },
    },
  });
  return NextResponse.json({ ok: true });
}
