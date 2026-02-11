import { NextRequest, NextResponse } from 'next/server';
import { sendMessageSchema } from '@gooverchat/shared';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';
import { messageRateLimit } from '@/src/lib/rate-limit';
import { PAGINATION_LIMIT } from '@gooverchat/shared';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const { id: conversationId } = await params;
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: payload.sub } },
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const cursor = req.nextUrl.searchParams.get('cursor');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || String(PAGINATION_LIMIT), 10), 100);
  const deletedForMe = await prisma.messageDeletedForUser.findMany({
    where: { userId: payload.sub },
    select: { messageId: true },
  });
  const hideIds = new Set(deletedForMe.map((d) => d.messageId));
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      OR: [
        { deletedAt: null },
        { deleteScope: 'everyone' },
      ],
      ...(hideIds.size > 0 ? { id: { notIn: Array.from(hideIds) } } : {}),
    },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      replyTo: { select: { id: true, text: true, senderId: true, createdAt: true } },
      attachments: true,
      reactions: { include: { user: { select: { id: true, username: true } } } },
    },
  });
  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  const myMessageIds = items.filter((m) => m.senderId === payload.sub).map((m) => m.id);
  const otherMembers = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { not: payload.sub } },
    select: { userId: true, lastReadMessageId: true, lastReadAt: true },
  });
  const otherUserIds = otherMembers.map((m) => m.userId);
  const lastReadIds = otherMembers.map((m) => m.lastReadMessageId).filter(Boolean) as string[];
  const lastReadMessages =
    lastReadIds.length > 0
      ? await prisma.message.findMany({
          where: { id: { in: lastReadIds } },
          select: { id: true, createdAt: true },
        })
      : [];
  const lastReadByMessageId = Object.fromEntries(lastReadMessages.map((m) => [m.id, m.createdAt]));

  const deliveries =
    myMessageIds.length > 0 && otherUserIds.length > 0
      ? await prisma.messageDelivery.findMany({
          where: {
            messageId: { in: myMessageIds },
            userId: { in: otherUserIds },
          },
          select: { messageId: true, userId: true, deliveredAt: true },
        })
      : [];
  const deliveredByMessage: Record<string, { deliveredAt: Date; userId: string }[]> = {};
  for (const d of deliveries) {
    const bucket = deliveredByMessage[d.messageId] ?? (deliveredByMessage[d.messageId] = []);
    bucket.push({ deliveredAt: d.deliveredAt, userId: d.userId });
  }

  const messagesWithStatus = items.map((m) => {
    const base = {
      ...m,
      createdAt: m.createdAt.toISOString(),
      editedAt: m.editedAt?.toISOString() ?? null,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      replyTo: m.replyTo
        ? {
            ...m.replyTo,
            createdAt: (m.replyTo as { createdAt: Date }).createdAt?.toISOString?.() ?? null,
          }
        : m.replyTo,
    };
    if (m.senderId !== payload.sub) return base;
    let deliveredAt: string | null = null;
    let seenAt: string | null = null;
    const msgTime = m.createdAt.getTime();
    const delList = deliveredByMessage[m.id];
    if (delList?.length) {
      const earliest = delList.reduce((a, b) => (a.deliveredAt < b.deliveredAt ? a : b));
      deliveredAt = earliest.deliveredAt.toISOString();
    }
    for (const om of otherMembers) {
      const readId = om.lastReadMessageId;
      const readAt = om.lastReadAt;
      if (!readId || !readAt) continue;
      const readCreatedAt = lastReadByMessageId[readId];
      if (!readCreatedAt) continue;
      const readTime = readCreatedAt.getTime();
      if (readTime > msgTime || readId === m.id) {
        if (!seenAt || readAt.toISOString() < seenAt) seenAt = readAt.toISOString();
      }
    }
    return {
      ...base,
      status: { deliveredAt, seenAt },
    };
  });

  return NextResponse.json({
    messages: messagesWithStatus,
    nextCursor,
    hasMore,
    currentUserId: payload.sub,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const rl = await messageRateLimit(payload.sub);
  if (!rl.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  const { id: conversationId } = await params;
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: payload.sub } },
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId: payload.sub,
      type: parsed.data.type || 'text',
      text: parsed.data.text ?? null,
      replyToId: parsed.data.replyToId ?? null,
      forwardedFromId: parsed.data.forwardedFromId ?? null,
      mentions: parsed.data.mentionIds?.length
        ? { create: parsed.data.mentionIds.map((userId) => ({ userId })) }
        : undefined,
    },
    include: {
      sender: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      replyTo: { select: { id: true, text: true, senderId: true } },
      attachments: true,
      reactions: true,
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
  return NextResponse.json(msg);
}
