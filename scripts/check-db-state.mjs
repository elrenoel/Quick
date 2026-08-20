import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      process.env[key] = val.slice(1, -1);
    } else {
      process.env[key] = val;
    }
  }
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

console.log("=== 1. Checking database tables ===");
try {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("Tables found:", tables.map(r => r.table_name).join(", "));
} catch (e) {
  console.error("Failed to list tables:", e.message);
}

console.log("\n=== 2. Checking quiz_sets table ===");
try {
  const result = await sql`SELECT COUNT(*) as count FROM quiz_sets`;
  console.log("quiz_sets rows:", result[0].count);
} catch (e) {
  console.error("quiz_sets query FAILED:", e.message);
}

console.log("\n=== 3. Checking quiz_questions table ===");
try {
  const result = await sql`SELECT COUNT(*) as count FROM quiz_questions`;
  console.log("quiz_questions rows:", result[0].count);
} catch (e) {
  console.error("quiz_questions query FAILED:", e.message);
}

console.log("\n=== 4. Documents with flashcards but NO quiz_sets ===");
try {
  const orphans = await sql`
    SELECT d.id, d.title, 
      (SELECT COUNT(*) FROM flashcards f WHERE f.document_id = d.id) as flashcard_count,
      (SELECT COUNT(*) FROM quiz_sets qs WHERE qs.document_id = d.id) as quizset_count,
      (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.document_id = d.id) as question_count
    FROM documents d
    WHERE EXISTS (SELECT 1 FROM flashcards f WHERE f.document_id = d.id)
    ORDER BY d.created_at DESC
    LIMIT 10
  `;
  if (orphans.length === 0) {
    console.log("  (no documents with flashcards found)");
  }
  for (const row of orphans) {
    const flag = row.quizset_count === 0 ? " *** ORPHAN (no quiz_sets!) ***" : "";
    console.log(`  Doc "${row.title}" (${String(row.id).slice(0,8)}...): flashcards=${row.flashcard_count}, quiz_sets=${row.quizset_count}, questions=${row.question_count}${flag}`);
  }
} catch (e) {
  console.error("Orphan check FAILED:", e.message);
}

console.log("\n=== 5. Simulating GET /api/documents/:id/quiz for first doc ===");
try {
  const docs = await sql`SELECT id, title FROM documents ORDER BY created_at DESC LIMIT 1`;
  if (docs.length === 0) {
    console.log("  No documents found");
  } else {
    const doc = docs[0];
    console.log(`  Testing doc: "${doc.title}" (${doc.id})`);
    
    const sets = await sql`SELECT id, label, created_at FROM quiz_sets WHERE document_id = ${doc.id} ORDER BY created_at ASC`;
    console.log(`  quiz_sets found: ${sets.length}`);
    
    if (sets.length > 0) {
      const selectedSet = sets[0];
      const questions = await sql`SELECT id, question, options FROM quiz_questions WHERE document_id = ${doc.id} AND quiz_set_id = ${selectedSet.id}`;
      console.log(`  Questions in "${selectedSet.label}": ${questions.length}`);
    }
  }
} catch (e) {
  console.error("Simulated quiz query FAILED:", e.message);
}
