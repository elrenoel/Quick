import { NextRequest, NextResponse } from "next/server";
import { db, documents } from "@/db";
import { extractPdfText } from "@/lib/pdf";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Memeriksa apakah buffer file memiliki header Magic Bytes standar PDF (%PDF-)
 */
function isValidPdfHeader(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer.slice(0, 5));
  // %PDF- dalam kode ASCII adalah [37, 80, 68, 70, 45]
  return (
    header[0] === 0x25 && // %
    header[1] === 0x50 && // P
    header[2] === 0x44 && // D
    header[3] === 0x46 && // F
    header[4] === 0x2d    // -
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verifikasi Sesi Pengguna
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Silakan masuk (login) atau buat akun gratis terlebih dahulu untuk mengunggah dokumen.",
          requireAuth: true,
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sessionId = (formData.get("sessionId") as string) || null;
    const customTitle = (formData.get("title") as string) || null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "File PDF tidak ditemukan dalam request (field 'file' harus diisi).",
        },
        { status: 400 }
      );
    }

    const fileName = file.name || "Dokumen Tanpa Judul";
    const title =
      customTitle ||
      fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim() ||
      "Materi Pembelajaran";

    // Validasi ekstensi & tipe file
    const lowerName = fileName.toLowerCase();
    const isPdf =
      file.type === "application/pdf" || lowerName.endsWith(".pdf");

    if (!isPdf) {
      const isOffice =
        lowerName.endsWith(".doc") ||
        lowerName.endsWith(".docx") ||
        lowerName.endsWith(".ppt") ||
        lowerName.endsWith(".pptx");

      const errorMsg = isOffice
        ? "Format Word / PowerPoint belum didukung secara langsung. Silakan buka file tersebut dan pilih 'Save As / Export to PDF' terlebih dahulu."
        : "Format file tidak didukung. Mohon upload file dengan format PDF (.pdf).";

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
        },
        { status: 400 }
      );
    }

    // Convert file to ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Validasi ukuran kosong
    if (buffer.byteLength === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "File PDF kosong (0 byte). Mohon periksa kembali file dokumen Anda.",
        },
        { status: 400 }
      );
    }

    // Validasi ukuran maksimal (15 MB)
    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (buffer.byteLength / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran file terlalu besar (${sizeMb} MB). Maksimal ukuran file yang didukung adalah 15 MB.`,
        },
        { status: 400 }
      );
    }

    // Validasi keaslian header PDF (Magic Bytes)
    if (!isValidPdfHeader(buffer)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "File bukan merupakan dokumen PDF yang valid atau file telah rusak (corrupt).",
        },
        { status: 400 }
      );
    }

    const { text, totalPages, wordCount, characterCount } =
      await extractPdfText(buffer);

    // Validasi apakah PDF memiliki layer teks yang memadai
    if (!text || text.trim().length === 0 || wordCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak ditemukan teks yang dapat dibaca dalam PDF ini. Dokumen kemungkinan berupa hasil scan gambar atau PDF yang diproteksi password.",
        },
        { status: 400 }
      );
    }

    // Edge case: dokumen memiliki banyak halaman tetapi hanya sedikit kata (scan gambar/slide foto)
    if (totalPages > 2 && wordCount < 20) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Dokumen ini memiliki ${totalPages} halaman namun teks yang dapat diekstrak sangat minim (${wordCount} kata). Jika PDF berupa scan gambar/slide tanpa layer teks, silakan gunakan tool OCR terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // Simpan ke database dengan relasi userId (Wajib / NOT NULL)
    const [insertedDoc] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        title,
        rawText: text,
        sessionId,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        document: {
          id: insertedDoc.id,
          title: insertedDoc.title,
          totalPages,
          wordCount,
          characterCount,
          createdAt: insertedDoc.createdAt,
        },
        message: "File PDF berhasil diunggah dan diekstrak.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/documents/upload:", error);
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
