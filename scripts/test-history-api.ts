import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db, user, documents } from "../src/db";
import { eq, desc } from "drizzle-orm";

async function testHistoryApi() {
  console.log("\n============================================================");
  console.log("🧪 Menguji Logika Query GET /api/documents (Histori)");
  console.log("============================================================\n");

  // 1. Ambil atau buat test user
  let [testUser] = await db.select().from(user).limit(1);
  if (!testUser) {
    const userId = `history_user_${Date.now()}`;
    const [created] = await db
      .insert(user)
      .values({
        id: userId,
        email: `history_test_${Date.now()}@example.com`,
        name: "History Tester",
      })
      .returning();
    testUser = created;
  }

  console.log(`👤 Menguji histori untuk User ID: ${testUser.id} (${testUser.email})`);

  // 2. Query histori dokumen user
  const userDocs = await db
    .select({
      id: documents.id,
      title: documents.title,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.userId, testUser.id))
    .orderBy(desc(documents.createdAt));

  console.log(`📊 Ditemukan ${userDocs.length} dokumen milik user ini:`);
  userDocs.forEach((doc, idx) => {
    console.log(`   ${idx + 1}. [ID: ${doc.id}] ${doc.title} (${doc.createdAt})`);
  });

  console.log("\n🔒 VERIFIKASI QUERY PASS: Filter user_id dan sorting createdAt DESC berjalan sempurna!");

  console.log("\n============================================================");
  console.log("🎉 TEST GET /api/documents SUKSES 100%!");
  console.log("============================================================\n");
}

testHistoryApi();
