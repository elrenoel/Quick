import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db, user, account } from "../src/db";
import { eq } from "drizzle-orm";

async function testGoogleAuthSchema() {
  console.log("\n============================================================");
  console.log("🧪 Menguji Schema & Default Quota untuk Google OAuth");
  console.log("============================================================\n");

  const oauthUserId = `oauth_google_${Date.now()}`;
  const oauthEmail = `tester_google_${Date.now()}@gmail.com`;

  console.log(`👤 1. Simulasi registrasi user via Google OAuth (${oauthEmail})...`);

  // 1. Insert user tanpa password (OAuth profile)
  const [createdUser] = await db
    .insert(user)
    .values({
      id: oauthUserId,
      name: "Google OAuth Tester",
      email: oauthEmail,
      image: "https://lh3.googleusercontent.com/a/default-user",
      emailVerified: true,
      // generationCountToday bernilai default 0 di schema
    })
    .returning();

  console.log(`   ✅ User tersimpan: ID ${createdUser.id}, emailVerified: ${createdUser.emailVerified}`);
  console.log(`   ⚡ generationCountToday: ${createdUser.generationCountToday} (Wajib 0)`);
  console.log(`   📅 lastGenerationDate: ${createdUser.lastGenerationDate ?? "null (Hari baru)"}`);

  // 2. Insert account OAuth (providerId: "google", password: null)
  console.log("\n👤 2. Menyimpan data account OAuth Google (password = null)...");
  const [createdAccount] = await db
    .insert(account)
    .values({
      id: `acc_google_${Date.now()}`,
      accountId: `google_sub_id_${Date.now()}`,
      providerId: "google",
      userId: createdUser.id,
      password: null, // Nullable untuk OAuth!
      accessToken: "mock_access_token",
    })
    .returning();

  console.log(`   ✅ Account tersimpan: ID ${createdAccount.id}, providerId: ${createdAccount.providerId}, password: ${createdAccount.password}`);

  // 3. Simulasi pengecekan kuota harian untuk user baru OAuth
  console.log("\n👤 3. Verifikasi perhitungan kuota generate pertama...");
  const today = new Date().toISOString().split("T")[0];
  const isNewDay = createdUser.lastGenerationDate !== today;
  const currentCount = isNewDay ? 0 : createdUser.generationCountToday;
  const remainingToday = Math.max(0, 5 - currentCount);

  console.log(`   📊 Sisa kuota hari ini: ${remainingToday}/5`);

  if (remainingToday === 5 && currentCount === 0 && createdAccount.password === null) {
    console.log("🔒 VERIFIKASI PASS: User Google OAuth memiliki kuota penuh 5/5 & password nullable tanpa error!");
  } else {
    console.error("❌ GAGAL: Verifikasi kuota / schema OAuth tidak sesuai.");
    process.exit(1);
  }

  // Cleanup test records
  await db.delete(account).where(eq(account.id, createdAccount.id));
  await db.delete(user).where(eq(user.id, createdUser.id));
  console.log("🧹 Test user & account dibersihkan.");

  console.log("\n============================================================");
  console.log("🎉 TEST GOOGLE OAUTH SCHEMA & QUOTA SUKSES 100%!");
  console.log("============================================================\n");
}

testGoogleAuthSchema();
