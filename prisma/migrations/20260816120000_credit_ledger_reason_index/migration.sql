-- CreateIndex
-- Supports the deployment-wide daily tutor budget, which counts today's
-- TUTOR_MESSAGE rows across all accounts on every tutor request. The existing
-- (userId, createdAt) index cannot serve that query, and the ledger is
-- append-only, so without this the guard gets slower every day it protects.
CREATE INDEX "CreditLedger_reason_createdAt_idx" ON "CreditLedger"("reason", "createdAt");
