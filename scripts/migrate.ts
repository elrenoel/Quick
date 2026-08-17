import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import * as fs from "node:fs";
import * as path from "node:path";

dotenv.config({ path: ".env.local" });

async function runMigrate() {
  const dbUrl = process.env.DATABASE_URL;

  console.log("\n========================================");
  console.log("🚀 Quick DB Migration Runner (Neon PostgreSQL)");
  console.log("========================================\n");

  if (!dbUrl || dbUrl.trim() === "") {
    console.error("❌ ERROR: DATABASE_URL belum diatur di .env.local");
    process.exit(1);
  }

  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`📡 Menghubungkan ke: ${maskedUrl}`);

  try {
    const sql = neon(dbUrl);
    const drizzleDir = path.join(process.cwd(), "drizzle");
    const sqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`📁 Ditemukan ${sqlFiles.length} file migrasi SQL di folder 'drizzle':`);
    sqlFiles.forEach((f) => console.log(`  - 📜 ${f}`));

    for (const file of sqlFiles) {
      console.log(`\n⏳ Mengeksekusi ${file}...`);
      const filePath = path.join(drizzleDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf-8");

      // Pisahkan query berdasarkan breakpoint Drizzle (--> statement-breakpoint)
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        // Execute raw SQL statement safely
        await (sql as unknown as (query: string) => Promise<unknown>)(statement);
      }
      console.log(`✅ ${file} berhasil dieksekusi!`);
    }

    console.log("\n========================================");
    console.log("🎉 SEMUA MIGRASI BERHASIL DITERAPKAN KE NEON DB!");
    console.log("========================================\n");
  } catch (error) {
    console.error("\n❌ GAGAL MENJALANKAN MIGRASI:");
    if (error instanceof Error) {
      console.error(`Pesan: ${error.message}`);
    } else {
      console.error(error);
    }
    console.log("\n========================================\n");
    process.exit(1);
  }
}

runMigrate();
