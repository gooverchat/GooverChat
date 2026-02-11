import { NextResponse } from 'next/server';
import { getAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function GET() {
  const payload = await getAuth();
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    id: user.id,
    username: user.username,
    displayName: user.profile?.displayName ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
  });
}
