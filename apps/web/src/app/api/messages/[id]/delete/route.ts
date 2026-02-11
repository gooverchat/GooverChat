import { NextRequest, NextResponse } from 'next/server';
import { deleteMessageSchema } from '@gooverchat/shared';
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
  const { id } = await params;
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  const parsed = deleteMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  if (parsed.data.scope === 'me') {
    await prisma.messageDeletedForUser.upsert({
      where: { userId_messageId: { userId: payload.sub, messageId: id } },
      create: { userId: payload.sub, messageId: id },
      update: {},
    });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.scope === 'everyone') {
    if (msg.senderId !== payload.sub) {
      return NextResponse.json({ error: 'Only sender can delete for everyone' }, { status: 403 });
    }
    await prisma.auditLog.create({
      data: {
        userId: payload.sub,
        action: 'delete_message_everyone',
        resource: 'message',
        resourceId: id,
      },
    });
    await prisma.message.update({
      where: { id },
      data: { deletedAt: new Date(), deleteScope: 'everyone', text: null },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
}
