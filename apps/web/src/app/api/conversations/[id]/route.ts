import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';

export async function GET(
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
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: payload.sub } },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  profile: { select: { displayName: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(member.conversation);
}
