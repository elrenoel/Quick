-- ============================================================
-- REMEDIATION: Apply migrations 0001 + 0002 that were recorded
-- in Drizzle journal but never actually executed in the database.
-- ============================================================

-- ── MIGRATION 0001: Add 'answers' column to quiz_attempts ──
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "answers" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- ── MIGRATION 0002: Create quiz_sets and link everything ──

-- 1. Create quiz_sets table (if not exists)
CREATE TABLE IF NOT EXISTS "quiz_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "label" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 2. Add quiz_set_id to quiz_attempts (nullable first)
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "quiz_set_id" uuid;

-- 3. Add quiz_set_id to quiz_questions (nullable first)
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "quiz_set_id" uuid;

-- 4. Backfill: Create "Set 1" for every document that has questions or attempts
INSERT INTO "quiz_sets" ("document_id", "label")
SELECT DISTINCT t.document_id, 'Set 1'
FROM (
    SELECT document_id FROM "quiz_questions"
    UNION
    SELECT document_id FROM "quiz_attempts"
) AS t
ON CONFLICT DO NOTHING;

-- 5. Link existing quiz_questions to their document's "Set 1"
UPDATE "quiz_questions" q
SET "quiz_set_id" = s.id
FROM "quiz_sets" s
WHERE q.document_id = s.document_id
  AND s.label = 'Set 1'
  AND q."quiz_set_id" IS NULL;

-- 6. Link existing quiz_attempts to their document's "Set 1"
UPDATE "quiz_attempts" a
SET "quiz_set_id" = s.id
FROM "quiz_sets" s
WHERE a.document_id = s.document_id
  AND s.label = 'Set 1'
  AND a."quiz_set_id" IS NULL;

-- 7. Add foreign key constraints
ALTER TABLE "quiz_sets"
  ADD CONSTRAINT IF NOT EXISTS "quiz_sets_document_id_documents_id_fk"
  FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "quiz_attempts"
  ADD CONSTRAINT IF NOT EXISTS "quiz_attempts_quiz_set_id_quiz_sets_id_fk"
  FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "quiz_questions"
  ADD CONSTRAINT IF NOT EXISTS "quiz_questions_quiz_set_id_quiz_sets_id_fk"
  FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id")
  ON DELETE cascade ON UPDATE no action;

-- 8. Now that all rows are backfilled, enforce NOT NULL
ALTER TABLE "quiz_attempts" ALTER COLUMN "quiz_set_id" SET NOT NULL;
ALTER TABLE "quiz_questions" ALTER COLUMN "quiz_set_id" SET NOT NULL;
