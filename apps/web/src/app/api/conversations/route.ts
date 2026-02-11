import { NextRequest, NextResponse } from 'next/server';
import { createConversationSchema } from '@gooverchat/shared';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: payload.sub },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  profile: { select: { displayName: true, avatarUrl: true } },
                },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
            },
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
  });
  const prefs = await prisma.conversationPreference.findMany({
    where: { userId: payload.sub },
  });
  const prefsMap = Object.fromEntries(prefs.map((p) => [p.conversationId, p]));
  const list = memberships.map((m) => {
    const c = m.conversation;
    const lastMsg = c.messages[0];
    const pref = prefsMap[c.id];
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      description: c.description,
      avatarUrl: c.avatarUrl,
      lastMessageAt: c.lastMessageAt,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            text: lastMsg.text,
            type: lastMsg.type,
            createdAt: lastMsg.createdAt,
            sender: lastMsg.sender,
          }
        : null,
      members: c.members.map((mb) => mb.user),
      role: m.role,
      lastReadMessageId: m.lastReadMessageId,
      isPinned: pref?.isPinned ?? false,
      isArchived: pref?.isArchived ?? false,
      isMuted: pref?.isMuted ?? false,
    };
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  if (!payload?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = payload.sub;
  const body = await req.json();
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  if (parsed.data.type === 'direct' && parsed.data.memberIds?.length === 1) {
    const otherId = parsed.data.memberIds[0];
    if (typeof otherId === 'string') {
      const existing = await prisma.conversation.findFirst({
        where: {
          type: 'direct',
          members: {
            every: { userId: { in: [userId, otherId] } },
          },
        },
        include: { members: { select: { userId: true } } },
      });
      if (existing && existing.members.length === 2) {
        const hasBoth = existing.members.every((m) => m.userId === userId || m.userId === otherId);
        if (hasBoth) return NextResponse.json({ id: existing.id, type: existing.type, members: existing.members });
      }
    }
  }
  const conv = await prisma.conversation.create({
    data: {
      type: parsed.data.type,
      name: parsed.data.type === 'group' ? parsed.data.name ?? 'Group' : null,
      description: parsed.data.type === 'group' ? parsed.data.description : null,
      members: {
        create: [
          { userId, role: 'owner' },
          ...(parsed.data.memberIds || []).filter((id) => id !== userId).map((id) => ({ userId: id, role: 'member' as const })),
        ],
      },
    },
    include: { members: { include: { user: { select: { id: true, username: true, profile: true } } } } },
  });
  return NextResponse.json(conv);
}
