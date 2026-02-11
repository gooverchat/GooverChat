import { NextRequest, NextResponse } from 'next/server';
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
  const { id: conversationId } = await params;
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: payload.sub } },
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const lastReadMessageId = typeof body.lastReadMessageId === 'string' ? body.lastReadMessageId : null;
  if (!lastReadMessageId) return NextResponse.json({ error: 'lastReadMessageId required' }, { status: 400 });

  const message = await prisma.message.findFirst({
    where: { id: lastReadMessageId, conversationId },
  });
  if (!message) return NextResponse.json({ error: 'Message not in this conversation' }, { status: 400 });

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: payload.sub } },
    data: { lastReadMessageId, lastReadAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
