import { NextRequest, NextResponse } from "next/server";
import { db, quizQuestions, quizAttempts, quizSets, documents } from "@/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SubmitPayload {
  answers: Record<string, number> | Array<{ questionId: string; selectedIndex: number }>;
  sessionId?: string;
  quizSetId?: string;
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
    const quizSetId = body.quizSetId || null;

    // Set kuis wajib diisi dan harus milik dokumen ini
    if (!quizSetId || !UUID_REGEX.test(quizSetId)) {
      return NextResponse.json(
        { success: false, error: "Parameter quizSetId wajib diisi." },
        { status: 400 }
      );
    }

    const [quizSet] = await db
      .select({ id: quizSets.id })
      .from(quizSets)
      .where(and(eq(quizSets.id, quizSetId), eq(quizSets.documentId, documentId)))
      .limit(1);

    if (!quizSet) {
      return NextResponse.json(
        { success: false, error: "Set kuis tidak ditemukan untuk dokumen ini." },
        { status: 400 }
      );
    }

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

    // Ambil soal dan kunci jawaban KHUSUS dari set yang dikerjakan
    const questions = await db
      .select()
      .from(quizQuestions)
      .where(
        and(
          eq(quizQuestions.documentId, documentId),
          eq(quizQuestions.quizSetId, quizSetId)
        )
      );

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Set kuis ini belum memiliki soal untuk dikerjakan.",
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

    // Simpan attempt ke tabel quiz_attempts beserta detail jawaban per soal
    // (agar user bisa mereview jawaban di attempt manapun, bukan cuma yang terbaru)
    const [savedAttempt] = await db
      .insert(quizAttempts)
      .values({
        documentId,
        sessionId,
        score,
        total,
        answers: review.map((r) => ({
          questionId: r.questionId,
          selectedIndex: r.selectedIndex,
          correctIndex: r.correctIndex,
        })),
        quizSetId,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        attemptId: savedAttempt.id,
        documentId,
        documentTitle: doc.title,
        quizSetId,
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
