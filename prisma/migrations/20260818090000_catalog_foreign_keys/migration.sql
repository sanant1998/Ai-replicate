-- Real foreign keys for the catalog columns that were plain strings.
--
-- `Subscription.classLevelId` and both of `Payment`'s catalog columns had no
-- constraint at all, so deleting a class left live subscriptions pointing at
-- nothing — rows getEntitlements still reads, granting access to a class that
-- is no longer in the catalog. `Subscription.courseId` had the opposite
-- problem: ON DELETE CASCADE meant removing a course silently destroyed the
-- subscriptions people had paid for it.

-- Anything already dangling is nulled first, or the constraints cannot be
-- added. A CLASS subscription with no class grants nothing, which is the right
-- answer for a pointer that has lost its target.
UPDATE "Subscription" SET "classLevelId" = NULL
 WHERE "classLevelId" IS NOT NULL
   AND "classLevelId" NOT IN (SELECT "id" FROM "ClassLevel");

UPDATE "Payment" SET "classLevelId" = NULL
 WHERE "classLevelId" IS NOT NULL
   AND "classLevelId" NOT IN (SELECT "id" FROM "ClassLevel");

UPDATE "Payment" SET "courseId" = NULL
 WHERE "courseId" IS NOT NULL
   AND "courseId" NOT IN (SELECT "id" FROM "Course");

-- Subscription: Cascade -> Restrict, and a constraint where there was none.
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_courseId_fkey";

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_classLevelId_fkey"
  FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payment: keep the financial record, drop the pointer.
CREATE INDEX "Payment_courseId_idx" ON "Payment"("courseId");
CREATE INDEX "Payment_classLevelId_idx" ON "Payment"("classLevelId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_classLevelId_fkey"
  FOREIGN KEY ("classLevelId") REFERENCES "ClassLevel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
