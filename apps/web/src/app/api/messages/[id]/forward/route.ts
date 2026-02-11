import { NextRequest, NextResponse } from 'next/server';
import { forwardSchema } from '@gooverchat/shared';
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
  const sourceMember = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: msg.conversationId, userId: payload.sub } },
  });
  if (!sourceMember) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  const parsed = forwardSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const created: string[] = [];
  for (const convId of parsed.data.conversationIds) {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId: payload.sub } },
    });
    if (!member) continue;
    await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: payload.sub,
        type: msg.type,
        text: msg.text,
        forwardedFromId: messageId,
      },
    });
    created.push(convId);
    await prisma.conversation.update({
      where: { id: convId },
      data: { lastMessageAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true, conversationIds: created });
}
