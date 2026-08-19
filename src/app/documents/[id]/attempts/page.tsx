"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { formatDateTime } from "@/lib/format-date";

interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  createdAt: string;
  answers?: Array<{
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
  }> | null;
  quizSetId?: string | null;
  quizSetLabel?: string | null;
}

function attemptGrade(percentage: number): { label: string; className: string } {
  if (percentage >= 85)
    return { label: "Sangat Baik", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (percentage >= 70)
    return { label: "Baik", className: "bg-blue-100 text-blue-800 border-blue-200" };
  if (percentage >= 50)
    return { label: "Perlu Berlatih Lagi", className: "bg-amber-100 text-amber-800 border-amber-200" };
  return { label: "Pelajari Lagi", className: "bg-rose-100 text-rose-800 border-rose-200" };
}

export default function DocumentAttemptsPage() {
  const params = useParams();
  const router = useRouter();
  const docId = (params?.id as string) || "";

  const [documentTitle, setDocumentTitle] = useState("");
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      router.replace("/");
      return;
    }

    async function fetchAttempts() {
      try {
        const res = await fetch(`/api/documents/${docId}/attempts`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server error ${res.status}`);
        }
        const data = await res.json();
        setDocumentTitle(data.document?.title || "Dokumen");
        setAttempts(data.attempts || []);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Gagal memuat riwayat ujian."
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchAttempts();
  }, [docId, router]);

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 transition"
              title="Kembali ke Riwayat Dokumen"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-semibold text-neutral-900 text-sm sm:text-base tracking-tight truncate max-w-[220px] sm:max-w-md">
                {isLoading ? (
                  <span className="inline-block h-4 w-40 rounded bg-neutral-100 animate-pulse" />
                ) : (
                  documentTitle
                )}
              </h1>
              <p className="text-[11px] text-neutral-500 font-mono">
                Riwayat Ujian
                {!isLoading && attempts.length > 0 && ` • ${attempts.length} Attempt`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 mb-1">
            Riwayat Hasil Ujian
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500">
            Semua percobaan kuis untuk dokumen ini, dari yang terbaru. Klik salah
            satu untuk melihat detail jawaban.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs animate-pulse flex items-center justify-between"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-neutral-100 rounded w-1/2" />
                  <div className="h-3 bg-neutral-100 rounded w-1/4" />
                </div>
                <div className="w-6 h-6 bg-neutral-100 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="flex items-start gap-2.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-4 rounded-xl mb-6">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Attempt List */}
        {!isLoading && !error && attempts.length > 0 && (
          <div className="space-y-3">
            {attempts.map((attempt, idx) => {
              const percentage =
                attempt.total > 0
                  ? Math.round((attempt.score / attempt.total) * 100)
                  : 0;
              const grade = attemptGrade(percentage);
              return (
                <Link
                  key={attempt.id}
                  href={`/documents/${docId}/attempts/${attempt.id}`}
                  className="group bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl p-5 shadow-2xs transition flex items-center justify-between gap-4 block cursor-pointer"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white flex items-center justify-center text-neutral-700 shrink-0 transition">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-neutral-900 tracking-tight">
                          Skor: {attempt.score}/{attempt.total}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${grade.className}`}
                        >
                          {percentage}% • {grade.label}
                        </span>
                        {attempt.quizSetLabel && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                            {attempt.quizSetLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1 font-mono">
                        <span>{formatDateTime(attempt.createdAt)}</span>
                      </div>
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 mt-1">
                          Attempt terbaru
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-neutral-50 group-hover:bg-neutral-100 flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 transition shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && attempts.length === 0 && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-500">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900 mb-1.5">
              Belum ada ujian untuk dokumen ini
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
              Kerjakan kuis dokumen ini terlebih dahulu, lalu riwayat skor akan
              muncul di sini.
            </p>
            <Link
              href={`/documents/${docId}/quiz`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
            >
              Mulai Kuis Sekarang
            </Link>
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        Quick — Riwayat Ujian
      </footer>
    </div>
  );
}
