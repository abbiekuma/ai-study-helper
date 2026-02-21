CREATE TABLE "quiz_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"title" text NOT NULL,
	"options" text NOT NULL,
	"correct_answer" text NOT NULL,
	"question_order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_answer" text,
	"score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;