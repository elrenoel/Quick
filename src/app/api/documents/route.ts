import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, documents } from "@/db";
import { eq, desc } from "drizzle-orm";

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
      .where(eq(documents.userId, session.user.id))
      .orderBy(desc(documents.createdAt));

    return NextResponse.json({
      success: true,
      documents: userDocs,
    });
  } catch (error) {
    console.error("Error in GET /api/documents:", error);
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
