-- CreateTable
CREATE TABLE "MessageDeletedForUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDeletedForUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageDeletedForUser_userId_messageId_key" ON "MessageDeletedForUser"("userId", "messageId");
CREATE INDEX "MessageDeletedForUser_userId_idx" ON "MessageDeletedForUser"("userId");
CREATE INDEX "MessageDeletedForUser_messageId_idx" ON "MessageDeletedForUser"("messageId");

-- AddForeignKey
ALTER TABLE "MessageDeletedForUser" ADD CONSTRAINT "MessageDeletedForUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageDeletedForUser" ADD CONSTRAINT "MessageDeletedForUser_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
