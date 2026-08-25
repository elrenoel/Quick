"use client";

import { useLanguage } from "@/hooks/use-language";

/**
 * Static Footer component.
 * Renders the same content on every page via the root layout.
 */
export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-500">
      <div className="px-6 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>{t("footer.tagline")}</span>
      </div>
    </footer>
  );
}
