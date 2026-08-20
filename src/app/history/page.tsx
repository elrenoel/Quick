"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { useSession } from "@/lib/session-provider";
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
  Trash2,
} from "lucide-react";
import ErrorState from "@/components/ErrorState";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

interface DeleteConfirmDialogProps {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ title, message, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 backdrop-blur-sm px-6"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-lg w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-neutral-600 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            autoFocus
            onClick={onCancel}
            className="py-2.5 px-5 rounded-xl bg-white border border-neutral-200 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
          >
            {t("quiz.checkAgain")}
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t("history.delete")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface UserDocument {
  id: string;
  title: string;
  createdAt: string;
  lastAttempt?: { score: number; total: number; createdAt: string } | null;
}

async function fetchDocuments(): Promise<UserDocument[]> {
  const res = await fetch("/api/documents");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch documents");
  }
  const data = await res.json();
  return data.documents || [];
}

async function renameDocument(
  id: string,
  title: string
): Promise<{ document: { title: string } }> {
  const res = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to rename document");
  }
  return res.json();
}

export default function HistoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: session, isPending: isSessionPending, invalidate: invalidateSession } = useSession();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ── Rename state ───────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  // ── Fetch documents with useQuery ──────────────────────────────────────────
  const {
    data: documentsList = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.documents,
    queryFn: fetchDocuments,
    enabled: !isSessionPending && !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes — avoid re-fetch when navigating back
  });

  // ── Rename mutation ────────────────────────────────────────────────────────
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameDocument(id, title),
    onSuccess: (data, variables) => {
      // Optimistic update: immediately reflect the new title in cache
      queryClient.setQueryData<UserDocument[]>(
        queryKeys.documents,
        (old) =>
          old?.map((d) =>
            d.id === variables.id
              ? { ...d, title: data?.document?.title ?? variables.title }
              : d
          ) ?? []
      );
      cancelRename();
    },
    onError: (err: Error) => {
      setRenameError(err.message || t("history.renameError"));
    },
    onSettled: () => {
      renameMutation.reset();
    },
  });

  // ── Delete (soft) mutation ─────────────────────────────────────────────────
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete document");
      }
      return res.json();
    },
    onSuccess: (_data, docId) => {
      // Remove from cache immediately
      queryClient.setQueryData<UserDocument[]>(
        queryKeys.documents,
        (old) => old?.filter((d) => d.id !== docId) ?? []
      );
      // Invalidate trash cache so trash page shows the new entry
      queryClient.invalidateQueries({ queryKey: queryKeys.trash });
      setDeleteTargetId(null);
      setDeleteTargetTitle("");
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      invalidateSession();
      router.push("/");
      router.refresh();
    } catch {
      // Ignored
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ── Rename functions ───────────────────────────────────────────────────────
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
      setRenameError(
        t("history.renamePlaceholder") + " " + t("error.defaultMessage").split(".")[0]
      );
      return;
    }

    const current = documentsList.find((d) => d.id === editingId);
    if (current && current.title === newTitle) {
      cancelRename();
      return;
    }

    setRenameError(null);
    renameMutation.mutate({ id: editingId, title: newTitle });
  };

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents });
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

            <Link
              href="/trash"
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-0.5" />
              {t("trash.pageTitle")}
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

        {/* State 1: Not logged in */}
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
              title={t("history.loadErrorTitle")}
              message={t("history.loadErrorMessage")}
              compact
              actions={[
                {
                  label: t("error.retry"),
                  onClick: handleRetry,
                  variant: "primary",
                },
              ]}
            />
          </div>
        )}

        {/* State 4: Document List */}
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
                              placeholder={t("history.renamePlaceholder")}
                              disabled={renameMutation.isPending}
                              className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 disabled:opacity-50"
                            />
                            <button
                              type="submit"
                              disabled={renameMutation.isPending || !editingTitle.trim()}
                              title={t("history.renameSave")}
                              className="shrink-0 w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer"
                            >
                              {renameMutation.isPending ? (
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
                              disabled={renameMutation.isPending}
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

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTargetId(doc.id);
                          setDeleteTargetTitle(doc.title);
                        }}
                        title={t("history.delete")}
                        className="w-8 h-8 rounded-lg bg-neutral-50 hover:bg-rose-50 flex items-center justify-center text-neutral-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-8 h-8 rounded-lg bg-neutral-50 group-hover:bg-neutral-100 flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 transition">
                        <ArrowRight className="w-4 h-4" />
                      </div>
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

      {/* Delete Confirm Dialog */}
      {deleteTargetId && (
        <DeleteConfirmDialog
          title={t("history.deleteConfirmTitle")}
          message={t("history.deleteConfirmMessage", { title: deleteTargetTitle })}
          onCancel={() => {
            setDeleteTargetId(null);
            setDeleteTargetTitle("");
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
