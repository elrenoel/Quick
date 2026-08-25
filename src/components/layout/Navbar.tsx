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
    <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FDF7EB] text-xs font-medium transition"
      title="Bahasa / Language"
      style={{ color: '#041914' }}
    >
      <Languages className="w-3.5 h-3.5 shrink-0" style={{ color: '#041914' }} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Bahasa / Language"
        className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
        style={{ color: '#041914' }}
      >
        <option value="id" className="bg-[#FDF7EB]" style={{ color: '#041914' }}>ID</option>
        <option value="en" className="bg-[#FDF7EB]" style={{ color: '#041914' }}>EN</option>
      </select>
    </div>
  );

  // ── User menu dropdown ────────────────────────────────────────────────
  const userMenu = !isSessionPending && session?.user && (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#FDF7EB] border border-[#FDF7EB]/30 text-xs font-medium transition cursor-pointer"
        style={{ color: '#041914' }}
      >
        <UserIcon className="w-3.5 h-3.5" style={{ color: '#041914' }} />
        <span className="hidden sm:inline truncate max-w-[100px]">
          {session.user.name || session.user.email}
        </span>
        <EllipsisVertical className="w-3.5 h-3.5" style={{ color: '#041914' }} />
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
          absolute right-0 mt-2 w-56 rounded-xl shadow-lg z-50 overflow-hidden
          transition-all duration-200 ease-out origin-top-right
          ${menuOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }
        `}
        style={{ backgroundColor: '#FDF7EB' }}
      >
        {/* User info header */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #ccc' }}>
          <p className="text-sm font-medium truncate" style={{ color: '#041914' }}>
            {session.user.name}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: '#041914', opacity: 0.7 }}>
            {session.user.email}
          </p>
        </div>

        {/* Menu items */}
        <div className="py-1.5">
          <Link
            href="/history"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#EDEABF] transition-colors"
            style={{ color: '#041914' }}
          >
            <Clock className="w-4 h-4" style={{ color: '#041914' }} />
            {t("nav.history")}
          </Link>
          <Link
            href="/trash"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#EDEABF] transition-colors"
            style={{ color: '#041914' }}
          >
            <Trash2 className="w-4 h-4" style={{ color: '#041914' }} />
            {t("nav.trash")}
          </Link>
        </div>

        {/* Logout */}
        <div className="py-1.5" style={{ borderTop: '1px solid #ccc' }}>
          <button
            onClick={() => {
              setMenuOpen(false);
              handleLogout();
            }}
            disabled={isLoggingOut}
            title={t("nav.logoutTitle")}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors disabled:opacity-50 cursor-pointer"
            style={{ color: '#041914' }}
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
            className="px-3 py-1.5 text-xs font-medium transition"
            style={{ color: '#FDF7EB' }}
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/register"
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg transition shadow-2xs"
            style={{ backgroundColor: '#FDF7EB', color: '#013528' }}
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
        className="w-8 h-8 rounded-lg bg-[#FDF7EB] hover:bg-[#FDF7EB]/50 flex items-center justify-center text-neutral-900 transition"
        title={t("error.backToHome")}
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>
      {title && (
        <div className="min-w-0">
          <h1 className="font-semibold text-[#FDF7EB] text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-md">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-[#FDF7EB] font-mono">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  ) : (
    <Link href={isLoggedIn ? "/app" : "/"} className="flex items-center gap-2.5 group">
      <img
        src="/logo_yoohoo.png"
        alt="Yoohoo logo"
        className="w-8 h-8 rounded-lg object-contain"
      />
      <span className="font-semibold tracking-tight text-lg" style={{ color: '#FDF7EB' }}>
        Yoohoo
      </span>
    </Link>
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <header className="border-b border-neutral-200 bg-[#013528] sticky top-0 z-20">
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
                      ? "px-3 py-1.5 text-xs font-semibold rounded-lg transition"
                      : "px-3 py-1.5 text-xs font-medium rounded-lg transition"
                  }
                  style={{ color: '#FDF7EB' }}
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
