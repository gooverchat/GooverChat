import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const list = await prisma.blockedUser.findMany({
    where: { blockerId: payload.sub },
    include: {
      blocked: {
        select: {
          id: true,
          username: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
  });
  return NextResponse.json(list.map((l) => l.blocked));
}
