"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  LogIn,
  UserPlus,
} from "lucide-react";
import SubmitConfirmDialog from "@/components/SubmitConfirmDialog";

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

interface TrialData {
  title: string;
  raw_text: string;
  flashcards: { term: string; definition: string }[];
  quiz: QuizQuestion[];
}

export default function TrialQuizPage() {
  const router = useRouter();
  const [trialData, setTrialData] = useState<TrialData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [notFound, setNotFound] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const optionLabels = ["A", "B", "C", "D"];

  useEffect(() => {
    const raw = localStorage.getItem("quick_trial_data");
    if (!raw) {
      setNotFound(true);
      return;
    }
    try {
      const data = JSON.parse(raw) as TrialData;
      if (!data.quiz || data.quiz.length === 0) {
        setNotFound(true);
        return;
      }
      setTrialData(data);
    } catch {
      setNotFound(true);
    }
  }, []);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-6 text-center">
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 p-4 rounded-xl mb-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">Data kuis trial tidak ditemukan.</span>
        </div>
        <Link
          href="/"
          className="text-xs text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
        >
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  if (!trialData) return null;

  const questions = trialData.quiz;
  const currentQuestion = questions[currentIndex];
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(selectedAnswers).length;
  const currentSelection = selectedAnswers[currentIndex];

  const handleSelectOption = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  };

  const handleFinishQuiz = () => {
    // Hitung skor di client
    let score = 0;
    const review = questions.map((q, idx) => {
      const selected = selectedAnswers[idx] ?? -1;
      const isCorrect = selected === q.correct_index;
      if (isCorrect) score += 1;
      return {
        question: q.question,
        options: q.options,
        selectedIndex: selected,
        correctIndex: q.correct_index,
        isCorrect,
      };
    });

    const resultPayload = {
      score,
      total: questions.length,
      percentage: Math.round((score / questions.length) * 100),
      documentTitle: trialData.title,
      review,
      createdAt: new Date().toISOString(),
    };

    sessionStorage.setItem("trial_quiz_result", JSON.stringify(resultPayload));
    router.push("/trial/quiz/results");
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/trial/flashcards"
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 transition"
              title="Kembali ke Flashcard"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-semibold text-neutral-900 text-sm sm:text-base tracking-tight truncate max-w-[180px] sm:max-w-md">
                {trialData.title}
              </h1>
              <p className="text-[11px] text-neutral-500 font-mono">
                Kuis Trial • {questions.length} Soal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200">
              {answeredCount}/{questions.length} Terjawab
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-100 h-1">
          <div
            className="bg-neutral-900 h-1 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Trial Notice Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
          <p className="text-xs text-amber-800 font-medium leading-relaxed">
            ✨ Mode Trial: Jawaban kuis diproses secara lokal.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition"
            >
              <LogIn className="w-3 h-3" />
              <span>Masuk</span>
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition"
            >
              <UserPlus className="w-3 h-3" />
              <span>Daftar Gratis</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full flex flex-col justify-center">
        {/* Question Counter & Info */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-mono text-neutral-500 font-medium">
            Soal {currentIndex + 1} dari {questions.length}
          </span>
          <span className="text-xs font-mono text-neutral-400">Pilihan Ganda</span>
        </div>

        {/* Question Card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 tracking-tight leading-snug mb-6">
            {currentQuestion.question}
          </h2>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, optIdx) => {
              const isSelected = currentSelection === optIdx;
              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelectOption(optIdx)}
                  className={`w-full p-4 rounded-xl border text-left transition flex items-start gap-3.5 cursor-pointer group ${
                    isSelected
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                      : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/80 hover:border-neutral-300 text-neutral-800"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 transition ${
                      isSelected
                        ? "bg-white text-neutral-900"
                        : "bg-white border border-neutral-200 text-neutral-600 group-hover:border-neutral-300"
                    }`}
                  >
                    {optionLabels[optIdx]}
                  </span>
                  <span className="text-sm sm:text-base leading-relaxed flex-1 pt-0.5">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nav Controls */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
            disabled={currentIndex === 0}
            className="py-3 px-5 rounded-xl bg-white border border-neutral-200 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              onClick={() => setShowConfirmDialog(true)}
              className="py-3 px-6 rounded-xl bg-neutral-900 text-white text-xs sm:text-sm font-medium hover:bg-neutral-800 active:scale-[0.99] transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selesai &amp; Lihat Skor</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))}
              className="py-3 px-6 rounded-xl bg-neutral-900 text-white text-xs sm:text-sm font-medium hover:bg-neutral-800 active:scale-[0.99] transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        Quick — Kuis Interaktif Mode Trial
      </footer>

      {/* Submit Confirmation Dialog */}
      {showConfirmDialog && (
        <SubmitConfirmDialog
          answeredCount={answeredCount}
          total={questions.length}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={() => {
            setShowConfirmDialog(false);
            handleFinishQuiz();
          }}
        />
      )}
    </div>
  );
}
