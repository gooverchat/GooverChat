import { NextRequest, NextResponse } from 'next/server';
import { reactSchema } from '@gooverchat/shared';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

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
  const { id: messageId } = await params;
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: msg.conversationId, userId: payload.sub } },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const parsed = reactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId, userId: payload.sub, emoji: parsed.data.emoji },
    },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ removed: true });
  }
  await prisma.messageReaction.upsert({
    where: {
      messageId_userId_emoji: { messageId, userId: payload.sub, emoji: parsed.data.emoji },
    },
    create: { messageId, userId: payload.sub, emoji: parsed.data.emoji },
    update: {},
  });
  return NextResponse.json({ ok: true });
}
