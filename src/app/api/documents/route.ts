import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents, quizAttempts } from "@/db";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents — Mengambil semua histori dokumen milik user yang sedang login
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Silakan masuk (login) terlebih dahulu untuk melihat histori dokumen.",
          requireAuth: true,
        },
        { status: 401 }
      );
    }

    const userDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(and(eq(documents.userId, session.user.id), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt));

    // Ambil skor attempt terakhir per dokumen (dari quiz_attempts, urut terbaru)
    const docIds = userDocs.map((d) => d.id);
    const lastAttemptByDoc: Record<
      string,
      { score: number; total: number; createdAt: string }
    > = {};

    if (docIds.length > 0) {
      const attempts = await db
        .select({
          documentId: quizAttempts.documentId,
          score: quizAttempts.score,
          total: quizAttempts.total,
          createdAt: quizAttempts.createdAt,
        })
        .from(quizAttempts)
        .where(inArray(quizAttempts.documentId, docIds))
        .orderBy(desc(quizAttempts.createdAt));

      for (const attempt of attempts) {
        if (!lastAttemptByDoc[attempt.documentId]) {
          lastAttemptByDoc[attempt.documentId] = {
            score: attempt.score,
            total: attempt.total,
            createdAt: attempt.createdAt,
          };
        }
      }
    }

    const documentsWithLastAttempt = userDocs.map((d) => ({
      ...d,
      lastAttempt: lastAttemptByDoc[d.id] ?? null,
    }));

    return NextResponse.json({
      success: true,
      documents: documentsWithLastAttempt,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/documents");
  }
}
