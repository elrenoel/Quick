import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents, quizAttempts, quizSets } from "@/db";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/documents/:id/attempts — Riwayat ujian (quiz_attempts) milik dokumen
 * user yang login, diurutkan dari attempt terbaru.
 */
export async function GET(
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
          error: "Silakan masuk (login) terlebih dahulu untuk melihat riwayat ujian.",
          requireAuth: true,
        },
        { status: 401 }
      );
    }

    // Pastikan dokumen ada DAN milik user yang login
    const [doc] = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, session.user.id)))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Dokumen tidak ditemukan." },
        { status: 404 }
      );
    }

    const attempts = await db
      .select({
        id: quizAttempts.id,
        score: quizAttempts.score,
        total: quizAttempts.total,
        answers: quizAttempts.answers,
        createdAt: quizAttempts.createdAt,
        quizSetId: quizAttempts.quizSetId,
        quizSetLabel: quizSets.label,
      })
      .from(quizAttempts)
      .leftJoin(quizSets, eq(quizAttempts.quizSetId, quizSets.id))
      .where(eq(quizAttempts.documentId, id))
      .orderBy(desc(quizAttempts.createdAt));

    return NextResponse.json(
      {
        success: true,
        document: { id: doc.id, title: doc.title },
        attempts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/documents/:id/attempts:", error);
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
