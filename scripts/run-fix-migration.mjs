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

const migrationSQL = readFileSync(resolve("scripts/fix-migration.sql"), "utf-8");

// Split by semicolons, filter out empty/comment-only lines
const statements = migrationSQL
  .split(";")
  .map(s => s.replace(/^--.*$/gm, "").trim())
  .filter(s => s.length > 0);

console.log(`Running ${statements.length} SQL statements...\n`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const firstLine = stmt.split("\n")[0].slice(0, 80);
  process.stdout.write(`[${i + 1}/${statements.length}] ${firstLine}... `);
  try {
    // Use sql.query() for raw SQL strings (not tagged template)
    await sql.query(stmt);
    console.log("OK");
  } catch (e) {
    console.log(`FAILED: ${e.message}`);
  }
}

// Wait a moment for replication
await new Promise(r => setTimeout(r, 1000));

console.log("\n=== Verification ===");
try {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("Tables:", tables.map(r => r.table_name).join(", "));
} catch (e) {
  console.error("Table check failed:", e.message);
}

try {
  const result = await sql`SELECT COUNT(*) as count FROM quiz_sets`;
  console.log("quiz_sets rows:", result[0].count);
} catch (e) {
  console.error("quiz_sets check FAILED:", e.message);
}

try {
  const cols = await sql`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'quiz_questions' AND column_name = 'quiz_set_id'
  `;
  if (cols.length > 0) {
    console.log("quiz_questions.quiz_set_id: nullable=" + cols[0].is_nullable);
  }
} catch (e) {
  console.error("quiz_questions check failed:", e.message);
}

try {
  const cols = await sql`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'quiz_attempts' AND (column_name = 'quiz_set_id' OR column_name = 'answers')
    ORDER BY column_name
  `;
  for (const c of cols) {
    console.log(`quiz_attempts.${c.column_name}: nullable=${c.is_nullable}`);
  }
} catch (e) {
  console.error("quiz_attempts check failed:", e.message);
}

try {
  const orphans = await sql`
    SELECT d.id, d.title,
      (SELECT COUNT(*) FROM flashcards f WHERE f.document_id = d.id) as fc,
      (SELECT COUNT(*) FROM quiz_sets qs WHERE qs.document_id = d.id) as qs,
      (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.document_id = d.id) as qq
    FROM documents d
    WHERE EXISTS (SELECT 1 FROM flashcards f WHERE f.document_id = d.id)
    ORDER BY d.created_at DESC LIMIT 5
  `;
  console.log("\nDocuments overview:");
  for (const r of orphans) {
    console.log(`  "${r.title}": flashcards=${r.fc}, quiz_sets=${r.qs}, questions=${r.qq}`);
  }
} catch (e) {
  console.error("Document check failed:", e.message);
}
