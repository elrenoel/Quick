import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import https from "node:https";
import { neon, neonConfig } from "@neondatabase/serverless";

// Konfigurasi IPv4 fetch untuk Node.js environment
neonConfig.fetchFunction = (
  url: string | URL | Request,
  options?: RequestInit & { headers?: Record<string, string> }
) => {
  return new Promise((resolve, reject) => {
    const parsedUrl =
      typeof url === "string"
        ? new URL(url)
        : url instanceof URL
        ? url
        : new URL(url.url);
    const req = https.request(
      parsedUrl,
      {
        method: options?.method || "POST",
        headers: options?.headers,
        family: 4,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          resolve({
            ok: res.statusCode
              ? res.statusCode >= 200 && res.statusCode < 300
              : false,
            status: res.statusCode || 200,
            statusText: res.statusMessage || "OK",
            json: async () => JSON.parse(body),
            text: async () => body,
            headers: new Headers(res.headers as Record<string, string>),
          } as unknown as Response);
        });
      }
    );
    req.on("error", reject);
    if (options?.body) {
      req.write(options.body);
    }
    req.end();
  });
};

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL tidak ditemukan di .env.local");
    process.exit(1);
  }

  console.log("\n============================================================");
  console.log("🚀 Menjalankan Migrasi Database Stage 6.5 (Better Auth)");
  console.log("============================================================\n");

  const sql = neon(databaseUrl);

  try {
    // 1. Buat Tabel "user"
    console.log("1. Membuat tabel 'user'...");
    await sql`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "email_verified" BOOLEAN NOT NULL DEFAULT false,
        "image" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "generation_count_today" INTEGER NOT NULL DEFAULT 0,
        "last_generation_date" TEXT
      );
    `;

    await sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS "generation_count_today" INTEGER NOT NULL DEFAULT 0;
    `;
    await sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS "last_generation_date" TEXT;
    `;

    // 2. Buat Tabel "session"
    console.log("2. Membuat tabel 'session'...");
    await sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "id" TEXT PRIMARY KEY,
        "expires_at" TIMESTAMP NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "ip_address" TEXT,
        "user_agent" TEXT,
        "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
      );
    `;

    // 3. Buat Tabel "account"
    console.log("3. Membuat tabel 'account'...");
    await sql`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" TEXT PRIMARY KEY,
        "account_id" TEXT NOT NULL,
        "provider_id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "access_token" TEXT,
        "refresh_token" TEXT,
        "id_token" TEXT,
        "access_token_expires_at" TIMESTAMP,
        "refresh_token_expires_at" TIMESTAMP,
        "scope" TEXT,
        "password" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 4. Buat Tabel "verification"
    console.log("4. Membuat tabel 'verification'...");
    await sql`
      CREATE TABLE IF NOT EXISTS "verification" (
        "id" TEXT PRIMARY KEY,
        "identifier" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );
    `;

    // 5. Menyesuaikan tabel "documents" dengan user_id
    console.log("5. Menyesuaikan tabel 'documents' dengan kolom 'user_id'...");
    const cols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' AND column_name = 'user_id';
    `;

    if (cols.length === 0) {
      await sql`TRUNCATE TABLE "documents" CASCADE;`;
      await sql`
        ALTER TABLE "documents" 
        ADD COLUMN "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE;
      `;
    }

    console.log("\n============================================================");
    console.log("✅ MIGRASI DATABASE STAGE 6.5 BERHASIL LENGKAP!");
    console.log("   - Tabel 'user' (dengan generation_count_today & last_generation_date)");
    console.log("   - Tabel 'session', 'account', 'verification'");
    console.log("   - Tabel 'documents' (dengan foreign key 'user_id' NOT NULL)");
    console.log("============================================================\n");
  } catch (error) {
    console.error("❌ Gagal migrasi:", error);
    process.exit(1);
  }
}

runMigration();
