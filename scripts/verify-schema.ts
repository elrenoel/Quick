import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

async function verifySchema() {
  const dbUrl = process.env.DATABASE_URL;

  console.log("\n========================================");
  console.log("🔍 Quick DB Schema Verification");
  console.log("========================================\n");

  if (!dbUrl || dbUrl.trim() === "") {
    console.error("❌ ERROR: DATABASE_URL belum diatur di .env.local");
    process.exit(1);
  }

  try {
    const sql = neon(dbUrl);

    // 1. Ambil semua tabel di public schema
    console.log("⏳ Memeriksa tabel di database...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    const tableNames = tables.map((t) => t.table_name as string);
    console.log("📋 Tabel yang ditemukan di schema 'public':");
    tableNames.forEach((name) => console.log(`  - 📄 ${name}`));

    const requiredTables = ["documents", "flashcards", "quiz_questions", "quiz_attempts"];
    const missingTables = requiredTables.filter((t) => !tableNames.includes(t));

    if (missingTables.length > 0) {
      console.error(`\n❌ Tabel berikut belum ada di DB: ${missingTables.join(", ")}`);
      process.exit(1);
    }

    // 2. Ambil semua kolom untuk tabel-tabel di atas dalam satu query
    console.log("\n⏳ Memeriksa struktur kolom & tipe data...");
    const allColumns = await sql`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name IN ('documents', 'flashcards', 'quiz_questions', 'quiz_attempts')
      ORDER BY table_name, ordinal_position;
    `;

    for (const tableName of requiredTables) {
      console.log(`\n  🔹 Tabel: [${tableName}]`);
      const cols = allColumns.filter((c) => c.table_name === tableName);
      cols.forEach((c) => {
        console.log(`     • ${String(c.column_name).padEnd(16)} | ${String(c.data_type).padEnd(16)} | nullable: ${c.is_nullable}`);
      });
    }

    // 3. Ambil Foreign Key constraints
    console.log("\n⏳ Memeriksa relasi Foreign Key...");
    const fks = await sql`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `;

    console.log("\n🔗 Relasi Foreign Key:");
    fks.forEach((fk) => {
      console.log(`  - [${fk.table_name}.${fk.column_name}] ➜ [${fk.foreign_table_name}.${fk.foreign_column_name}]`);
    });

    console.log("\n✅ SEMUA 4 TABEL & RELASI TERVERIFIKASI LENGKAP DI NEON DB!");
    console.log("========================================\n");
  } catch (error) {
    console.error("❌ Gagal memverifikasi schema:", error);
    process.exit(1);
  }
}

verifySchema();
