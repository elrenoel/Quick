"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import {
  FileText,
  Clock,
  ArrowRight,
  Plus,
  Loader2,
  AlertCircle,
  User as UserIcon,
  LogOut,
  FolderOpen,
} from "lucide-react";

interface UserDocument {
  id: string;
  title: string;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = useSession();

  const [documentsList, setDocumentsList] = useState<UserDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
          throw new Error(err.error || "Gagal memuat histori dokumen.");
        }
        const data = await res.json();
        setDocumentsList(data.documents || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Terjadi kesalahan saat memuat histori."
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
              Beranda
            </Link>

            <Link
              href="/history"
              className="px-3 py-1.5 text-xs font-medium text-neutral-900 font-semibold transition"
            >
              Riwayat
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
                      title="Keluar dari akun"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Keluar</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/login"
                      className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 transition"
                    >
                      Masuk
                    </Link>
                    <Link
                      href="/register"
                      className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition shadow-2xs"
                    >
                      Daftar
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
              Riwayat Dokumen
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              Daftar seluruh materi kuliah yang pernah Anda proses menjadi flashcard &amp; kuis.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload PDF Baru</span>
          </Link>
        </div>

        {/* State 1: Belum Login */}
        {!isSessionPending && !session?.user && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-600">
              <UserIcon className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-neutral-900 mb-1.5">
              Masuk untuk melihat riwayat
            </h2>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
              Silakan login terlebih dahulu untuk mengakses seluruh dokumen dan materi belajar yang telah Anda simpan.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
            >
              <span>Masuk Sekarang</span>
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
          <div className="flex items-start gap-2.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-4 rounded-xl mb-6">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
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
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white flex items-center justify-center text-neutral-700 shrink-0 transition">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-neutral-900 tracking-tight truncate group-hover:text-neutral-900">
                          {doc.title}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(doc.createdAt)}</span>
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
                  Belum ada dokumen, yuk upload PDF pertamamu
                </h2>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
                  Materi yang Anda unggah akan tersimpan di sini sehingga Anda bisa mempelajari ulang flashcard dan kuis kapan saja.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload PDF Pertama</span>
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-500">
        Quick — AI Flashcard &amp; Quiz App
      </footer>
    </div>
  );
}
