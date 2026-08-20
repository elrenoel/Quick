/**
 * Script to find orphaned documents — documents that have flashcards but
 * no quiz_sets (caused by the non-atomic generate bug before this fix).
 *
 * Usage: npx tsx scripts/check-orphaned.ts
 */
import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Please check .env.local");
  process.exit(1);
}

const neonSql = neon(databaseUrl);

async function main() {
  console.log("Mencari dokumen orphan (ada flashcard TANPA quiz_sets)...\n");

  const result = await neonSql`
    SELECT
      d.id,
      d.title,
      d.created_at,
      d.user_id,
      (SELECT COUNT(*) FROM flashcards f WHERE f.document_id = d.id) AS flashcard_count,
      (SELECT COUNT(*) FROM quiz_sets qs WHERE qs.document_id = d.id) AS quiz_set_count,
      (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.document_id = d.id) AS quiz_question_count
    FROM documents d
    WHERE EXISTS (SELECT 1 FROM flashcards f WHERE f.document_id = d.id)
      AND NOT EXISTS (SELECT 1 FROM quiz_sets qs WHERE qs.document_id = d.id)
    ORDER BY d.created_at DESC
  `;

  if (result.length === 0) {
    console.log("Tidak ada dokumen orphan ditemukan! Semua dokumen punya quiz.");
    return;
  }

  console.log(`Ditemukan ${result.length} dokumen orphan:\n`);
  console.log("-".repeat(100));

  for (const row of result) {
    console.log(`ID:         ${row.id}`);
    console.log(`Judul:      ${row.title}`);
    console.log(`Dibuat:     ${row.created_at}`);
    console.log(`User ID:    ${row.user_id}`);
    console.log(`Flashcards: ${row.flashcard_count} | Quiz Sets: ${row.quiz_set_count} | Quiz Questions: ${row.quiz_question_count}`);
    console.log("-".repeat(100));
  }

  console.log(`\nRingkasan: ${result.length} dokumen perlu diperbaiki.`);
  console.log("Opsi perbaikan:");
  console.log("  1. Generate ulang quiz untuk dokumen ini (rekomendasi)");
  console.log("  2. Hapus dokumen yang tidak terpakai");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
