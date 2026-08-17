import { NextRequest, NextResponse } from "next/server";
import { db, quizQuestions, quizAttempts, documents } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface SubmitPayload {
  answers: Record<string, number> | Array<{ questionId: string; selectedIndex: number }>;
  sessionId?: string;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await props.params;

    if (!documentId || documentId.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Parameter documentId wajib diisi." },
        { status: 400 }
      );
    }

    // Pastikan dokumen ada
    const [doc] = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { success: false, error: `Dokumen dengan ID "${documentId}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    const body: SubmitPayload = await request.json().catch(() => ({ answers: {} }));
    const sessionId = body.sessionId || null;

    // Normalisasi format answers (bisa berupa object map { [id]: index } atau array [{ questionId, selectedIndex }])
    const answerMap: Record<string, number> = {};
    if (Array.isArray(body.answers)) {
      body.answers.forEach((item) => {
        if (item && item.questionId) {
          answerMap[item.questionId] = item.selectedIndex;
        }
      });
    } else if (typeof body.answers === "object" && body.answers !== null) {
      Object.entries(body.answers).forEach(([qId, idx]) => {
        answerMap[qId] = typeof idx === "number" ? idx : -1;
      });
    }

    // Ambil seluruh soal dan kunci jawaban dari database
    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.documentId, documentId));

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Dokumen ini belum memiliki soal kuis untuk dikerjakan.",
        },
        { status: 400 }
      );
    }

    // Evaluasi jawaban
    let score = 0;
    const total = questions.length;

    const review = questions.map((q) => {
      const selectedIndex = answerMap[q.id] !== undefined ? answerMap[q.id] : -1;
      const isCorrect = selectedIndex === q.correctIndex;
      if (isCorrect) {
        score += 1;
      }

      return {
        questionId: q.id,
        question: q.question,
        options: q.options,
        selectedIndex,
        correctIndex: q.correctIndex,
        isCorrect,
      };
    });

    const percentage = Math.round((score / total) * 100);

    // Simpan attempt ke tabel quiz_attempts
    const [savedAttempt] = await db
      .insert(quizAttempts)
      .values({
        documentId,
        sessionId,
        score,
        total,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        attemptId: savedAttempt.id,
        documentId,
        documentTitle: doc.title,
        score,
        total,
        percentage,
        createdAt: savedAttempt.createdAt,
        review,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in POST /api/quiz/:documentId/submit:", error);
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
