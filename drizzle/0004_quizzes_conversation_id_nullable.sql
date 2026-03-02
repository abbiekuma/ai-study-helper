-- Allow quizzes.conversation_id to be NULL so saved quizzes can be kept when chat is deleted
ALTER TABLE "quizzes" ALTER COLUMN "conversation_id" DROP NOT NULL;
