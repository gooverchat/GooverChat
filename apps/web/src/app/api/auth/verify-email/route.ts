import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailSchema } from '@gooverchat/shared';
import { prisma } from '@/src/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: parsed.data.token },
    include: { user: true },
  });
  if (!session) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  await prisma.user.update({
    where: { id: session.userId },
    data: { emailVerified: new Date() },
  });
  await prisma.session.delete({ where: { id: session.id } });
  return NextResponse.json({ message: 'Email verified' });
}
