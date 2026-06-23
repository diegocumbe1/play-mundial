"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Languages, Menu, Trophy, X } from "lucide-react";

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
 * Cabecera pública sticky con blur. `live` enciende el badge "EN VIVO".
 */
export function SiteHeader({
  live = false,
  idioma = "es",
}: {
  live?: boolean;
  idioma?: Idioma;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  function cambiarIdioma(next: Idioma) {
    startTransition(async () => {
      await cambiarIdiomaAction(next);
      setOpen(false);
      router.refresh();
    });
  }

  const links = LINKS[idioma];

  return (
    <header className="bg-polla-dark/60 border-polla-line/70 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <Trophy className="text-polla-gold size-6" />
          <span className="font-heading text-polla-gold text-xl leading-none tracking-wide sm:text-2xl">
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

          <div className="border-polla-line hidden items-center rounded-lg border p-0.5 sm:flex">
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

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-white sm:hidden"
            aria-label="Abrir menú"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-polla-line/70 bg-polla-surface border-t px-4 py-3 sm:hidden">
          {live && (
            <span className="bg-polla-red/15 text-polla-red ring-polla-red/40 mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase ring-1">
              {idioma === "en" ? "Live" : "En vivo"}
            </span>
          )}
          <div className="border-polla-line mb-2 flex w-fit items-center gap-1 rounded-lg border p-1">
            <Languages className="text-polla-muted ml-1 size-4" />
            {(["es", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => cambiarIdioma(lang)}
                disabled={pending}
                aria-pressed={idioma === lang}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold transition-colors",
                  idioma === lang
                    ? "bg-polla-gold text-polla-dark"
                    : "text-polla-muted",
                )}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex flex-col">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-3 text-base font-medium transition-colors",
                    active ? "text-polla-gold bg-white/5" : "text-white",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
