"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MOCK_DOCUMENT } from "@/lib/mock-data";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import ErrorState from "@/components/ErrorState";
import { useI18n } from "@/lib/i18n";
import { getOrCreateSessionId } from "@/lib/session";
import SubmitConfirmDialog from "@/components/SubmitConfirmDialog";

// ─── Types ──────────────────────────────────────────────────────────────────
interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface QuizSetOption {
  id: string;
  label: string;
  questionCount: number;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function QuestionSkeleton() {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-6 animate-pulse">
      <div className="h-5 bg-neutral-100 rounded w-3/4 mb-4" />
      <div className="h-4 bg-neutral-100 rounded w-1/2 mb-6" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-neutral-50 border border-neutral-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const docId = (params?.id as string) || "";

  const isDemo = docId === "demo-os-memory";

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [documentTitle, setDocumentTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sets, setSets] = useState<QuizSetOption[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedSetLabel, setSelectedSetLabel] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateMessage, setRegenerateMessage] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const optionLabels = ["A", "B", "C", "D"];

  // ── Load quiz questions untuk set tertentu (default: set pertama) ──────────
  const loadQuiz = useCallback(
    async (targetSetId?: string) => {
      try {
        const query = targetSetId ? `?setId=${targetSetId}` : "";
        const res = await fetch(`/api/documents/${docId}/quiz${query}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server error ${res.status}`);
        }
        const data = await res.json();
        if (!data.quiz || data.quiz.length === 0) {
          throw new Error("Tidak ada soal kuis yang ditemukan untuk dokumen ini.");
        }
        setQuestions(data.quiz);
        setSets(data.sets || []);
        setSelectedSetId(data.quizSetId || null);
        setSelectedSetLabel(data.quizSetLabel || null);
        setDocumentTitle(data.documentTitle || "Materi Pembelajaran");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Gagal memuat soal kuis.");
      } finally {
        setIsLoading(false);
      }
    },
    [docId]
  );

  // ── Fetch quiz questions ───────────────────────────────────────────────────
  useEffect(() => {
    if (!docId) {
      router.replace("/");
      return;
    }

    if (isDemo) {
      setQuestions(MOCK_DOCUMENT.quiz as QuizQuestion[]);
      setDocumentTitle(MOCK_DOCUMENT.title);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    loadQuiz();
  }, [docId, isDemo, router, loadQuiz]);

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(selectedAnswers).length;
  const currentSelection = currentQuestion ? selectedAnswers[currentQuestion.id] : undefined;

  const handleSelectOption = (optionIndex: number) => {
    if (!currentQuestion) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  // ── Ganti quiz set ─────────────────────────────────────────────────────────
  const handleSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const setId = e.target.value;
    if (!setId || setId === selectedSetId) return;
    setIsLoading(true);
    setError(null);
    setSubmitError(null);
    setCurrentIndex(0);
    setSelectedAnswers({});
    loadQuiz(setId);
  };

  // ── Buat soal baru (regenerate quiz set) ──────────────────────────────────
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setRegenerateError(null);
    setRegenerateMessage(null);
    try {
      const res = await fetch(`/api/documents/${docId}/quiz/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.requireAuth) {
          router.push(
            "/login?message=" +
              encodeURIComponent("Login dulu untuk membuat soal baru")
          );
          return;
        }
        throw new Error(body.error || "Gagal membuat soal baru.");
      }

      const data = await res.json();

      // Muat set baru dan langsung pilih
      setIsLoading(true);
      setError(null);
      setSubmitError(null);
      setCurrentIndex(0);
      setSelectedAnswers({});
      await loadQuiz(data.quizSet?.id);
      setRegenerateMessage(
        data.message || "Soal baru berhasil dibuat."
      );
    } catch (err: unknown) {
      setRegenerateError(
        err instanceof Error ? err.message : "Gagal membuat soal baru."
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  // ── Submit quiz ────────────────────────────────────────────────────────────
  const handleSubmitQuiz = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    if (isDemo) {
      // Demo mode: compute score locally from mock data (correct_index is available)
      const mockQuestions = MOCK_DOCUMENT.quiz as Array<QuizQuestion & { correctIndex?: number; correct_index?: number }>;
      let correctCount = 0;
      const reviewData = mockQuestions.map((q) => {
        const chosen = selectedAnswers[q.id] !== undefined ? selectedAnswers[q.id] : -1;
        const correctIdx = q.correctIndex ?? q.correct_index ?? 0;
        const isCorrect = chosen === correctIdx;
        if (isCorrect) correctCount += 1;
        return {
          questionId: q.id,
          question: q.question,
          options: q.options,
          selectedIndex: chosen,
          correctIndex: correctIdx,
          isCorrect,
        };
      });

      const resultPayload = {
        score: correctCount,
        total: mockQuestions.length,
        percentage: Math.round((correctCount / mockQuestions.length) * 100),
        documentTitle: MOCK_DOCUMENT.title,
        review: reviewData,
        createdAt: new Date().toISOString(),
      };

      sessionStorage.setItem(`quiz_result_${docId}`, JSON.stringify(resultPayload));
      setIsSubmitting(false);
      router.push(`/documents/${docId}/quiz/results`);
      return;
    }

    try {
      const sessionId = getOrCreateSessionId();

      // Build answers array
      const answers = Object.entries(selectedAnswers).map(([questionId, selectedIndex]) => ({
        questionId,
        selectedIndex,
      }));

      const res = await fetch(`/api/quiz/${docId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, sessionId, quizSetId: selectedSetId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const data = await res.json();

      // Persist result in sessionStorage so the results page can read it
      const resultPayload = {
        score: data.score,
        total: data.total,
        percentage: data.percentage,
        documentTitle: data.documentTitle || documentTitle,
        review: data.review,
        createdAt: data.createdAt,
      };
      sessionStorage.setItem(`quiz_result_${docId}`, JSON.stringify(resultPayload));

      router.push(`/documents/${docId}/quiz/results`);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Gagal mengirim jawaban. Silakan coba lagi."
      );
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* Top Navbar & Progress Bar */}
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/documents/${docId}/flashcards`}
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 transition"
              title={t("trial.backToFlashcard")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-semibold text-neutral-900 text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md">
                {isLoading ? (
                  <span className="inline-block h-4 w-40 rounded bg-neutral-100 animate-pulse" />
                ) : (
                  documentTitle
                )}
              </h1>
              <p className="text-[11px] text-neutral-500 font-mono">
                Quiz Pilihan Ganda
                {!isLoading && selectedSetLabel && ` • ${selectedSetLabel}`}
                {!isLoading && questions.length > 0 && ` • ${questions.length} Soal`}
              </p>
            </div>
          </div>

          {!isLoading && questions.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200">                <span>{t("quiz.answered")}</span>
              <span className="font-bold text-neutral-900">
                {answeredCount} / {questions.length}
              </span>
            </div>
          )}
        </div>

        {/* Top Progress Bar */}
        <div className="w-full bg-neutral-100 h-1.5">
          <div
            className="bg-neutral-900 h-1.5 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main Quiz Container */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full flex flex-col justify-center">
        {/* Loading state */}
        {isLoading && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("quiz.loading")}</span>
            </div>
            <QuestionSkeleton />
          </div>
        )}

        {/* Error (fetch) state */}
        {!isLoading && error && (
          <ErrorState
            title={t("quiz.notFoundTitle")}
            message={t("quiz.notFoundMessage")}
            actions={[
              { label: t("error.retry"), onClick: () => { setIsLoading(true); setError(null); loadQuiz(); }, variant: "primary" },
              { label: t("error.home"), href: "/", variant: "secondary" },
            ]}
          />
        )}

        {/* Quiz Set Selector & Regenerate */}
        {!isLoading && !error && sets.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="font-medium">Set Soal:</span>
                <select
                  value={selectedSetId ?? ""}
                  onChange={handleSetChange}
                  disabled={isLoading || isSubmitting || isRegenerating}
                  className="px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 disabled:opacity-50 cursor-pointer"
                >
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.questionCount} soal)
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={handleRegenerate}
                disabled={isRegenerating || isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isRegenerating ? t("quiz.creatingSet") : t("quiz.newSet")}</span>
              </button>
            </div>

            {regenerateError && (
              <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-lg">
                <p className="text-xs text-neutral-700 font-medium">{regenerateError}</p>
                <button
                  onClick={handleRegenerate}
                  className="mt-2 text-xs text-neutral-900 font-medium underline underline-offset-2 hover:text-neutral-600 transition cursor-pointer"
                >
                  Coba lagi
                </button>
              </div>
            )}

            {regenerateMessage && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{regenerateMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Quiz */}
        {!isLoading && !error && questions.length > 0 && currentQuestion && (
          <>
            {/* Question Header */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-full bg-neutral-900 text-white shadow-2xs">
                Soal {currentIndex + 1} dari {questions.length}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Pilih 1 jawaban yang paling tepat
              </span>
            </div>

            {/* Question Card */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-relaxed mb-6">
                {currentQuestion.question}
              </h2>

              {/* 4 Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, optIdx) => {
                  const isSelected = currentSelection === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(optIdx)}
                      className={`w-full p-4 rounded-xl border text-left transition flex items-start gap-3.5 cursor-pointer text-xs sm:text-sm ${
                        isSelected
                          ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                          : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/70 hover:border-neutral-300 text-neutral-800"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 transition ${
                          isSelected
                            ? "bg-white text-neutral-900"
                            : "bg-white border border-neutral-200 text-neutral-600"
                        }`}
                      >
                        {optionLabels[optIdx]}
                      </div>
                      <span className="leading-relaxed pt-0.5">{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-lg mb-4">
                <p className="text-xs text-neutral-700 font-medium">{submitError}</p>
              </div>
            )}

            {/* Navigation & Submit Controls */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="py-3 px-5 rounded-xl bg-white border border-neutral-200 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              {currentIndex === questions.length - 1 ? (
                <button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isSubmitting}
                  className="py-3 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menghitung Skor...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Selesaikan &amp; Lihat Skor</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="py-3 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <span>Soal Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        Quick MVP — Quiz Mode
      </footer>

      {/* Submit Confirmation Dialog */}
      {showConfirmDialog && (
        <SubmitConfirmDialog
          answeredCount={answeredCount}
          total={questions.length}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={() => {
            setShowConfirmDialog(false);
            handleSubmitQuiz();
          }}
        />
      )}
    </div>
  );
}
