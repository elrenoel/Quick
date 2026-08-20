import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents } from "@/db";
import { eq, and, isNotNull, desc, lt } from "drizzle-orm";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const TRASH_RETENTION_DAYS = 30;

/**
 * GET /api/documents/trash — List trashed documents for the logged-in user.
 * Also auto-permanently deletes documents older than 30 days in trash.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Silakan masuk (login) terlebih dahulu.",
          requireAuth: true,
        },
        { status: 401 }
      );
    }

    // Auto-delete: permanently remove documents in trash older than 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    const expiredDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.userId, session.user.id),
          isNotNull(documents.deletedAt),
          lt(documents.deletedAt, cutoffISO)
        )
      );

    if (expiredDocs.length > 0) {
      // Permanently delete expired docs (cascade will remove related data)
      for (const doc of expiredDocs) {
        await db.delete(documents).where(eq(documents.id, doc.id));
      }
    }

    // Fetch remaining trashed documents
    const trashedDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        deletedAt: documents.deletedAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.userId, session.user.id),
          isNotNull(documents.deletedAt)
        )
      )
      .orderBy(desc(documents.deletedAt));

    return NextResponse.json({
      success: true,
      documents: trashedDocs,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/documents/trash");
  }
}
