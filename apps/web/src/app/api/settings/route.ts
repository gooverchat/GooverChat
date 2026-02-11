import { NextRequest, NextResponse } from 'next/server';
import { updateSettingsSchema } from '@gooverchat/shared';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const settings = await prisma.userSettings.findUnique({
    where: { userId: payload.sub },
  });
  if (!settings) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await requireAuth();
  const body = await req.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const data = parsed.data as Record<string, unknown>;
  const updated = await prisma.userSettings.upsert({
    where: { userId: payload.sub },
    create: { userId: payload.sub, ...data },
    update: data,
  });
  return NextResponse.json(updated);
}
