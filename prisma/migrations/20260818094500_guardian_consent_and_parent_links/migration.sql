-- Parent/guardian consent that involves the parent.
--
-- Signup already required the child to tick "I have a parent's permission",
-- which is exactly as easy for the child to tick as it is for the parent. The
-- DPDP Act 2023 asks for verifiable consent for a data principal under 18, and
-- every student on this platform is one. A link mailed to an address the child
-- names is weaker than an ID check and much stronger than a checkbox.

ALTER TABLE "User" ADD COLUMN "guardianEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianConsentAt" TIMESTAMP(3);

CREATE TABLE "GuardianConsentToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianConsentToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianConsentToken_tokenHash_key" ON "GuardianConsentToken"("tokenHash");
CREATE INDEX "GuardianConsentToken_userId_idx" ON "GuardianConsentToken"("userId");

ALTER TABLE "GuardianConsentToken" ADD CONSTRAINT "GuardianConsentToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The read-only family view. The PARENT role existed in the enum from the
-- start and nothing ever created one, because there was no way for a parent to
-- be attached to a child.
CREATE TABLE "ParentLink" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentLink_parentId_studentId_key" ON "ParentLink"("parentId", "studentId");
CREATE INDEX "ParentLink_studentId_idx" ON "ParentLink"("studentId");

ALTER TABLE "ParentLink" ADD CONSTRAINT "ParentLink_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentLink" ADD CONSTRAINT "ParentLink_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
