import { NextRequest, NextResponse } from "next/server";
import { db, quizQuestions, documents } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
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

    // PENTING: Jangan sertakan 'correctIndex' dalam SELECT agar tidak bocor ke frontend
    const questions = await db
      .select({
        id: quizQuestions.id,
        question: quizQuestions.question,
        options: quizQuestions.options,
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.documentId, id));

    return NextResponse.json(
      {
        success: true,
        documentId: id,
        documentTitle: doc.title,
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
