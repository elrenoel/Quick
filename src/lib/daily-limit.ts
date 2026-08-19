import { eq } from "drizzle-orm";
import { db, user } from "@/db";

export const DAILY_LIMIT = 5;

export interface UserQuota {
  currentCount: number;
  remainingToday: number;
  today: string;
  isNewDay: boolean;
}

/**
 * Ambil status kuota harian user. Count otomatis di-reset ke 0
 * jika last_generation_date bukan hari ini.
 * Return null jika user tidak ditemukan di DB.
 */
export async function getUserQuota(userId: string): Promise<UserQuota | null> {
  const [row] = await db
    .select({
      generationCountToday: user.generationCountToday,
      lastGenerationDate: user.lastGenerationDate,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row) return null;

  const today = new Date().toISOString().split("T")[0]; // format "2026-08-18"
  const isNewDay = row.lastGenerationDate !== today;
  const currentCount = isNewDay ? 0 : row.generationCountToday;

  return {
    currentCount,
    remainingToday: Math.max(0, DAILY_LIMIT - currentCount),
    today,
    isNewDay,
  };
}

/**
 * Increment generation_count_today dan set last_generation_date.
 * Menerima baseCount (count sebelum increment) agar tetap satu sumber kebenaran.
 */
export async function incrementGenerationUsage(
  userId: string,
  today: string,
  baseCount: number
): Promise<number> {
  const newCount = baseCount + 1;
  await db
    .update(user)
    .set({
      generationCountToday: newCount,
      lastGenerationDate: today,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
  return newCount;
}
