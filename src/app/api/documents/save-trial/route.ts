import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents, flashcards, quizQuestions, quizSets } from "@/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SaveTrialBody = {
  title: string;
  raw_text: string;
  flashcards: { term: string; definition: string }[];
  quiz: { question: string; options: string[]; correct_index: number }[];
};

/**
 * Endpoint untuk migrasi data trial (localStorage) ke database
 * setelah user berhasil login/register.
 * Membutuhkan sesi aktif (auth wajib).
 * Tidak memanggil AI sama sekali — data sudah ada dari trial sebelumnya.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verifikasi sesi
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak valid. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SaveTrialBody;

    // 2. Validasi payload dasar
    if (!body.raw_text || !body.title) {
      return NextResponse.json(
        { success: false, error: "Data trial tidak lengkap (title atau raw_text kosong)." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.flashcards) || body.flashcards.length === 0) {
      return NextResponse.json(
        { success: false, error: "Data flashcard tidak ditemukan dalam payload." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.quiz) || body.quiz.length === 0) {
      return NextResponse.json(
        { success: false, error: "Data quiz tidak ditemukan dalam payload." },
        { status: 400 }
      );
    }

    // 3. Insert dokumen ke database
    const [insertedDoc] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        title: body.title,
        rawText: body.raw_text,
        sessionId: null,
      })
      .returning();

    // 4. Insert flashcards
    if (body.flashcards.length > 0) {
      await db.insert(flashcards).values(
        body.flashcards.map((card) => ({
          documentId: insertedDoc.id,
          term: card.term,
          definition: card.definition,
        }))
      );
    }

    // 5. Insert quiz questions (terhubung ke quiz set default "Set 1")
    if (body.quiz.length > 0) {
      const [quizSet] = await db
        .insert(quizSets)
        .values({ documentId: insertedDoc.id, label: "Set 1" })
        .returning({ id: quizSets.id });

      await db.insert(quizQuestions).values(
        body.quiz.map((q) => ({
          documentId: insertedDoc.id,
          quizSetId: quizSet.id,
          question: q.question,
          options: q.options,
          correctIndex: q.correct_index,
        }))
      );
    }

    return NextResponse.json(
      {
        success: true,
        documentId: insertedDoc.id,
        title: insertedDoc.title,
        message: "Data trial berhasil disimpan ke akun Anda.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/documents/save-trial:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan internal server.",
      },
      { status: 500 }
    );
  }
}
