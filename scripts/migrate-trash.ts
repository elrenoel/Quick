import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL not set in .env.local");
    process.exit(1);
  }

  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`📡 Connecting to: ${maskedUrl}`);

  const sql = neon(dbUrl);

  const statements = [
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;',
    'ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "content_language" text DEFAULT \'auto\';',
  ];

  for (const stmt of statements) {
    console.log(`⏳ Running: ${stmt}`);
    await sql.query(stmt);
    console.log("✅ Done");
  }

  console.log("\n🎉 Migrations applied successfully!");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
