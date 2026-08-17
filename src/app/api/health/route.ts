import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
      return NextResponse.json(
        {
          status: "warning",
          database: "not_configured",
          message: "DATABASE_URL belum diatur di .env.local",
        },
        { status: 200 }
      );
    }

    const result = await db.execute<{ current_time: string; version: string }>(
      sql`SELECT NOW() as current_time, version() as version`
    );

    const firstRow = result.rows?.[0] as { current_time?: string; version?: string } | undefined;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: firstRow?.current_time ?? new Date().toISOString(),
      info: "Quick Flashcard & Quiz AI API is ready (Stage 0)",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 500 }
    );
  }
}
