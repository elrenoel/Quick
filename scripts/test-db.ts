import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  console.log("\n========================================");
  console.log("🔍 Yoohoo DB Connection Test (Neon PostgreSQL)");
  console.log("========================================\n");

  if (!dbUrl || dbUrl.trim() === "") {
    console.error("❌ ERROR: DATABASE_URL belum diatur di file .env.local.");
    console.error("👉 Silakan buka .env.local dan masukkan connection string Neon Anda:\n   DATABASE_URL=\"postgresql://user:password@host/dbname?sslmode=require\"\n");
    process.exit(1);
  }

  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`📡 Menghubungkan ke: ${maskedUrl}`);
  console.log("⏳ Menjalankan query uji koneksi...");

  try {
    const sql = neon(dbUrl);
    const result = await sql`SELECT NOW() as current_time, current_database() as db_name, version() as version;`;

    console.log("\n✅ KONEKSI DATABASE BERHASIL!");
    console.log(`🕒 Server Time   : ${result[0]?.current_time}`);
    console.log(`🗄️ Database Name : ${result[0]?.db_name}`);
    console.log(`📦 Postgres Info : ${result[0]?.version?.split(" ")[0]} (${result[0]?.version?.split(",")[0]})`);
    console.log("\n========================================\n");
  } catch (error) {
    console.error("\n❌ GAGAL TERHUBUNG KE DATABASE:");
    if (error instanceof Error) {
      console.error(`Pesan Error: ${error.message}`);
    } else {
      console.error(error);
    }
    console.error("\n💡 Tips: Pastikan connection string Neon valid dan memiliki ?sslmode=require.");
    console.log("\n========================================\n");
    process.exit(1);
  }
}

main();
