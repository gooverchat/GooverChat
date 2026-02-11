import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function GET(req: NextRequest) {
  let payload: { sub: string };
  try {
    payload = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query min 2 characters' }, { status: 400 });
  }
  const users = await prisma.user.findMany({
    where: {
      id: { not: payload.sub },
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 20,
    select: {
      id: true,
      username: true,
      email: true,
      profile: { select: { displayName: true, avatarUrl: true, bio: true } },
    },
  });
  return NextResponse.json(users);
}
