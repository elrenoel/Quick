"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Sparkles,
  ArrowRight,
  BookOpen,
  AlertCircle,
  Loader2,
  Clock,
  User as UserIcon,
  LogOut,
  FolderOpen,
} from "lucide-react";
import { getOrCreateSessionId } from "@/lib/session";
import { useSession, signOut } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import LanguageToggle from "@/components/LanguageToggle";

const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function LoadingOverlay({ step }: { step: number }) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(0);

  // ─── Loading overlay step definitions ─────────────────────────────────────
  const UPLOAD_STEPS = [
    { label: t("loading.step1"), detail: t("loading.step1Detail") },
    { label: t("loading.step2"), detail: t("loading.step2Detail") },
    { label: t("loading.step3"), detail: t("loading.step3Detail") },
    { label: t("loading.step4"), detail: t("loading.step4Detail") },
    { label: t("loading.step5"), detail: t("loading.step5Detail") },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const current = UPLOAD_STEPS[Math.min(step, UPLOAD_STEPS.length - 1)];
  const progress = Math.min(((step + 1) / UPLOAD_STEPS.length) * 100, 95);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-auto px-8 flex flex-col items-center text-center">
        {/* Animated spinner icon */}
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-6 shadow-lg relative">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>

        <h2 className="text-lg font-semibold text-neutral-900 mb-1 tracking-tight">
          {current.label}
        </h2>

        {/* Dynamic subtext based on elapsed time */}
        <p className="text-xs text-neutral-500 mb-6 min-h-[32px] flex items-center justify-center">
          {seconds > 10 ? t("loading.longProcessing") : current.detail}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-4 overflow-hidden">
          <div
            className="bg-neutral-900 h-1.5 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2 mb-6">
          {UPLOAD_STEPS.map((s, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-500 ${
                i < step
                  ? "w-2 h-2 bg-neutral-900"
                  : i === step
                  ? "w-3 h-3 bg-neutral-900 ring-4 ring-neutral-200"
                  : "w-2 h-2 bg-neutral-200"
              }`}
            />
          ))}
        </div>

        {/* Real-time seconds counter */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-[11px] font-mono text-neutral-600">
          <Clock className="w-3 h-3 text-neutral-500" />
          <span>{t("loading.seconds", { seconds })}</span>
        </div>

        <p className="text-[11px] text-neutral-400 mt-4 font-mono">
          {t("loading.dontClose")}
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, isPending: isSessionPending } = useSession();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loadingStep, setLoadingStep] = useState<number>(-1); // -1 = not loading
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<{
    remainingToday: number;
    usedToday: number;
    dailyLimit: number;
  } | null>(null);

  const isUploading = loadingStep >= 0;

  // 1. Otomatis migrasi data trial jika ada (misal setelah redirect login Google OAuth)
  useEffect(() => {
    if (session?.user && typeof window !== "undefined") {
      const rawTrial = localStorage.getItem("quick_trial_data");
      if (rawTrial) {
        try {
          const trialPayload = JSON.parse(rawTrial);
          fetch("/api/documents/save-trial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trialPayload),
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((saveData) => {
              if (saveData?.documentId) {
                localStorage.removeItem("quick_trial_data");
                localStorage.removeItem("quick_has_used_trial");
                router.push(`/documents/${saveData.documentId}/flashcards`);
              }
            })
            .catch((err) => {
              console.error("Auto migration error:", err);
            });
        } catch (e) {
          console.error("Parse trial data error:", e);
        }
      }
    }
  }, [session?.user, router]);

  // 2. Ambil sisa kuota harian untuk user yang sudah login
  useEffect(() => {
    if (session?.user) {
      fetch("/api/documents/generate")
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.remainingToday === "number") {
            setQuotaInfo({
              remainingToday: data.remainingToday,
              usedToday: data.usedToday ?? 0,
              dailyLimit: data.dailyLimit ?? 5,
            });
          }
        })
        .catch(() => {});
    } else {
      setQuotaInfo(null);
    }
  }, [session?.user]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.refresh();
    } catch {
      // Ignored
    } finally {
      setIsLoggingOut(false);
    }
  };

  const validateAndSetFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");

    if (!isPdf) {
      const isOffice =
        fileName.endsWith(".doc") ||
        fileName.endsWith(".docx") ||
        fileName.endsWith(".ppt") ||
        fileName.endsWith(".pptx");

      const msg = isOffice
        ? t("error.officeFormat")
        : t("error.unsupportedFormat");

      setErrorMessage(msg);
      setSelectedFile(null);
      return false;
    }

    if (file.size === 0) {
      setErrorMessage(t("error.emptyPdf"));
      setSelectedFile(null);
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(
        t("error.fileTooLarge", { size: sizeMb, max: MAX_FILE_SIZE_MB })
      );
      setSelectedFile(null);
      return false;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    // Auto-fill nama dokumen dari nama file (tanpa ekstensi) jika masih kosong
    if (!documentName.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "").trim();
      if (baseName) setDocumentName(baseName);
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) {
      setErrorMessage(t("error.selectFileFirst"));
      return;
    }

    // ── Alur 1: Pengguna Belum Login (Anonymous / Trial) ──────────────────
    if (!session?.user) {
      const hasUsedTrial =
        typeof window !== "undefined" &&
        localStorage.getItem("quick_has_used_trial") === "true";

      // Percobaan ke-2+: Jangan panggil API, langsung arahkan ke login
      if (hasUsedTrial) {
        router.push(
          "/login?message=" + encodeURIComponent(t("error.loginToGenerateAgain"))
        );
        return;
      }

      // Percobaan ke-1: Panggil endpoint trial stateless
      setErrorMessage(null);
      setLoadingStep(0); // Mengunggah

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", documentName.trim());

        setLoadingStep(1); // Mengekstrak teks & analisis AI
        const trialRes = await fetch("/api/trial/generate", {
          method: "POST",
          body: formData,
        });

        setLoadingStep(2); // AI sedang menganalisis

        if (!trialRes.ok) {
          const err = await trialRes.json().catch(() => ({}));
          throw new Error(err.error || t("error.trialGenerateFailed"));
        }

        const trialData = await trialRes.json();
        setLoadingStep(3); // Menyusun flashcard & kuis

        // Simpan hasil ke localStorage & tandai sudah pakai trial
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "quick_trial_data",
            JSON.stringify({
              title: trialData.title,
              raw_text: trialData.raw_text,
              flashcards: trialData.flashcards,
              quiz: trialData.quiz,
              totalPages: trialData.totalPages,
              wordCount: trialData.wordCount,
            })
          );
          localStorage.setItem("quick_has_used_trial", "true");
        }

        setLoadingStep(4); // Selesai
        await new Promise((r) => setTimeout(r, 400));

        // Arahkan ke halaman flashcard trial
        router.push("/trial/flashcards");
        return;
      } catch (err: unknown) {
        setLoadingStep(-1);
        setErrorMessage(
          err instanceof Error ? err.message : t("error.trialError")
        );
        return;
      }
    }

    // ── Alur 2: Pengguna Sudah Login (Daily Limit & DB Direct) ─────────────
    setErrorMessage(null);
    setLoadingStep(0); // Mengunggah PDF

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", documentName.trim());

      setLoadingStep(1); // Mengekstrak teks & validasi kuota

      const generateRes = await fetch("/api/documents/generate", {
        method: "POST",
        body: formData,
      });

      setLoadingStep(2); // AI sedang menganalisis

      if (!generateRes.ok) {
        const err = await generateRes.json().catch(() => ({}));
        if (generateRes.status === 429) {
          throw new Error(err.error || t("error.quotaReached"));
        }
        throw new Error(err.error || t("error.generateFailed"));
      }

      const generateData = await generateRes.json();
      const docId: string = generateData.document?.id;
      if (!docId) throw new Error(t("error.noDocumentId"));

      setLoadingStep(3); // Menyusun flashcard & kuis
      setLoadingStep(4); // Menyimpan ke DB

      await new Promise((r) => setTimeout(r, 400));

      // Navigate to flashcards page
      router.push(`/documents/${docId}/flashcards`);
    } catch (err: unknown) {
      setLoadingStep(-1);
      setErrorMessage(
        err instanceof Error ? err.message : t("error.generic")
      );
    }
  };

  return (
    <>
      {/* Full-screen loading overlay during AI generation */}
      {isUploading && <LoadingOverlay step={loadingStep} />}

      <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
        {/* Top Header */}
        <header className="border-b border-neutral-200 bg-white/90 backdrop-blur-md sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-base tracking-tight transition-transform group-hover:scale-105">
                Q
              </div>
              <span className="font-semibold text-neutral-900 tracking-tight text-lg">
                Quick
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <LanguageToggle />

              <Link
                href="/documents/demo-os-memory/flashcards"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
                <span>{t("nav.demo")}</span>
              </Link>

              {/* Auth Buttons / User Profile */}
              {!isSessionPending && (
                <>
                  {session?.user ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/history"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-neutral-600" />
                        <span>{t("nav.history")}</span>
                      </Link>
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-800">
                        <UserIcon className="w-3.5 h-3.5 text-neutral-600" />
                        <span className="truncate max-w-[120px]">
                          {session.user.name || session.user.email}
                        </span>
                      </div>
                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        title={t("nav.logoutTitle")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition disabled:opacity-50 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t("nav.logout")}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/login"
                        className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 transition"
                      >
                        {t("nav.login")}
                      </Link>
                      <Link
                        href="/register"
                        className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition shadow-2xs"
                      >
                        {t("nav.register")}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Hero & Upload Area */}
        <main className="max-w-3xl mx-auto px-6 py-16 flex-1 w-full flex flex-col items-center text-center justify-center">
          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t("upload.badge")}</span>
            </div>

            {session?.user && quotaInfo && (
              <div
                className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border ${
                  quotaInfo.remainingToday > 0
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    quotaInfo.remainingToday > 0
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-rose-500"
                  }`}
                />
                <span>
                  {t("upload.quotaRemaining", {
                    remaining: quotaInfo.remainingToday,
                    limit: quotaInfo.dailyLimit,
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900 max-w-2xl mb-4 leading-[1.15]">
            {t("upload.title")}
          </h1>

          <p className="text-neutral-600 text-base sm:text-lg max-w-xl mb-10 leading-relaxed font-normal">
            {t("upload.subtitle")}
          </p>

          {/* Upload Container Box */}
          <div className="w-full max-w-xl bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs text-left mb-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer relative ${
                isDragging
                  ? "border-neutral-900 bg-neutral-50"
                  : selectedFile
                  ? "border-neutral-300 bg-neutral-50/50"
                  : "border-neutral-200 hover:border-neutral-400 bg-neutral-50/30"
              }`}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="pdf-upload-input"
                disabled={isUploading}
              />

              <div className="flex flex-col items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center mb-3 text-neutral-700">
                  <Upload className="w-5 h-5" />
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-neutral-900">
                      <FileText className="w-4 h-4 text-neutral-600" />
                      <span className="truncate max-w-xs">{selectedFile.name}</span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {t("upload.fileSelected")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {t("upload.dropTitle")}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {t("upload.dropHint")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Nama Dokumen (Opsional) */}
            <input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder={t("upload.documentName")}
              disabled={isUploading}
              maxLength={200}
              className="mt-4 w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition disabled:opacity-50"
            />
            <p className="mt-1.5 text-[11px] text-neutral-400">
              {t("upload.documentNameHint")}
            </p>

            {errorMessage && (
              <div className="mt-4 flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Button */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleStartUpload}
                disabled={isUploading || !selectedFile}
                className="flex-1 py-3 px-5 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-xs"
              >
                <>
                  <span>{t("upload.submit")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              </button>
            </div>
          </div>

          {/* Demo Fast Link */}
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>{t("upload.demoPrompt")}</span>
            <Link
              href="/documents/demo-os-memory/flashcards"
              className="font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-700 transition inline-flex items-center gap-1"
            >
              {t("upload.demoLink")} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* 3 Step Explanation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left w-full border-t border-neutral-200 pt-12">
            <div className="space-y-2">
              <div className="w-7 h-7 rounded-md bg-neutral-100 border border-neutral-200 text-xs font-mono font-bold flex items-center justify-center text-neutral-800">
                1
              </div>
              <h3 className="font-semibold text-neutral-900 text-sm">{t("steps.1Title")}</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {t("steps.1Desc")}
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-7 h-7 rounded-md bg-neutral-100 border border-neutral-200 text-xs font-mono font-bold flex items-center justify-center text-neutral-800">
                2
              </div>
              <h3 className="font-semibold text-neutral-900 text-sm">{t("steps.2Title")}</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {t("steps.2Desc")}
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-7 h-7 rounded-md bg-neutral-100 border border-neutral-200 text-xs font-mono font-bold flex items-center justify-center text-neutral-800">
                3
              </div>
              <h3 className="font-semibold text-neutral-900 text-sm">{t("steps.3Title")}</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {t("steps.3Desc")}
              </p>
            </div>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-500">
          <div className=" px-6 flex flex-col sm:flex-row items-center justify-center gap-2">
            <span>{t("footer.tagline")}</span>
          </div>
        </footer>
      </div>
    </>
  );
}
