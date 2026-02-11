import { NextRequest, NextResponse } from 'next/server';
import { reportMessageSchema } from '@gooverchat/shared';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const body = await req.json();
  const parsed = reportMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const msg = await prisma.message.findUnique({
    where: { id: parsed.data.messageId },
  });
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: msg.conversationId, userId: payload.sub } },
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.report.create({
    data: {
      reporterId: payload.sub,
      messageId: msg.id,
      type: 'message',
      reason: parsed.data.reason ?? undefined,
      details: parsed.data.details ?? undefined,
    },
  });
  return NextResponse.json({ ok: true });
}
