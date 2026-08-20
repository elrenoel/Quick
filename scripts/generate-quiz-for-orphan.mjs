import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local
const envPath = resolve(".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val.startsWith('"') && val.endsWith('"') ? val.slice(1, -1) : val;
  }
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL, { fetchConnectionCache: true });

// Retry wrapper for flaky Neon connections
async function withRetry(fn, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries - 1) throw e;
      console.log(`  (retry ${i + 1}/${retries} after ${delayMs}ms...)`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

const ORPHAN_DOC_ID = "3629fa1f-fa82-4bd2-afc3-ec939074b499";

// 1. Fetch the document
console.log("=== 1. Fetching orphan document ===");
const docs = await withRetry(() => sql`SELECT id, title, raw_text FROM documents WHERE id = ${ORPHAN_DOC_ID}`);
if (docs.length === 0) {
  console.error("Document not found!");
  process.exit(1);
}
const doc = docs[0];
console.log(`  Title: "${doc.title}"`);
console.log(`  rawText length: ${doc.raw_text.length} chars`);

// 2. Generate quiz questions using the AI module
console.log("\n=== 2. Generating quiz questions via AI ===");
const { generateQuizQuestions } = await import("../src/lib/ai.ts");
const aiResult = await generateQuizQuestions(doc.raw_text);
console.log(`  Generated ${aiResult.quiz.length} questions`);
console.log(`  Model: ${aiResult.usedModel}`);
console.log(`  Latency: ${aiResult.latencyMs}ms`);

if (aiResult.quiz.length === 0) {
  console.error("AI returned 0 questions. Aborting.");
  process.exit(1);
}

// Show first question as sample
const sample = aiResult.quiz[0];
console.log(`\n  Sample question: "${sample.question.slice(0, 80)}..."`);
console.log(`  Options: ${sample.options.length}`);
console.log(`  Correct index: ${sample.correct_index}`);

// 3. Create quiz_set and insert questions
console.log("\n=== 3. Saving to database ===");

// Check existing sets first
const existingSets = await withRetry(() => sql`SELECT id, label FROM quiz_sets WHERE document_id = ${ORPHAN_DOC_ID}`);
const label = `Set ${existingSets.length + 1}`;
console.log(`  Creating quiz_set: "${label}"`);

// Insert quiz_set
const [quizSet] = await withRetry(() => sql`INSERT INTO quiz_sets (document_id, label) VALUES (${ORPHAN_DOC_ID}, ${label}) RETURNING id`);
console.log(`  quiz_set id: ${quizSet.id}`);

// Insert questions
let insertedCount = 0;
for (const q of aiResult.quiz) {
  await withRetry(() => sql`INSERT INTO quiz_questions (document_id, quiz_set_id, question, options, correct_index) VALUES (${ORPHAN_DOC_ID}, ${quizSet.id}, ${q.question}, ${JSON.stringify(q.options)}, ${q.correct_index})`);
  insertedCount++;
  process.stdout.write(`  Inserted ${insertedCount}/${aiResult.quiz.length}\r`);
}
console.log(`\n  Inserted ${insertedCount} questions`);

// 4. Verify
console.log("\n=== 4. Verification ===");
await new Promise(r => setTimeout(r, 1000));
const verifySets = await withRetry(() => sql`SELECT id, label FROM quiz_sets WHERE document_id = ${ORPHAN_DOC_ID}`);
console.log(`  Quiz sets: ${verifySets.length}`);
for (const s of verifySets) {
  const count = await withRetry(() => sql`SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_set_id = ${s.id}`);
  console.log(`    "${s.label}": ${count[0].c} questions`);
}

console.log("\nDone! The orphan document now has quiz data.");
