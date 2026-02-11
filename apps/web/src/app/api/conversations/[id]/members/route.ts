import { NextRequest, NextResponse } from 'next/server';
import { addMemberSchema } from '@gooverchat/shared';
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
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.type !== 'group') return NextResponse.json({ error: 'Not a group' }, { status: 400 });
  await prisma.conversationMember.create({
    data: {
      conversationId,
      userId: parsed.data.userId,
      role: (parsed.data.role as 'admin' | 'member') || 'member',
    },
  });
  return NextResponse.json({ ok: true });
}
