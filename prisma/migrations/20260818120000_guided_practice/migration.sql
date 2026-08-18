-- Guided practice: a topic-locked tutor that answers only from material the
-- staff supplied, gives the client's own answer where one is on file, and hands
-- the working over one step at a time.
--
-- Three separable pieces, in one migration because none of them is useful
-- alone: somewhere to put the material (Topic.content, TopicAnswer), a shape
-- for a stepped answer to be stored in (ChatMessage.steps, ChatSession.topicId,
-- the GUIDED mode), and an account that can see this and nothing else
-- (User.testMode).

ALTER TYPE "ChatMode" ADD VALUE 'GUIDED';

ALTER TABLE "Topic" ADD COLUMN "content" TEXT;

CREATE TABLE "TopicAnswer" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TopicAnswer_topicId_index_key" ON "TopicAnswer"("topicId", "index");
CREATE INDEX "TopicAnswer_topicId_index_idx" ON "TopicAnswer"("topicId", "index");

ALTER TABLE "TopicAnswer" ADD CONSTRAINT "TopicAnswer_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull, matching chapterId: deleting a topic must not delete the
-- conversations a student had about it, but the session has to stop claiming a
-- grounding it no longer has.
ALTER TABLE "ChatSession" ADD COLUMN "topicId" TEXT;

ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ChatSession_userId_topicId_updatedAt_idx"
  ON "ChatSession"("userId", "topicId", "updatedAt");

ALTER TABLE "ChatMessage" ADD COLUMN "steps" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "User" ADD COLUMN "testMode" BOOLEAN NOT NULL DEFAULT false;
