"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { formatDateTime } from "@/lib/format-date";
import {
  FileText,
  Clock,
  ArrowRight,
  Plus,
  Loader2,
  Pencil,
  Check,
  X,
  ClipboardCheck,
  User as UserIcon,
  LogOut,
  FolderOpen,
} from "lucide-react";
import ErrorState from "@/components/ErrorState";
import { useI18n } from "@/lib/i18n";

interface UserDocument {
  id: string;
  title: string;
  createdAt: string;
  lastAttempt?: { score: number; total: number; createdAt: string } | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, isPending: isSessionPending } = useSession();

  const [documentsList, setDocumentsList] = useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ── Rename state ───────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionPending) return;

    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/documents");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t("history.loadErrorTitle"));
        }
        const data = await res.json();
        setDocumentsList(data.documents || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("history.loadErrorMessage")
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [session?.user, isSessionPending]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch {
      // Ignored
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ── Rename dokumen ─────────────────────────────────────────────────────────
  const startRename = (doc: UserDocument) => {
    setEditingId(doc.id);
    setEditingTitle(doc.title);
    setRenameError(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
    setRenameError(null);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    const newTitle = editingTitle.trim();
    if (!newTitle) {
      setRenameError(t("history.renamePlaceholder") + " " + t("error.defaultMessage").split(".")[0]);
      return;
    }

    const current = documentsList.find((d) => d.id === editingId);
    if (current && current.title === newTitle) {
      cancelRename();
      return;
    }

    setIsRenaming(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/documents/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t("history.renameError"));
      }
      const data = await res.json();
      setDocumentsList((prev) =>
        prev.map((d) =>
          d.id === editingId
            ? { ...d, title: data?.document?.title ?? newTitle }
            : d
        )
      );
      cancelRename();
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : t("history.renameError")
      );
    } finally {
      setIsRenaming(false);
    }
  };

  return (
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
            <Link
              href="/"
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition"
            >
              {t("error.home")}
            </Link>

            <Link
              href="/history"
              className="px-3 py-1.5 text-xs font-medium text-neutral-900 font-semibold transition"
            >
              {t("nav.history")}
            </Link>

            {!isSessionPending && (
              <>
                {session?.user ? (
                  <div className="flex items-center gap-2">
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

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-1">
              {t("history.pageTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              {t("history.pageDesc")}
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("history.uploadNew")}</span>
          </Link>
        </div>

        {/* State 1: Belum Login */}
        {!isSessionPending && !session?.user && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-600">
              <UserIcon className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-neutral-900 mb-1.5">
              {t("history.loginTitle")}
            </h2>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
              {t("history.loginDesc")}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
            >
              <span>{t("history.loginButton")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* State 2: Loading Skeleton */}
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

        {/* State 3: Error Message */}
        {error && (
          <div className="mb-6">
            <ErrorState
              title="Gagal memuat riwayat"
              message="Tidak bisa mengambil data dokumen. Periksa koneksi internet Anda."
              compact
              actions={[
                {
                  label: "Coba Lagi",
                  onClick: () => {
                    setIsLoading(true);
                    setError(null);
                    fetch("/api/documents")
                      .then((res) => {
                        if (!res.ok) throw new Error("Gagal memuat histori.");
                        return res.json();
                      })
                      .then((data) => setDocumentsList(data.documents || []))
                      .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : "Gagal memuat.");
                      })
                      .finally(() => setIsLoading(false));
                  },
                  variant: "primary",
                },
              ]}
            />
          </div>
        )}

        {/* State 4: List Dokumen */}
        {!isLoading && session?.user && (
          <>
            {documentsList.length > 0 ? (
              <div className="space-y-3">
                {documentsList.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}/flashcards`}
                    className="group bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl p-5 shadow-2xs transition flex items-center justify-between gap-4 block cursor-pointer"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white flex items-center justify-center text-neutral-700 shrink-0 transition">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingId === doc.id ? (
                          <form
                            onSubmit={handleRenameSubmit}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2"
                          >
                            <input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") cancelRename();
                              }}
                              autoFocus
                              maxLength={200}
                              placeholder="Nama dokumen"
                              disabled={isRenaming}
                              className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 disabled:opacity-50"
                            />
                            <button
                              type="submit"
                              disabled={isRenaming || !editingTitle.trim()}
                              title={t("history.renameSave")}
                              className="shrink-0 w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer"
                            >
                              {isRenaming ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                cancelRename();
                              }}
                              disabled={isRenaming}
                              title={t("history.renameCancel")}
                              className="shrink-0 w-7 h-7 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center hover:bg-neutral-200 disabled:opacity-50 transition cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h2 className="text-sm font-semibold text-neutral-900 tracking-tight truncate group-hover:text-neutral-900">
                              {doc.title}
                            </h2>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                startRename(doc);
                              }}
                              title={t("history.renamePlaceholder")}
                              className="shrink-0 w-6 h-6 rounded-md text-neutral-300 hover:text-neutral-900 hover:bg-neutral-100 flex items-center justify-center transition cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {renameError && editingId === doc.id && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-600 bg-neutral-50 border border-neutral-200 px-2 py-1 rounded-md">
                            <span>{renameError}</span>
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{formatDateTime(doc.createdAt)}</span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-xs">
                          {doc.lastAttempt ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <ClipboardCheck className="w-3 h-3" />
                              {t("history.lastScore", { score: doc.lastAttempt.score, total: doc.lastAttempt.total })}
                            </span>
                          ) : (
                            <span className="text-neutral-400">{t("history.noExam")}</span>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/documents/${doc.id}/attempts`);
                            }}
                            className="inline-flex items-center gap-0.5 text-neutral-500 underline underline-offset-2 hover:text-neutral-900 transition cursor-pointer"
                          >
                            {t("history.examHistory")}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-neutral-50 group-hover:bg-neutral-100 flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 transition shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              /* State 5: Empty State */
              <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-500">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <h2 className="text-base font-semibold text-neutral-900 mb-1">
                  {t("history.emptyTitle")}
                </h2>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
                  {t("history.emptyDesc")}
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("history.emptyButton")}</span>
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-500">
        {t("footer.tagline")}
      </footer>
    </div>
  );
}
