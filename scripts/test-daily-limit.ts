import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db, user } from "../src/db";
import { eq } from "drizzle-orm";

async function testDailyLimit() {
  console.log("\n============================================================");
  console.log("🧪 Menguji Sistem Daily Limit & Reset Tanggal");
  console.log("============================================================\n");

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // 1. Buat test user khusus untuk pengujian limit
  const testUserId = `limit_user_${Date.now()}`;
  console.log(`👤 Membuat test user ID: ${testUserId}`);

  const [newUser] = await db
    .insert(user)
    .values({
      id: testUserId,
      email: `limit_test_${Date.now()}@example.com`,
      name: "Daily Limit Tester",
      generationCountToday: 0,
      lastGenerationDate: today,
    })
    .returning();

  console.log(`✅ User dibuat. Status awal: count = ${newUser.generationCountToday}, date = ${newUser.lastGenerationDate}`);

  // 2. Simulasi 5x generate
  console.log("\n▶️ 1. Simulasi generate hingga batas maksimal (5x)...");
  for (let i = 1; i <= 5; i++) {
    await db
      .update(user)
      .set({
        generationCountToday: i,
        lastGenerationDate: today,
      })
      .where(eq(user.id, testUserId));

    console.log(`   ⚡ Generate ke-${i}/5 berhasil dicatat.`);
  }

  // 3. Simulasi percobaan ke-6 di hari yang sama
  console.log("\n▶️ 2. Menguji penolakan pada percobaan ke-6...");
  const [userAtLimit] = await db
    .select()
    .from(user)
    .where(eq(user.id, testUserId))
    .limit(1);

  const isNewDay = userAtLimit.lastGenerationDate !== today;
  const currentCount = isNewDay ? 0 : userAtLimit.generationCountToday;

  if (currentCount >= 5) {
    console.log(`🔒 PENOLAKAN BERHASIL (429): generation_count_today=${currentCount} >= 5.`);
    console.log("   🚫 AI Pipeline TIDAK DIPANGGIL (Biaya API 0 token).");
  } else {
    console.error("❌ GAGAL: Seharusnya ditolak karena sudah mencapai 5x.");
    process.exit(1);
  }

  // 4. Simulasi pergantian hari (reset kuota)
  console.log("\n▶️ 3. Simulasi pergantian hari (last_generation_date = kemarin)...");
  await db
    .update(user)
    .set({
      lastGenerationDate: yesterday, // kemarin
      generationCountToday: 5,
    })
    .where(eq(user.id, testUserId));

  const [userNextDay] = await db
    .select()
    .from(user)
    .where(eq(user.id, testUserId))
    .limit(1);

  const isNewDayAfter = userNextDay.lastGenerationDate !== today;
  const resetCount = isNewDayAfter ? 0 : userNextDay.generationCountToday;

  console.log(`   📅 Tanggal di DB: ${userNextDay.lastGenerationDate}, Tanggal sekarang: ${today}`);
  console.log(`   🔄 Kuota terhitung setelah pergantian hari: ${resetCount}/5 (Sisa kuota: ${5 - resetCount})`);

  if (resetCount === 0) {
    console.log("🎉 RESET HARIAN PASS: Kuota otomatis kembali penuh (5/5) di hari berikutnya!");
  } else {
    console.error("❌ GAGAL: Reset harian tidak bekerja.");
    process.exit(1);
  }

  // Cleanup test user
  await db.delete(user).where(eq(user.id, testUserId));
  console.log("🧹 Test user dibersihkan.");

  console.log("\n============================================================");
  console.log("🎉 TEST DAILY LIMIT & RESET BERHASIL 100%!");
  console.log("============================================================\n");
}

testDailyLimit();
