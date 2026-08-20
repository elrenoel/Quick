import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents } from "@/db";
import { eq, and } from "drizzle-orm";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 200;

/**
 * PATCH /api/documents/:id — Ubah nama (title) dokumen milik user yang login.
 */
export async function PATCH(
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
          error: "Silakan masuk (login) terlebih dahulu untuk mengubah dokumen.",
          requireAuth: true,
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Nama dokumen tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Nama dokumen maksimal ${MAX_TITLE_LENGTH} karakter.`,
        },
        { status: 400 }
      );
    }

    // Pastikan dokumen milik user yang login
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, session.user.id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Dokumen tidak ditemukan." },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(documents)
      .set({ title })
      .where(and(eq(documents.id, id), eq(documents.userId, session.user.id)))
      .returning({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
      });

    return NextResponse.json({
      success: true,
      document: updated,
      message: "Nama dokumen berhasil diubah.",
    });
  } catch (error) {
    return handleApiError(error, "PATCH /api/documents/:id");
  }
}
