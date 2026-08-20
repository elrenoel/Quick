"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { useSession } from "@/lib/session-provider";
import { formatDateTime } from "@/lib/format-date";
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Info,
  User as UserIcon,
  LogOut,
} from "lucide-react";
import ErrorState from "@/components/ErrorState";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

interface TrashDocument {
  id: string;
  title: string;
  createdAt: string;
  deletedAt: string;
}

async function fetchTrashDocuments(): Promise<TrashDocument[]> {
  const res = await fetch("/api/documents/trash");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch trash");
  }
  const data = await res.json();
  return data.documents || [];
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmColor = "bg-rose-600 hover:bg-rose-700",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
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
        <p className="text-sm text-neutral-600 leading-relaxed">{message}</p>

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
            className={`py-2.5 px-5 rounded-xl ${confirmColor} text-white text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrashPage() {
  const router = useRouter();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const {
    data: session,
    isPending: isSessionPending,
    invalidate: invalidateSession,
  } = useSession();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ── Confirm dialog state ─────────────────────────────────────────────────
  const [permanentDeleteTarget, setPermanentDeleteTarget] =
    useState<TrashDocument | null>(null);

  // ── Fetch trash documents ────────────────────────────────────────────────
  const { data: trashDocs = [], isLoading, error } = useQuery({
    queryKey: queryKeys.trash,
    queryFn: fetchTrashDocuments,
    enabled: !isSessionPending && !!session?.user,
  });

  // ── Restore mutation ─────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to restore");
      }
      return res.json();
    },
    onSuccess: (_data, docId) => {
      queryClient.setQueryData<TrashDocument[]>(
        queryKeys.trash,
        (old) => old?.filter((d) => d.id !== docId) ?? []
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });

  // ── Permanent delete mutation ────────────────────────────────────────────
  const permanentDeleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/permanent`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to permanently delete");
      }
      return res.json();
    },
    onSuccess: (_data, docId) => {
      queryClient.setQueryData<TrashDocument[]>(
        queryKeys.trash,
        (old) => old?.filter((d) => d.id !== docId) ?? []
      );
      setPermanentDeleteTarget(null);
    },
  });

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

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.trash });
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
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition"
            >
              {t("nav.history")}
            </Link>

            <Link
              href="/trash"
              className="px-3 py-1.5 text-xs font-medium text-neutral-900 font-semibold transition"
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
              {t("trash.pageTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              {t("trash.pageDesc")}
            </p>
          </div>

          <Link
            href="/history"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition shadow-xs self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("trash.backToHistory")}</span>
          </Link>
        </div>

        {/* Auto-delete info banner */}
        <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            {t("trash.autoDeleteInfo")}
          </p>
        </div>

        {/* Not logged in */}
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
            </Link>
          </div>
        )}

        {/* Loading Skeleton */}
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
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-neutral-100 rounded-lg" />
                  <div className="w-8 h-8 bg-neutral-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
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

        {/* Trash List */}
        {!isLoading && session?.user && (
          <>
            {trashDocs.length > 0 ? (
              <div className="space-y-3">
                {trashDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="group bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs transition flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-neutral-900 tracking-tight truncate">
                          {doc.title}
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1 font-mono">
                          {t("trash.trashedAt", {
                            date: formatDateTime(doc.deletedAt),
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => restoreMutation.mutate(doc.id)}
                        disabled={restoreMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition disabled:opacity-50 cursor-pointer"
                      >
                        {restoreMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">{t("trash.restore")}</span>
                      </button>

                      <button
                        onClick={() => setPermanentDeleteTarget(doc)}
                        disabled={permanentDeleteMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs font-medium text-rose-700 hover:bg-rose-50 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t("trash.permanentDelete")}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-500">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h2 className="text-base font-semibold text-neutral-900 mb-1">
                  {t("trash.emptyTitle")}
                </h2>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
                  {t("trash.emptyDesc")}
                </p>
                <Link
                  href="/history"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t("trash.backToHistory")}</span>
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

      {/* Permanent Delete Confirmation Dialog */}
      {permanentDeleteTarget && (
        <ConfirmDialog
          title={t("trash.permanentDeleteTitle")}
          message={t("trash.permanentDeleteConfirm", {
            title: permanentDeleteTarget.title,
          })}
          confirmLabel={t("trash.permanentDelete")}
          onCancel={() => setPermanentDeleteTarget(null)}
          onConfirm={() => {
            if (permanentDeleteTarget) {
              permanentDeleteMutation.mutate(permanentDeleteTarget.id);
            }
          }}
        />
      )}
    </div>
  );
}
