ALTER TABLE "quiz_attempts" ADD COLUMN "answers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
