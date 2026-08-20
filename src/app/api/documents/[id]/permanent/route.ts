import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents } from "@/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DELETE /api/documents/:id/permanent — Permanently delete a trashed document.
 * Only works on documents that are currently in trash (deleted_at IS NOT NULL).
 * Cascade FK will remove related flashcards, quiz_sets, quiz_questions, quiz_attempts.
 */
export async function DELETE(
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

    // Pastikan dokumen milik user dan statusnya sudah di-trash
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
        { success: false, error: "Dokumen tidak ditemukan atau belum di-trash." },
        { status: 404 }
      );
    }

    // Permanently delete (cascade FK will handle related data)
    const [deleted] = await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.userId, session.user.id)
        )
      )
      .returning({ id: documents.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Gagal menghapus dokumen secara permanen." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Dokumen berhasil dihapus secara permanen.",
    });
  } catch (error) {
    return handleApiError(error, "DELETE /api/documents/:id/permanent");
  }
}
