import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const { id: conversationId, userId: targetUserId } = await params;
  const me = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: payload.sub } },
  });
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (targetUserId === payload.sub) {
    await prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId: payload.sub } },
    });
    return NextResponse.json({ ok: true });
  }
  if (me.role !== 'owner' && me.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (target.role === 'owner') return NextResponse.json({ error: 'Cannot remove owner' }, { status: 403 });
  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  return NextResponse.json({ ok: true });
}
