import { NextRequest, NextResponse } from "next/server";
import { db, documents, flashcards, quizQuestions } from "@/db";
import { eq } from "drizzle-orm";
import { generateStudyMaterials } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    if (!id || id.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Parameter ID dokumen wajib diisi." },
        { status: 400 }
      );
    }

    // 1. Cari dokumen di database
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { success: false, error: `Dokumen dengan ID "${id}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    if (!doc.rawText || doc.rawText.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "Dokumen ini tidak memiliki teks materi untuk dianalisis.",
        },
        { status: 400 }
      );
    }

    // 2. Ekstrak materi dengan Gemini AI
    const { flashcards: generatedCards, quiz: generatedQuiz, isTruncated } =
      await generateStudyMaterials(doc.rawText);

    if (generatedCards.length === 0 && generatedQuiz.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "AI tidak berhasil menghasilkan flashcard atau quiz dari materi ini.",
        },
        { status: 500 }
      );
    }

    // 3. Bersihkan flashcard/quiz lama jika ada (untuk mencegah duplikasi jika di-generate ulang)
    await db.delete(flashcards).where(eq(flashcards.documentId, id));
    await db.delete(quizQuestions).where(eq(quizQuestions.documentId, id));

    // 4. Simpan Flashcards baru
    if (generatedCards.length > 0) {
      await db.insert(flashcards).values(
        generatedCards.map((card) => ({
          documentId: id,
          term: card.term.trim(),
          definition: card.definition.trim(),
        }))
      );
    }

    // 5. Simpan Quiz Questions baru
    if (generatedQuiz.length > 0) {
      await db.insert(quizQuestions).values(
        generatedQuiz.map((q) => ({
          documentId: id,
          question: q.question.trim(),
          options: q.options.map((opt) => opt.trim()),
          correctIndex: q.correct_index,
        }))
      );
    }

    return NextResponse.json(
      {
        success: true,
        documentId: id,
        title: doc.title,
        flashcardsCount: generatedCards.length,
        quizCount: generatedQuiz.length,
        isTruncated,
        message: "Flashcard dan quiz berhasil digenerate dan disimpan ke database.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in POST /api/documents/:id/generate:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal melakukan generate materi AI.",
      },
      { status: 500 }
    );
  }
}
