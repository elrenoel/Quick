"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Languages,
  User as UserIcon,
  LogOut,
  EllipsisVertical,
  Trash2,
  Clock,
} from "lucide-react";
import { useNavbar } from "@/hooks/use-navbar";
import { useLanguage } from "@/hooks/use-language";
import type { Lang } from "@/lib/i18n";

interface NavbarProps {
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  backHref?: string;
  title?: string;
  subtitle?: React.ReactNode;
  bottomBar?: React.ReactNode;
}

export default function Navbar({
  centerContent,
  rightContent,
  backHref,
  title,
  subtitle,
  bottomBar,
}: NavbarProps) {
  const {
    session,
    isSessionPending,
    t,
    handleLogout,
    isLoggingOut,
    navLinks,
  } = useNavbar();
  const { lang, setLang } = useLanguage();

  const isLoggedIn = !isSessionPending && !!session?.user;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  // ── Language toggle ────────────────────────────────────────────────────
  const languageToggle = (
    <div
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-200 transition"
      title="Bahasa / Language"
    >
      <Languages className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Bahasa / Language"
        className="bg-transparent text-xs font-medium text-neutral-700 focus:outline-none cursor-pointer"
      >
        <option value="id">ID</option>
        <option value="en">EN</option>
      </select>
    </div>
  );

  // ── User menu dropdown ────────────────────────────────────────────────
  const userMenu = !isSessionPending && session?.user && (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-200 transition cursor-pointer"
      >
        <UserIcon className="w-3.5 h-3.5 text-neutral-500" />
        <span className="hidden sm:inline truncate max-w-[100px]">
          {session.user.name || session.user.email}
        </span>
        <EllipsisVertical className="w-3.5 h-3.5 text-neutral-400" />
      </button>

      {/* Dropdown overlay + panel */}
      <div
        className={`
          fixed inset-0 z-40
          transition-opacity duration-200
          ${menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => setMenuOpen(false)}
      />
      <div
        className={`
          absolute right-0 mt-2 w-56 rounded-xl bg-white border border-neutral-200 shadow-lg z-50 overflow-hidden
          transition-all duration-200 ease-out origin-top-right
          ${menuOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }
        `}
      >
        {/* User info header */}
        <div className="px-4 py-3 border-b border-neutral-100">
          <p className="text-sm font-medium text-neutral-900 truncate">
            {session.user.name}
          </p>
          <p className="text-xs text-neutral-500 truncate mt-0.5">
            {session.user.email}
          </p>
        </div>

        {/* Menu items */}
        <div className="py-1.5">
          <Link
            href="/history"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <Clock className="w-4 h-4 text-neutral-400" />
            {t("nav.history")}
          </Link>
          <Link
            href="/trash"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-neutral-400" />
            {t("nav.trash")}
          </Link>
        </div>

        {/* Logout */}
        <div className="border-t border-neutral-100 py-1.5">
          <button
            onClick={() => {
              setMenuOpen(false);
              handleLogout();
            }}
            disabled={isLoggingOut}
            title={t("nav.logoutTitle")}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {t("nav.logout")}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Auth section (login/register for guests) ──────────────────────────
  const authSection = !isSessionPending && (
    <>
      {session?.user ? (
        userMenu
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
  );

  // ── Left section: Logo or Back button ─────────────────────────────────
  const leftSection = backHref ? (
    <div className="flex items-center gap-3">
      <Link
        href={backHref}
        className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 transition"
        title={t("error.backToHome")}
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>
      {title && (
        <div className="min-w-0">
          <h1 className="font-semibold text-neutral-900 text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-neutral-500 font-mono">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  ) : (
    <Link href={isLoggedIn ? "/app" : "/"} className="flex items-center gap-2.5 group">
      <span className="font-semibold text-neutral-900 tracking-tight text-lg">
        Yoohoo
      </span>
    </Link>
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          {leftSection}

          {/* Default nav links (logged-in users, non-document layout) */}
          {session?.user && !backHref && (
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    link.isActive
                      ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 text-neutral-900 transition"
                      : "px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {centerContent && (
            <div className="flex items-center gap-3">{centerContent}</div>
          )}

          <div className="flex items-center gap-3">
            {rightContent}
            {languageToggle}
            {authSection}
          </div>
        </div>
      </header>
      {bottomBar}
    </>
  );
}
