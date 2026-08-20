import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents } from "@/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/documents/:id/restore — Restore a trashed document (set deleted_at back to NULL).
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
          error: "Silakan masuk (login) terlebih dahulu.",
          requireAuth: true,
        },
        { status: 401 }
      );
    }

    // Pastikan dokumen milik user dan statusnya sedang di-trash
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.userId, session.user.id),
          isNotNull(documents.deletedAt)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Dokumen tidak ditemukan atau tidak sedang di-trash." },
        { status: 404 }
      );
    }

    // Set deleted_at = NULL (restore)
    const [updated] = await db
      .update(documents)
      .set({ deletedAt: null })
      .where(
        and(
          eq(documents.id, id),
          eq(documents.userId, session.user.id)
        )
      )
      .returning({ id: documents.id });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Gagal memulihkan dokumen." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Dokumen berhasil dipulihkan.",
    });
  } catch (error) {
    return handleApiError(error, "POST /api/documents/:id/restore");
  }
}
