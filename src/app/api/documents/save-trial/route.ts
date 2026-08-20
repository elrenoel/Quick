import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents, flashcards, quizQuestions, quizSets } from "@/db";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/api-error";
import { DAILY_LIMIT, getUserQuota, incrementGenerationUsage } from "@/lib/daily-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SaveTrialBody = {
  title: string;
  raw_text: string;
  content_language?: string;
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

    // 2. Cek daily limit (sama persis seperti generate)
    const quota = await getUserQuota(session.user.id);
    if (!quota) {
      return NextResponse.json(
        { success: false, error: "Data user tidak ditemukan." },
        { status: 404 }
      );
    }

    if (quota.currentCount >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Limit harian ${DAILY_LIMIT}x generate sudah tercapai. Data trial kamu masih tersimpan di browser ini, akan otomatis disimpan besok setelah limit reset.`,
          limitReached: true,
          remainingToday: 0,
          resetDate: quota.today,
        },
        { status: 429 }
      );
    }

    // 3. Validasi payload dasar
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

    // 4. Insert ke database secara atomic (gagal = rollback semua)
    let insertedDocId: string | null = null;
    try {
      const [insertedDoc] = await db
        .insert(documents)
        .values({
          userId: session.user.id,
          title: body.title,
          rawText: body.raw_text,
          sessionId: null,
          contentLanguage: body.content_language || "auto",
        })
        .returning();
      insertedDocId = insertedDoc.id;

      // 5. Insert flashcards
      if (body.flashcards.length > 0) {
        await db.insert(flashcards).values(
          body.flashcards.map((card) => ({
            documentId: insertedDoc.id,
            term: card.term,
            definition: card.definition,
          }))
        );
      }

      // 6. Insert quiz questions (terhubung ke quiz set default "Set 1")
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
    } catch (saveError) {
      // Rollback: hapus dokumen (cascade ke flashcards, quiz_sets, quiz_questions)
      if (insertedDocId) {
        await db.delete(documents).where(eq(documents.id, insertedDocId));
      }
      throw saveError;
    }

    // 7. Increment daily limit counter
    const newCount = await incrementGenerationUsage(
      session.user.id,
      quota.today,
      quota.currentCount
    );

    return NextResponse.json(
      {
        success: true,
        documentId: insertedDocId,
        remainingToday: DAILY_LIMIT - newCount,
        message: "Data trial berhasil disimpan ke akun Anda.",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "POST /api/documents/save-trial");
  }
}
