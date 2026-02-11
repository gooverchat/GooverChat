-- CreateTable
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageDelivery_messageId_userId_key" ON "MessageDelivery"("messageId", "userId");

-- CreateIndex
CREATE INDEX "MessageDelivery_messageId_idx" ON "MessageDelivery"("messageId");

-- CreateIndex
CREATE INDEX "MessageDelivery_userId_idx" ON "MessageDelivery"("userId");

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
