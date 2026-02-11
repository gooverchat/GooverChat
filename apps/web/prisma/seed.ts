import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const hash = await argon2.hash('DemoPassword123!', { type: argon2.argon2id });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      emailVerified: new Date(),
      username: 'alice',
      passwordHash: hash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      emailVerified: new Date(),
      username: 'bob',
      passwordHash: hash,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: alice.id },
    update: {},
    create: {
      userId: alice.id,
      displayName: 'Alice',
      bio: 'Hello from Alice',
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: bob.id },
    update: {},
    create: {
      userId: bob.id,
      displayName: 'Bob',
      bio: 'Hello from Bob',
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: alice.id },
    update: {},
    create: {
      userId: alice.id,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: bob.id },
    update: {},
    create: {
      userId: bob.id,
    },
  });

  const friendship = await prisma.friendship.upsert({
    where: {
      userId_friendId: { userId: alice.id, friendId: bob.id },
    },
    update: {},
    create: {
      userId: alice.id,
      friendId: bob.id,
      status: 'accepted',
    },
  });

  const conv = await prisma.conversation.upsert({
    where: { id: 'seed-dm-1' },
    update: {},
    create: {
      id: 'seed-dm-1',
      type: 'direct',
      lastMessageAt: new Date(),
    },
  });

  await prisma.conversationMember.createMany({
    data: [
      { conversationId: conv.id, userId: alice.id, role: 'owner' },
      { conversationId: conv.id, userId: bob.id, role: 'member' },
    ],
    skipDuplicates: true,
  });

  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderId: alice.id,
      type: 'text',
      text: 'Hello Bob! Welcome to GooverChat.',
    },
  });

  await prisma.conversationMember.updateMany({
    where: { conversationId: conv.id },
    data: { lastReadMessageId: msg.id, lastReadAt: new Date() },
  });

  console.log('Seed completed: alice@example.com, bob@example.com (password: DemoPassword123!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
