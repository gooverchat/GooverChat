import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

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
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      text: { contains: q, mode: 'insensitive' },
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
    },
  });
  return NextResponse.json(messages);
}
