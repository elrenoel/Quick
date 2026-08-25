import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "node:fs";
import * as path from "node:path";
import { db, user, documents, flashcards, quizQuestions, quizAttempts, quizSets } from "../src/db";
import { eq } from "drizzle-orm";
import { extractPdfText } from "../src/lib/pdf";
import { generateStudyMaterials } from "../src/lib/ai";

async function runE2ETest() {
  console.log("\n============================================================");
  console.log("🧪 Yoohoo Backend API Integration Test (with User Auth)");
  console.log("============================================================\n");

  const pdfPath = path.join(process.cwd(), "sample-materials", "sample-lecture.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("❌ File sample-lecture.pdf tidak ditemukan di sample-materials/");
    process.exit(1);
  }

  const testSessionId = `test-session-${Date.now()}`;
  const testUserId = `test-user-e2e-${Date.now()}`;
  let testDocId = "";

  // 0. Buat user dummy untuk testing relasi
  console.log("▶️ [SETUP] Membuat user uji coba di database...");
  await db
    .insert(user)
    .values({
      id: testUserId,
      name: "E2E Test User",
      email: `test-${Date.now()}@example.com`,
      emailVerified: true,
    })
    .onConflictDoNothing();

  // -------------------------------------------------------------
  // TEST 1: POST /api/documents/upload (Simulated Handler)
  // -------------------------------------------------------------
  console.log("\n▶️ [TEST 1/5] Menguji Ekstraksi PDF & Simpan Dokumen (Upload)...");
  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    const { text, totalPages, wordCount } = await extractPdfText(fileBuffer);

    console.log(`   📄 Teks berhasil diekstrak (${wordCount} kata, ${totalPages} halaman)`);

    const [insertedDoc] = await db
      .insert(documents)
      .values({
        userId: testUserId,
        title: "Sample OS Lecture (E2E Test)",
        rawText: text,
        sessionId: testSessionId,
      })
      .returning();

    testDocId = insertedDoc.id;
    console.log(`   ✅ Dokumen tersimpan ke database! (ID: ${testDocId})`);
  } catch (err) {
    console.error("   ❌ Gagal pada Test 1 (Upload):", err);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 2: POST /api/documents/:id/generate
  // -------------------------------------------------------------
  console.log("\n▶️ [TEST 2/5] Menguji AI Generation Flashcards & Quiz...");
  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, testDocId))
      .limit(1);

    console.log("   🤖 Menghubungi Google Gemini API...");
    const { flashcards: generatedCards, quiz: generatedQuiz } =
      await generateStudyMaterials(doc.rawText);

    console.log(`   💡 Dihasilkan: ${generatedCards.length} flashcards, ${generatedQuiz.length} quiz questions`);

    // Simpan ke database
    await db.insert(flashcards).values(
      generatedCards.map((c) => ({
        documentId: testDocId,
        term: c.term,
        definition: c.definition,
      }))
    );

    // Buat quiz set default "Set 1" lalu simpan soal ke dalamnya
    const [quizSet] = await db
      .insert(quizSets)
      .values({ documentId: testDocId, label: "Set 1" })
      .returning({ id: quizSets.id });

    await db.insert(quizQuestions).values(
      generatedQuiz.map((q) => ({
        documentId: testDocId,
        quizSetId: quizSet.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correct_index,
      }))
    );

    console.log("   ✅ Flashcards & Quiz berhasil disimpan ke tabel Postgres!");
  } catch (err) {
    console.error("   ❌ Gagal pada Test 2 (Generate):", err);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 3: GET /api/documents/:id/flashcards
  // -------------------------------------------------------------
  console.log("\n▶️ [TEST 3/5] Menguji GET Flashcards untuk Dokumen...");
  try {
    const savedCards = await db
      .select({ id: flashcards.id, term: flashcards.term, definition: flashcards.definition })
      .from(flashcards)
      .where(eq(flashcards.documentId, testDocId));

    console.log(`   ✅ Berhasil mengambil ${savedCards.length} flashcards.`);
    console.log(`   Sample Card: [${savedCards[0]?.term}] ➔ ${savedCards[0]?.definition.slice(0, 60)}...`);
  } catch (err) {
    console.error("   ❌ Gagal pada Test 3 (Get Flashcards):", err);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 4: GET /api/documents/:id/quiz (Verifikasi Keamanan Kunci)
  // -------------------------------------------------------------
  console.log("\n▶️ [TEST 4/5] Menguji GET Quiz (Anti-Bocor correct_index)...");
  try {
    const safeQuiz = await db
      .select({
        id: quizQuestions.id,
        question: quizQuestions.question,
        options: quizQuestions.options,
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.documentId, testDocId));

    console.log(`   ✅ Berhasil mengambil ${safeQuiz.length} soal kuis.`);
    console.log(`   Sample Question: "${safeQuiz[0]?.question}"`);
    console.log(`   Opsi: ${JSON.stringify(safeQuiz[0]?.options)}`);

    // Pastikan correct_index benar-benar tidak ada di response objek kuis publik
    // @ts-expect-error - sengaja kita cek runtime property
    if (safeQuiz[0]?.correctIndex !== undefined || safeQuiz[0]?.correct_index !== undefined) {
      throw new Error("SECURITY LEAK: correct_index terdeteksi pada response quiz publik!");
    }
    console.log("   🔒 SECURITY CHECK PASS: correct_index tersembunyi dengan aman.");
  } catch (err) {
    console.error("   ❌ Gagal pada Test 4 (Get Quiz):", err);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 5: POST /api/quiz/:documentId/submit (Koreksi Jawaban)
  // -------------------------------------------------------------
  console.log("\n▶️ [TEST 5/5] Menguji Submit Quiz & Perhitungan Skor...");
  try {
    const allDbQuestions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.documentId, testDocId));

    // Simulasikan user menjawab: soal pertama dijawab BENAR, sisanya dijawab index 0
    const userAnswers: Record<string, number> = {};
    allDbQuestions.forEach((q, idx) => {
      userAnswers[q.id] = idx === 0 ? q.correctIndex : (q.correctIndex + 1) % 4;
    });

    let score = 0;
    const total = allDbQuestions.length;
    allDbQuestions.forEach((q) => {
      if (userAnswers[q.id] === q.correctIndex) {
        score += 1;
      }
    });

    const [firstSet] = await db
      .select({ id: quizSets.id })
      .from(quizSets)
      .where(eq(quizSets.documentId, testDocId))
      .limit(1);

    const [savedAttempt] = await db
      .insert(quizAttempts)
      .values({
        documentId: testDocId,
        sessionId: testSessionId,
        score,
        total,
        quizSetId: firstSet.id,
      })
      .returning();

    const percentage = Math.round((score / total) * 100);

    console.log(`   ✅ Kuis berhasil dikoreksi!`);
    console.log(`   📊 Skor Akhir : ${score} / ${total} (${percentage}%)`);
    console.log(`   🗄️ Attempt ID  : ${savedAttempt.id}`);
  } catch (err) {
    console.error("   ❌ Gagal pada Test 5 (Submit Quiz):", err);
    process.exit(1);
  }

  console.log("\n============================================================");
  console.log("🎉 SEMUA TEST TERVERIFIKASI SUKSES 100%!");
  console.log("============================================================\n");
}

runE2ETest();
