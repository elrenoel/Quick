"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Minus,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { formatDateTime } from "@/lib/format-date";

const OPTION_LABELS = ["A", "B", "C", "D"];

interface AttemptAnswer {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
}

interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  createdAt: string;
  answers?: AttemptAnswer[] | null;
  quizSetId?: string | null;
  quizSetLabel?: string | null;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface ReviewItem {
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
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

export default function AttemptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = (params?.id as string) || "";
  const attemptId = (params?.attemptId as string) || "";

  const [documentTitle, setDocumentTitle] = useState("");
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId || !attemptId) {
      router.replace("/history");
      return;
    }

    async function fetchData() {
      try {
        const attemptsRes = await fetch(`/api/documents/${docId}/attempts`);
        if (!attemptsRes.ok) {
          const body = await attemptsRes.json().catch(() => ({}));
          throw new Error(body.error || `Server error ${attemptsRes.status}`);
        }

        const attemptsData = await attemptsRes.json();
        setDocumentTitle(attemptsData.document?.title || "Dokumen");

        const found = (attemptsData.attempts || []).find(
          (a: QuizAttempt) => a.id === attemptId
        );
        if (!found) {
          throw new Error("Attempt tidak ditemukan.");
        }
        setAttempt(found);

        // Ambil soal dari SET tempat attempt ini dikerjakan
        if (found.quizSetId) {
          const quizRes = await fetch(
            `/api/documents/${docId}/quiz?setId=${found.quizSetId}`
          );
          if (quizRes.ok) {
            const quizData = await quizRes.json();
            setQuestions(quizData.quiz || []);
          }
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Gagal memuat detail attempt."
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [docId, attemptId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <p className="text-sm text-neutral-500 font-mono">Memuat detail attempt...</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-6 text-center">
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 p-4 rounded-xl mb-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error || "Attempt tidak ditemukan."}</span>
        </div>
        <Link
          href={`/documents/${docId}/attempts`}
          className="text-xs text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
        >
          Kembali ke Riwayat Ujian
        </Link>
      </div>
    );
  }

  const percentage =
    attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const grade = attemptGrade(percentage);

  // Susun review dari answers tersimpan + soal kuis
  const answersByQuestion = new Map(
    (attempt.answers || []).map((a) => [a.questionId, a])
  );
  const review: ReviewItem[] = questions
    .map((q) => {
      const answer = answersByQuestion.get(q.id);
      if (!answer) return null;
      const selectedIndex = answer.selectedIndex;
      const correctIndex = answer.correctIndex;
      return {
        question: q.question,
        options: q.options,
        selectedIndex,
        correctIndex,
        isCorrect: selectedIndex === correctIndex,
      };
    })
    .filter((r): r is ReviewItem => r !== null);

  const hasReview = review.length > 0;
  const correctItems = review.filter((r) => r.isCorrect);
  const wrongItems = review.filter((r) => !r.isCorrect && r.selectedIndex !== -1);
  const skippedItems = review.filter((r) => r.selectedIndex === -1);

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/documents/${docId}/attempts`}
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 transition"
              title="Kembali ke Riwayat Ujian"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-semibold text-neutral-900 text-sm sm:text-base tracking-tight truncate max-w-[220px] sm:max-w-md">
                {documentTitle}
              </h1>
              <p className="text-[11px] text-neutral-500 font-mono">
                Detail Attempt Ujian
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Summary Card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 text-neutral-800 mb-4">
            <Trophy className="w-7 h-7" />
          </div>

          <div className="text-5xl font-bold tracking-tight text-neutral-900 mb-1">
            {percentage}
            <span className="text-2xl text-neutral-500 font-normal">%</span>
          </div>

          <p className="text-sm text-neutral-600 mb-3">
            <strong className="text-neutral-900">{attempt.score}</strong> dari{" "}
            <strong className="text-neutral-900">{attempt.total}</strong> soal benar
          </p>

          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${grade.className}`}
          >
            {grade.label}
          </span>

          <p className="text-[11px] text-neutral-400 font-mono mt-4">
            {attempt.quizSetLabel ? `${attempt.quizSetLabel} • ` : ""}
            Dikerjakan pada {formatDateTime(attempt.createdAt)}
          </p>

          {hasReview && (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-neutral-100 text-xs">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-700">
                  {correctItems.length}
                </div>
                <div className="text-neutral-500 mt-0.5">Benar</div>
              </div>
              <div className="text-center border-x border-neutral-100">
                <div className="text-2xl font-bold text-rose-600">
                  {wrongItems.length}
                </div>
                <div className="text-neutral-500 mt-0.5">Salah</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-400">
                  {skippedItems.length}
                </div>
                <div className="text-neutral-500 mt-0.5">Dilewati</div>
              </div>
            </div>
          )}
        </div>

        {/* Review Section */}
        {hasReview ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Pembahasan Jawaban
              </h2>
              <span className="text-xs text-neutral-500 font-mono">
                {review.length} soal
              </span>
            </div>

            <div className="space-y-4">
              {review.map((item, idx) => {
                const isSkipped = item.selectedIndex === -1;
                const statusColor = item.isCorrect
                  ? "border-emerald-200 bg-emerald-50/40"
                  : isSkipped
                  ? "border-neutral-200 bg-neutral-50"
                  : "border-rose-200 bg-rose-50/40";

                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-xl border p-5 shadow-2xs ${statusColor}`}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={`mt-0.5 shrink-0 ${
                          item.isCorrect
                            ? "text-emerald-600"
                            : isSkipped
                            ? "text-neutral-400"
                            : "text-rose-600"
                        }`}
                      >
                        {item.isCorrect ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : isSkipped ? (
                          <Minus className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-wider mb-1">
                          Soal {idx + 1}
                        </p>
                        <p className="text-sm font-semibold text-neutral-900 leading-relaxed">
                          {item.question}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 ml-8">
                      {item.options.map((opt, optIdx) => {
                        const isCorrectOption = optIdx === item.correctIndex;
                        const isUserChoice = optIdx === item.selectedIndex;

                        let optClass =
                          "border-neutral-200 text-neutral-600 bg-neutral-50";
                        let labelClass = "bg-neutral-100 text-neutral-600";

                        if (isCorrectOption) {
                          optClass =
                            "border-emerald-300 bg-emerald-50 text-emerald-900";
                          labelClass = "bg-emerald-200 text-emerald-900";
                        }
                        if (isUserChoice && !item.isCorrect) {
                          optClass =
                            "border-rose-300 bg-rose-50 text-rose-800";
                          labelClass = "bg-rose-200 text-rose-800";
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${optClass}`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${labelClass}`}
                            >
                              {OPTION_LABELS[optIdx]}
                            </div>
                            <span className="leading-relaxed pt-0.5">{opt}</span>
                            {isCorrectOption && (
                              <span className="ml-auto shrink-0 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                                ✓ Jawaban benar
                              </span>
                            )}
                            {isUserChoice && !item.isCorrect && (
                              <span className="ml-auto shrink-0 text-[10px] font-semibold text-rose-600 whitespace-nowrap">
                                ✗ Pilihan Anda
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-3 text-neutral-500">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">
              Detail jawaban tidak tersedia
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Attempt ini dibuat sebelum fitur penyimpanan detail jawaban
              tersedia, jadi hanya skor dan tanggal yang bisa ditampilkan.
            </p>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-10 pt-8 border-t border-neutral-200 text-center">
          <Link
            href={`/documents/${docId}/attempts`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 transition"
          >
            <ArrowLeft className="w-3 h-3" /> Kembali ke Riwayat Ujian
          </Link>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        Quick — Detail Attempt Ujian
      </footer>
    </div>
  );
}
