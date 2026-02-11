import { NextRequest, NextResponse } from 'next/server';
import { editMessageSchema } from '@gooverchat/shared';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

async function handleEditMessage(
  req: NextRequest,
  params: Promise<{ id: string }>
) {
  const payload = await requireAuth();
  const { id } = await params;
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg || msg.senderId !== payload.sub || msg.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 });
  }
  if (body == null || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }
  const parsed = editMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const updated = await prisma.message.update({
    where: { id },
    data: { text: parsed.data.text, editedAt: new Date() },
    include: {
      sender: { select: { id: true, username: true, profile: true } },
      replyTo: true,
      attachments: true,
      reactions: true,
    },
  });
  return NextResponse.json(updated);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handleEditMessage(req, context.params);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handleEditMessage(req, context.params);
}
