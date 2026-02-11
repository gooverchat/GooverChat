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
  const messageIds = Array.isArray(body.messageIds)
    ? body.messageIds.filter((id: unknown) => typeof id === 'string')
    : [];
  if (messageIds.length === 0) return NextResponse.json({ ok: true, marked: 0 });

  const validMessages = await prisma.message.findMany({
    where: { id: { in: messageIds }, conversationId },
    select: { id: true },
  });
  const validIds = validMessages.map((m) => m.id);

  await prisma.messageDelivery.createMany({
    data: validIds.map((messageId) => ({
      messageId,
      userId: payload.sub,
    })),
    skipDuplicates: true,
  });
  return NextResponse.json({ ok: true, marked: validIds.length });
}
