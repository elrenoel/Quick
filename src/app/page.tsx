"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import { useSession } from "@/lib/session-provider";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/layout/Navbar";

/**
 * Landing page — shown to unauthenticated visitors.
 * Redirects to /app if the user is already logged in.
 * Content is intentionally minimal for now; will be expanded later.
 */
export default function LandingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: session, isPending } = useSession();

  // Redirect logged-in users straight to the app
  useEffect(() => {
    if (!isPending && session?.user) {
      router.replace("/app");
    }
  }, [session, isPending, router]);

  // Don't flash the landing page while checking session
  if (isPending || session?.user) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar
        centerContent={
          <Link
            href="/documents/demo-os-memory/flashcards"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
            <span>{t("nav.demo")}</span>
          </Link>
        }
      />

      <main className="max-w-3xl mx-auto px-6 py-24 flex-1 w-full flex flex-col items-center text-center justify-center">
        {/* Hero */}
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-neutral-900 max-w-2xl mb-6 leading-[1.1]">
          {t("landing.title")}
        </h1>

        <p className="text-neutral-600 text-base sm:text-lg max-w-xl mb-10 leading-relaxed">
          {t("landing.subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition shadow-lg"
          >
            {t("nav.register")}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl border border-neutral-200 text-neutral-700 hover:bg-neutral-100 transition"
          >
            {t("nav.login")}
          </Link>
        </div>
      </main>
    </div>
  );
}
