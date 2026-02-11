import { NextRequest, NextResponse } from 'next/server';
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
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null;
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  await prisma.pushSubscription.deleteMany({
    where: { userId: payload.sub, endpoint },
  });
  return NextResponse.json({ ok: true });
}
