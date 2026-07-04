"use client";

import type { ComponentType } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Gamepad2, Shield, Trophy } from "lucide-react";

import type { Idioma } from "@/lib/idioma";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const ITEMS: Record<Idioma, Item[]> = {
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

/**
 * Navegación inferior estilo app (mobile), "cristalizada" con blur. Reemplaza al
 * menú superior en pantallas pequeñas. Se oculta en `sm+` (ahí manda el header).
 */
export function BottomNav({ idioma = "es" }: { idioma?: Idioma }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const items = ITEMS[idioma];

  const esActivo = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  // Tocar el tab en el que ya estás refresca la pantalla (como el ícono de
  // refrescar del header), sin recargar toda la página.
  function alTocar(e: React.MouseEvent, href: string) {
    if (!esActivo(href)) return;
    e.preventDefault();
    startTransition(() => router.refresh());
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="border-polla-line/60 bg-polla-dark/70 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-xl [padding-bottom:env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
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
                  activo
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
