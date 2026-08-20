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
    process.env[key] = val.startsWith('"') && val.endsWith('"') ? val.slice(1, -1) : val;
  }
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

let pass = 0;
let fail = 0;

function check(name, ok) {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

// 1. Tables exist
console.log("=== 1. Tables ===");
const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
const tableNames = tables.map(r => r.table_name);
check("quiz_sets exists", tableNames.includes("quiz_sets"));
check("quiz_questions exists", tableNames.includes("quiz_questions"));
check("quiz_attempts exists", tableNames.includes("quiz_attempts"));

// 2. quiz_sets structure
console.log("\n=== 2. quiz_sets structure ===");
const qsCols = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'quiz_sets' ORDER BY ordinal_position`;
const qsColNames = qsCols.map(c => c.column_name);
check("has id column", qsColNames.includes("id"));
check("has document_id column", qsColNames.includes("document_id"));
check("has label column", qsColNames.includes("label"));
check("has created_at column", qsColNames.includes("created_at"));

// 3. quiz_questions.quiz_set_id
console.log("\n=== 3. quiz_questions.quiz_set_id ===");
const qqCol = await sql`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'quiz_questions' AND column_name = 'quiz_set_id'`;
check("quiz_set_id exists", qqCol.length > 0);
check("quiz_set_id is NOT NULL", qqCol.length > 0 && qqCol[0].is_nullable === "NO");

// 4. quiz_attempts.quiz_set_id and answers
console.log("\n=== 4. quiz_attempts columns ===");
const qaQuizSet = await sql`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'quiz_attempts' AND column_name = 'quiz_set_id'`;
check("quiz_set_id exists", qaQuizSet.length > 0);
check("quiz_set_id is NOT NULL", qaQuizSet.length > 0 && qaQuizSet[0].is_nullable === "NO");
const qaAnswers = await sql`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'quiz_attempts' AND column_name = 'answers'`;
check("answers column exists", qaAnswers.length > 0);

// 5. FK constraints
console.log("\n=== 5. Foreign key constraints ===");
const fks = await sql`SELECT conname FROM pg_constraint WHERE conname LIKE '%quiz%' ORDER BY conname`;
const fkNames = fks.map(r => r.conname);
check("quiz_sets FK to documents", fkNames.includes("quiz_sets_document_id_documents_id_fk"));
check("quiz_attempts FK to quiz_sets", fkNames.includes("quiz_attempts_quiz_set_id_quiz_sets_id_fk"));
check("quiz_questions FK to quiz_sets", fkNames.includes("quiz_questions_quiz_set_id_quiz_sets_id_fk"));

// 6. Data integrity
console.log("\n=== 6. Data integrity ===");
const qsCount = await sql`SELECT COUNT(*) as c FROM quiz_sets`;
check("quiz_sets has rows", qsCount[0].c > 0);
console.log(`    (${qsCount[0].c} quiz sets found)`);

const qqNull = await sql`SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_set_id IS NULL`;
check("no quiz_questions with NULL quiz_set_id", qqNull[0].c === 0);

const qaNull = await sql`SELECT COUNT(*) as c FROM quiz_attempts WHERE quiz_set_id IS NULL`;
check("no quiz_attempts with NULL quiz_set_id", qaNull[0].c === 0);

// 7. Simulate the actual GET /api/documents/:id/quiz query
console.log("\n=== 7. Simulate GET /api/documents/:id/quiz ===");
const docs = await sql`SELECT id, title FROM documents ORDER BY created_at DESC LIMIT 3`;
for (const doc of docs) {
  const sets = await sql`SELECT id, label, created_at FROM quiz_sets WHERE document_id = ${doc.id} ORDER BY created_at ASC`;
  if (sets.length === 0) {
    console.log(`  "${doc.title}": no quiz_sets (will return empty quiz)`);
    continue;
  }
  const selectedSet = sets[0];
  const questions = await sql`SELECT id, question, options FROM quiz_questions WHERE document_id = ${doc.id} AND quiz_set_id = ${selectedSet.id}`;
  console.log(`  "${doc.title}": ${sets.length} set(s), "${selectedSet.label}" has ${questions.length} questions ✅`);
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (fail === 0) console.log("All checks passed! Migration fix is complete.");
