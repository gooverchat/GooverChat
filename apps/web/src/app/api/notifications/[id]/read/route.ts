import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const { id } = await params;
  await prisma.notification.updateMany({
    where: { id, userId: payload.sub },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
