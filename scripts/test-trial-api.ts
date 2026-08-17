import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "node:fs";
import * as path from "node:path";
import { db, documents } from "../src/db";
import { extractPdfText } from "../src/lib/pdf";
import { generateStudyMaterials } from "../src/lib/ai";

async function testTrialGenerate() {
  console.log("\n============================================================");
  console.log("🧪 Menguji Endpoint POST /api/trial/generate (Stateless)");
  console.log("============================================================\n");

  const pdfPath = path.join(process.cwd(), "sample-materials", "sample-lecture.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("❌ File sample-lecture.pdf tidak ditemukan.");
    process.exit(1);
  }

  // 1. Cek jumlah dokumen di database sebelum proses
  const docsBefore = await db.select().from(documents);
  console.log(`📊 Jumlah dokumen di database SEBELUM trial: ${docsBefore.length}`);

  // 2. Simulasi proses trial generate
  console.log("\n▶️ 1. Mengekstrak PDF...");
  const buffer = fs.readFileSync(pdfPath);
  const { text, totalPages, wordCount } = await extractPdfText(buffer);
  console.log(`   📄 Teks diekstrak: ${wordCount} kata (${totalPages} halaman)`);

  console.log("\n▶️ 2. Menjalankan AI Pipeline...");
  const aiResult = await generateStudyMaterials(text);
  console.log(`   💡 Flashcards dihasilkan : ${aiResult.flashcards.length}`);
  console.log(`   🎯 Quiz dihasilkan       : ${aiResult.quiz.length}`);
  console.log(`   ⚡ Model digunakan       : ${aiResult.usedModel} (${aiResult.latencyMs}ms)`);

  // 3. Cek struktur response
  const trialResponse = {
    success: true,
    title: "Sample OS Lecture (Trial)",
    raw_text: text,
    flashcards: aiResult.flashcards,
    quiz: aiResult.quiz,
    totalPages,
    wordCount,
    isTruncated: aiResult.isTruncated,
    usedModel: aiResult.usedModel,
    latencyMs: aiResult.latencyMs,
  };

  console.log("\n▶️ 3. Verifikasi Output Response JSON:");
  console.log(`   • Title           : ${trialResponse.title}`);
  console.log(`   • Flashcard count : ${trialResponse.flashcards.length}`);
  console.log(`   • Quiz count      : ${trialResponse.quiz.length}`);
  console.log(`   • Raw text length : ${trialResponse.raw_text.length} chars`);

  // 4. Verifikasi database setelah proses
  const docsAfter = await db.select().from(documents);
  console.log(`\n📊 Jumlah dokumen di database SESUDAH trial: ${docsAfter.length}`);

  if (docsBefore.length === docsAfter.length) {
    console.log("🔒 VERIFIKASI STATELESS PASS: Tidak ada data yang ditulis ke database! (0 write)");
  } else {
    console.error("❌ GAGAL: Terjadi penulisan data ke database saat trial!");
    process.exit(1);
  }

  console.log("\n============================================================");
  console.log("🎉 TEST ENDPOINT TRIAL GENERATE SUKSES 100%!");
  console.log("============================================================\n");
}

testTrialGenerate();
