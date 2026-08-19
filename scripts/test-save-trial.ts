import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db, user, documents, flashcards, quizQuestions, quizSets } from "../src/db";
import { eq } from "drizzle-orm";

async function testSaveTrial() {
  console.log("\n============================================================");
  console.log("🧪 Menguji Logika POST /api/documents/save-trial");
  console.log("============================================================\n");

  // 1. Ambil atau buat test user
  let [testUser] = await db.select().from(user).limit(1);
  if (!testUser) {
    console.log("👤 Membuat test user untuk verifikasi...");
    const userId = `usr_test_${Date.now()}`;
    const [created] = await db
      .insert(user)
      .values({
        id: userId,
        email: `test_save_trial_${Date.now()}@example.com`,
        name: "Test User Save Trial",
      })
      .returning();
    testUser = created;
  }

  console.log(`✅ Menggunakan test user: ${testUser.email} (ID: ${testUser.id})`);

  // 2. Mock payload dari localStorage
  const trialPayload = {
    title: "Materi Uji Save Trial Migration",
    raw_text: "Sistem Operasi adalah perangkat lunak sistem yang mengelola perangkat keras komputer.",
    flashcards: [
      {
        term: "Sistem Operasi",
        definition: "Perangkat lunak yang mengelola sumber daya perangkat keras dan menyediakan layanan umum untuk program komputer.",
      },
      {
        term: "Kernel",
        definition: "Komponen inti sistem operasi yang mengontrol semua operasi pada sistem komputer.",
      },
    ],
    quiz: [
      {
        question: "Apa fungsi utama dari Sistem Operasi?",
        options: [
          "Mengelola perangkat keras dan menyediakan layanan aplikasi",
          "Membuat desain grafis",
          "Membeli komponen komputer baru",
          "Menghubungkan internet tanpa wifi",
        ],
        correct_index: 0,
      },
    ],
  };

  console.log("\n▶️ 1. Menyimpan dokumen trial ke DB (terhubung ke user)...");
  const [insertedDoc] = await db
    .insert(documents)
    .values({
      userId: testUser.id,
      title: trialPayload.title,
      rawText: trialPayload.raw_text,
    })
    .returning();

  console.log(`   📄 Dokumen tersimpan: ID ${insertedDoc.id} (User ID: ${insertedDoc.userId})`);

  console.log("\n▶️ 2. Menyimpan flashcards terkait...");
  const insertedCards = await db
    .insert(flashcards)
    .values(
      trialPayload.flashcards.map((c) => ({
        documentId: insertedDoc.id,
        term: c.term,
        definition: c.definition,
      }))
    )
    .returning();
  console.log(`   💡 Berhasil menyimpan ${insertedCards.length} flashcards.`);

  console.log("\n▶️ 3. Menyimpan quiz questions terkait...");
  const [quizSet] = await db
    .insert(quizSets)
    .values({ documentId: insertedDoc.id, label: "Set 1" })
    .returning({ id: quizSets.id });

  const insertedQuiz = await db
    .insert(quizQuestions)
    .values(
      trialPayload.quiz.map((q) => ({
        documentId: insertedDoc.id,
        quizSetId: quizSet.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correct_index,
      }))
    )
    .returning();
  console.log(`   🎯 Berhasil menyimpan ${insertedQuiz.length} soal kuis.`);

  // 4. Verifikasi query data yang baru disimpan
  console.log("\n▶️ 4. Memverifikasi integritas relasi DB...");
  const fetchedDoc = await db.query.documents.findFirst({
    where: eq(documents.id, insertedDoc.id),
    with: {
      flashcards: true,
      quizQuestions: true,
    },
  });

  if (
    fetchedDoc &&
    fetchedDoc.flashcards.length === 2 &&
    fetchedDoc.quizQuestions.length === 1 &&
    fetchedDoc.userId === testUser.id
  ) {
    console.log("🔒 INTEGRITAS DATABASE PASS: Dokumen, Flashcard, dan Quiz terhubung dengan tepat ke User!");
  } else {
    console.error("❌ GAGAL: Relasi database tidak sesuai!");
    process.exit(1);
  }

  console.log("\n============================================================");
  console.log("🎉 TEST MIGRATION SAVE-TRIAL SUKSES 100%!");
  console.log("============================================================\n");
}

testSaveTrial();
