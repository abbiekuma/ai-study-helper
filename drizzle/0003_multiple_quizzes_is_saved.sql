-- Create quizzes table (one row per "考我" generation; one conversation has many quizzes)
CREATE TABLE IF NOT EXISTS "quizzes" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_saved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Add quiz_id to quiz_questions (nullable for backfill)
ALTER TABLE "quiz_questions" ADD COLUMN "quiz_id" integer;
--> statement-breakpoint
-- Backfill: one quiz per distinct conversation that has quiz_questions
INSERT INTO "quizzes" ("conversation_id", "is_saved")
SELECT DISTINCT "conversation_id", false FROM "quiz_questions";
--> statement-breakpoint
UPDATE "quiz_questions" q
SET "quiz_id" = (SELECT qz."id" FROM "quizzes" qz WHERE qz."conversation_id" = q."conversation_id" ORDER BY qz."id" LIMIT 1);
--> statement-breakpoint
ALTER TABLE "quiz_questions" DROP CONSTRAINT IF EXISTS "quiz_questions_conversation_id_conversations_id_fk";
--> statement-breakpoint
ALTER TABLE "quiz_questions" DROP COLUMN "conversation_id";
--> statement-breakpoint
ALTER TABLE "quiz_questions" ALTER COLUMN "quiz_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
