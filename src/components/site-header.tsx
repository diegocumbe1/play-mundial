"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Trophy } from "lucide-react";

import { cambiarIdiomaAction } from "@/actions/idioma";
import { PageRefreshButton } from "@/components/page-refresh-button";
import type { Idioma } from "@/lib/idioma";
import { cn } from "@/lib/utils";

const LINKS: Record<Idioma, { href: string; label: string }[]> = {
  es: [
    { href: "/", label: "Partidos" },
    { href: "/resultados", label: "Resultados" },
    { href: "/jugar", label: "Jugar" },
    { href: "/admin", label: "Admin" },
  ],
  en: [
    { href: "/", label: "Matches" },
    { href: "/resultados", label: "Results" },
    { href: "/jugar", label: "Play" },
    { href: "/admin", label: "Admin" },
  ],
};

/**
 * Cabecera pública sticky con blur. En mobile la navegación vive en la barra
 * inferior (BottomNav); aquí solo quedan el logo, el idioma y refrescar.
 */
export function SiteHeader({
  live = false,
  idioma = "es",
}: {
  live?: boolean;
  idioma?: Idioma;
}) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  function cambiarIdioma(next: Idioma) {
    startTransition(async () => {
      await cambiarIdiomaAction(next);
      router.refresh();
    });
  }

  const links = LINKS[idioma];

  return (
    <header className="bg-polla-dark/60 border-polla-line/70 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Trophy className="text-polla-gold size-6 shrink-0" />
          <span className="font-heading text-polla-gold truncate text-xl leading-none tracking-wide sm:text-2xl">
            Polla Mundial 2026
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {live && (
            <span className="bg-polla-red/15 text-polla-red ring-polla-red/40 animate-live hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide uppercase ring-1 sm:inline-flex">
              <span className="bg-polla-red size-1.5 animate-pulse rounded-full" />
              {idioma === "en" ? "Live" : "En vivo"}
            </span>
          )}

          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-medium transition-colors",
                    active
                      ? "text-polla-gold bg-white/5"
                      : "text-polla-muted hover:text-white",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-polla-line flex items-center rounded-lg border p-0.5">
            {(["es", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => cambiarIdioma(lang)}
                disabled={pending}
                aria-pressed={idioma === lang}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-bold transition-colors",
                  idioma === lang
                    ? "bg-polla-gold text-polla-dark"
                    : "text-polla-muted hover:text-white",
                )}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          <PageRefreshButton />
        </div>
      </div>
    </header>
  );
}
