-- Somewhere for the refund the terms promise to be asked for.
--
-- /terms offers a full refund within seven days of purchase. Until now the only
-- way to claim it was to email someone and hope they issued it by hand in the
-- Razorpay dashboard, which is a promise with no mechanism behind it.

CREATE TYPE "RefundRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'SENT');

CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status", "createdAt");
CREATE INDEX "RefundRequest_userId_createdAt_idx" ON "RefundRequest"("userId", "createdAt");
CREATE INDEX "RefundRequest_paymentId_idx" ON "RefundRequest"("paymentId");

ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
