import { NextRequest, NextResponse } from "next/server";
import { db, quizQuestions, quizSets, documents } from "@/db";
import { eq, and, asc, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
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

    // Pastikan dokumen ada
    const [doc] = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { success: false, error: `Dokumen dengan ID "${id}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    // Semua quiz set milik dokumen (urut dari yang paling lama dibuat)
    const sets = await db
      .select({ id: quizSets.id, label: quizSets.label, createdAt: quizSets.createdAt })
      .from(quizSets)
      .where(eq(quizSets.documentId, id))
      .orderBy(asc(quizSets.createdAt));

    if (sets.length === 0) {
      return NextResponse.json(
        {
          success: true,
          documentId: id,
          documentTitle: doc.title,
          sets: [],
          quizSetId: null,
          quizSetLabel: null,
          total: 0,
          quiz: [],
        },
        { status: 200 }
      );
    }

    // Pilih set: dari query param setId, default set pertama
    const url = new URL(request.url);
    const requestedSetId = url.searchParams.get("setId");
    const selectedSet = requestedSetId
      ? sets.find((s) => s.id === requestedSetId) || null
      : sets[0];

    if (!selectedSet) {
      return NextResponse.json(
        { success: false, error: "Set kuis tidak ditemukan." },
        { status: 400 }
      );
    }

    // Hitung jumlah soal per set
    const counts = await db
      .select({
        quizSetId: quizQuestions.quizSetId,
        questionCount: count(),
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.documentId, id))
      .groupBy(quizQuestions.quizSetId);

    const countBySet: Record<string, number> = {};
    for (const row of counts) {
      countBySet[row.quizSetId] = row.questionCount;
    }

    // PENTING: Jangan sertakan 'correctIndex' dalam SELECT agar tidak bocor ke frontend
    const questions = await db
      .select({
        id: quizQuestions.id,
        question: quizQuestions.question,
        options: quizQuestions.options,
      })
      .from(quizQuestions)
      .where(
        and(
          eq(quizQuestions.documentId, id),
          eq(quizQuestions.quizSetId, selectedSet.id)
        )
      );

    return NextResponse.json(
      {
        success: true,
        documentId: id,
        documentTitle: doc.title,
        sets: sets.map((s) => ({
          id: s.id,
          label: s.label,
          questionCount: countBySet[s.id] ?? 0,
        })),
        quizSetId: selectedSet.id,
        quizSetLabel: selectedSet.label,
        total: questions.length,
        quiz: questions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/documents/:id/quiz:", error);
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
