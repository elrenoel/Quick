import { NextRequest, NextResponse } from "next/server";
import { db, flashcards, documents } from "@/db";
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

    // Ambil daftar flashcards
    const cards = await db
      .select({
        id: flashcards.id,
        term: flashcards.term,
        definition: flashcards.definition,
      })
      .from(flashcards)
      .where(eq(flashcards.documentId, id));

    return NextResponse.json(
      {
        success: true,
        documentId: id,
        documentTitle: doc.title,
        total: cards.length,
        flashcards: cards,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/documents/:id/flashcards:", error);
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
