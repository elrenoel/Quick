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

console.log("=== quiz_questions columns ===");
try {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'quiz_questions' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  for (const c of cols) {
    console.log(`  ${c.column_name}: ${c.data_type} | nullable=${c.is_nullable} | default=${c.column_default}`);
  }
} catch (e) {
  console.error("  FAILED:", e.message);
}

console.log("\n=== quiz_attempts columns ===");
try {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'quiz_attempts' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  for (const c of cols) {
    console.log(`  ${c.column_name}: ${c.data_type} | nullable=${c.is_nullable} | default=${c.column_default}`);
  }
} catch (e) {
  console.error("  FAILED:", e.message);
}

console.log("\n=== quiz_questions sample rows ===");
try {
  const rows = await sql`SELECT id, document_id, quiz_set_id, LEFT(question, 60) as q FROM quiz_questions LIMIT 5`;
  for (const r of rows) {
    console.log(`  id=${String(r.id).slice(0,8)} doc=${String(r.document_id).slice(0,8)} quiz_set_id=${r.quiz_set_id} q="${r.q}..."`);
  }
} catch (e) {
  console.error("  FAILED:", e.message);
}

console.log("\n=== quiz_attempts sample rows ===");
try {
  const rows = await sql`SELECT id, document_id, quiz_set_id, score, total FROM quiz_attempts LIMIT 5`;
  for (const r of rows) {
    console.log(`  id=${String(r.id).slice(0,8)} doc=${String(r.document_id).slice(0,8)} quiz_set_id=${r.quiz_set_id} score=${r.score}/${r.total}`);
  }
} catch (e) {
  console.error("  FAILED:", e.message);
}

console.log("\n=== distinct documents in quiz_questions ===");
try {
  const rows = await sql`SELECT DISTINCT document_id FROM quiz_questions`;
  console.log(`  ${rows.length} distinct document(s) have quiz_questions`);
} catch (e) {
  console.error("  FAILED:", e.message);
}
