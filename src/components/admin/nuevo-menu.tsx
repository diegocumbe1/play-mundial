"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Ticket, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

const OPCIONES = [
  { href: "/admin/rifas/nueva", label: "Nueva rifa", icon: Ticket },
  { href: "/admin/torneos/nuevo", label: "Nuevo torneo", icon: Trophy },
] as const;

/**
 * Selector de creación del backoffice. Sustituye al antiguo enlace "Nueva",
 * que asumía que el único producto era la rifa.
 */
export function NuevoMenu({
  className,
  torneos = false,
}: {
  className?: string;
  /** El módulo de torneos es por invitación: si no está, no se ofrece crear uno. */
  torneos?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Cierra al hacer clic fuera o con Escape (el menú vive en una barra fija).
  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium transition-colors"
      >
        <Plus className="size-3.5" /> Nueva
        <ChevronDown className={cn("size-3 transition-transform", abierto && "rotate-180")} />
      </button>

      {abierto && (
        <div
          role="menu"
          className="border-border bg-background absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border shadow-lg"
        >
          {OPCIONES.filter((o) => o.href !== "/admin/torneos/nuevo" || torneos).map((o) => {
            const Icon = o.icon;
            return (
              <Link
                key={o.href}
                href={o.href}
                role="menuitem"
                onClick={() => setAbierto(false)}
                className="hover:bg-muted flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors"
              >
                <Icon className="text-muted-foreground size-4" />
                {o.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
