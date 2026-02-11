import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 100);
  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';
  const notifications = await prisma.notification.findMany({
    where: { userId: payload.sub, ...(unreadOnly ? { readAt: null } : {}) },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(notifications);
}
