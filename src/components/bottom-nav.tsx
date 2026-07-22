"use client";

import type { ComponentType } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Gamepad2, LayoutGrid, Plus, Shield, Ticket, Trophy } from "lucide-react";

import type { Idioma } from "@/lib/idioma";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

/** Navegación del Mundial (solo cuando la polla está activa). */
const ITEMS_POLLA: Record<Idioma, Item[]> = {
  es: [
    { href: "/", label: "Partidos", icon: CalendarDays },
    { href: "/resultados", label: "Resultados", icon: Trophy },
    { href: "/jugar", label: "Jugar", icon: Gamepad2 },
    { href: "/admin", label: "Admin", icon: Shield },
  ],
  en: [
    { href: "/", label: "Matches", icon: CalendarDays },
    { href: "/resultados", label: "Results", icon: Trophy },
    { href: "/jugar", label: "Play", icon: Gamepad2 },
    { href: "/admin", label: "Admin", icon: Shield },
  ],
};

/** Navegación del backoffice de rifas (mobile-first). */
const ITEMS_RIFAS: Item[] = [
  { href: "/admin", label: "Panel", icon: LayoutGrid },
  { href: "/admin/rifas", label: "Rifas", icon: Ticket },
  { href: "/admin/rifas/nueva", label: "Nueva", icon: Plus },
];

/**
 * Navegación inferior estilo app (mobile). Se oculta en `sm+` (manda el header).
 *
 * En modo "rifas" solo aparece dentro del backoffice (`/admin`, `/superadmin`):
 * el enlace público de una rifa se comparte con compradores y no debe mostrar
 * navegación de administración.
 */
export function BottomNav({
  idioma = "es",
  modo = "polla",
}: {
  idioma?: Idioma;
  modo?: "polla" | "rifas";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const esBackoffice =
    pathname.startsWith("/admin") || pathname.startsWith("/superadmin");
  const enLogin = pathname.startsWith("/admin/login");

  // Modo rifas: nav solo en el backoffice (y nunca en el login).
  if (modo === "rifas" && (!esBackoffice || enLogin)) return null;

  const items = modo === "rifas" ? ITEMS_RIFAS : ITEMS_POLLA[idioma];

  const esActivo = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/admin"
        ? pathname === "/admin"
        : pathname === href || pathname.startsWith(`${href}/`);

  // Tocar el tab en el que ya estás refresca la pantalla.
  function alTocar(e: React.MouseEvent, href: string) {
    if (!esActivo(href)) return;
    e.preventDefault();
    startTransition(() => router.refresh());
  }

  const esRifas = modo === "rifas";

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 h-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden",
        esRifas
          ? "border-border bg-background/85"
          : "border-polla-line/60 bg-polla-dark/80",
      )}
    >
      <ul className="mx-auto flex h-[var(--bottom-nav-height)] max-w-md items-stretch">
        {items.map((it) => {
          const activo = esActivo(it.href);
          const Icon = it.icon;
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                onClick={(e) => alTocar(e, it.href)}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium transition-colors",
                  esRifas
                    ? activo
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                    : activo
                      ? "text-polla-gold"
                      : "text-polla-muted hover:text-white",
                )}
              >
                <Icon className="size-[1.35rem]" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
