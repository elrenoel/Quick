import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents, quizQuestions, quizSets } from "@/db";
import { eq, and } from "drizzle-orm";
import { generateQuizQuestions } from "@/lib/ai";
import {
  DAILY_LIMIT,
  getUserQuota,
  incrementGenerationUsage,
} from "@/lib/daily-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LABEL_LENGTH = 100;

/**
 * POST /api/documents/:id/quiz/regenerate — Buat set soal quiz BARU untuk
 * dokumen yang sudah ada (flashcard tidak disentuh). Memakai raw_text dokumen,
 * memanggil AI khusus quiz, dan ikut memakan kuota harian yang sama dengan
 * generate biasa agar tidak jadi celah bypass limit.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { success: false, error: "ID dokumen tidak valid." },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Silakan masuk (login) terlebih dahulu untuk membuat soal baru.",
          requireAuth: true,
        },
        { status: 401 }
      );
    }

    // Pastikan dokumen milik user yang login dan punya raw_text
    const [doc] = await db
      .select({ id: documents.id, title: documents.title, rawText: documents.rawText })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, session.user.id)))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Dokumen tidak ditemukan." },
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

    // Cek kuota harian (sama seperti generate dokumen baru)
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
          error: `Limit harian ${DAILY_LIMIT}x generate sudah tercapai. Coba lagi besok!`,
          limitReached: true,
          remainingToday: 0,
          resetDate: quota.today,
        },
        { status: 429 }
      );
    }

    // Label set: opsional dari body, default auto "Set N"
    const body = (await request.json().catch(() => ({}))) as { label?: string };
    let label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, MAX_LABEL_LENGTH)
        : "";

    if (!label) {
      const existingSets = await db
        .select({ id: quizSets.id })
        .from(quizSets)
        .where(eq(quizSets.documentId, id));
      label = `Set ${existingSets.length + 1}`;
    }

    // Panggil AI — khusus quiz saja
    const aiResult = await generateQuizQuestions(doc.rawText);

    // Simpan set + soal baru
    const [quizSet] = await db
      .insert(quizSets)
      .values({ documentId: id, label })
      .returning({ id: quizSets.id, label: quizSets.label });

    await db.insert(quizQuestions).values(
      aiResult.quiz.map((q) => ({
        documentId: id,
        quizSetId: quizSet.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correct_index,
      }))
    );

    // Ikut memakan kuota harian
    const newCount = await incrementGenerationUsage(
      session.user.id,
      quota.today,
      quota.currentCount
    );

    return NextResponse.json(
      {
        success: true,
        quizSet: {
          id: quizSet.id,
          label: quizSet.label,
          questionCount: aiResult.quiz.length,
        },
        remainingToday: Math.max(0, DAILY_LIMIT - newCount),
        message: `Soal baru berhasil dibuat (${quizSet.label}).`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/documents/:id/quiz/regenerate:", error);
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
