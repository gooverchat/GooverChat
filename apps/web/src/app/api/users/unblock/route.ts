import { NextRequest, NextResponse } from 'next/server';
import { blockUserSchema } from '@gooverchat/shared';
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
  const parsed = blockUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  await prisma.blockedUser.deleteMany({
    where: { blockerId: payload.sub, blockedId: parsed.data.userId },
  });
  return NextResponse.json({ ok: true });
}
