CREATE TABLE "quiz_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "quiz_set_id" uuid;
--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "quiz_set_id" uuid;
--> statement-breakpoint
-- Buat default "Set 1" untuk tiap dokumen yang sudah punya soal ATAU attempt
INSERT INTO "quiz_sets" ("document_id", "label")
SELECT DISTINCT t.document_id, 'Set 1'
FROM (
    SELECT document_id FROM "quiz_questions"
    UNION
    SELECT document_id FROM "quiz_attempts"
) AS t;
--> statement-breakpoint
-- Hubungkan soal lama ke set default dokumennya
UPDATE "quiz_questions" q
SET "quiz_set_id" = s.id
FROM "quiz_sets" s
WHERE q.document_id = s.document_id AND s.label = 'Set 1';
--> statement-breakpoint
-- Hubungkan attempt lama ke set default dokumennya
UPDATE "quiz_attempts" a
SET "quiz_set_id" = s.id
FROM "quiz_sets" s
WHERE a.document_id = s.document_id AND s.label = 'Set 1';
--> statement-breakpoint
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_set_id_quiz_sets_id_fk" FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_set_id_quiz_sets_id_fk" FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Setelah backfill selesai, kolom tidak boleh NULL lagi
ALTER TABLE "quiz_attempts" ALTER COLUMN "quiz_set_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quiz_questions" ALTER COLUMN "quiz_set_id" SET NOT NULL;
