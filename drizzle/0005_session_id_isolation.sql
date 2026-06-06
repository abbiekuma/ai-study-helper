ALTER TABLE "conversations" ADD COLUMN "session_id" text;
UPDATE "conversations" SET "session_id" = 'legacy-migration' WHERE "session_id" IS NULL;
ALTER TABLE "conversations" ALTER COLUMN "session_id" SET NOT NULL;

ALTER TABLE "quizzes" ADD COLUMN "session_id" text;
UPDATE "quizzes" q SET "session_id" = c."session_id"
FROM "conversations" c
WHERE q."conversation_id" = c."id" AND q."session_id" IS NULL;
UPDATE "quizzes" SET "session_id" = 'legacy-migration' WHERE "session_id" IS NULL;
ALTER TABLE "quizzes" ALTER COLUMN "session_id" SET NOT NULL;
