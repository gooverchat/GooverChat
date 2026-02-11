import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query min 2 characters' }, { status: 400 });
  }
  const myConvs = await prisma.conversationMember.findMany({
    where: { userId: payload.sub },
    select: { conversationId: true },
  });
  const convIds = myConvs.map((c) => c.conversationId);
  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: convIds },
      deletedAt: null,
      text: { contains: q, mode: 'insensitive' },
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
      conversation: { select: { id: true, name: true, type: true } },
    },
  });
  return NextResponse.json(messages);
}
