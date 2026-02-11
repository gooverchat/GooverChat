import { notFound } from 'next/navigation';
import { prisma } from '@/src/lib/db';
import { PrintMessageView } from './PrintMessageView';

export default async function PrintMessagePage({
  params,
}: {
  params: Promise<{ messageId: string }>;
}) {
  const { messageId } = await params;
  const message = await prisma.message.findUnique({
    where: { id: messageId, deletedAt: null },
    include: {
      sender: { select: { username: true, profile: { select: { displayName: true } } } },
      replyTo: { select: { text: true, createdAt: true } },
      conversation: { select: { name: true, type: true } },
    },
  });
  if (!message) notFound();
  return <PrintMessageView message={message} />;
}
