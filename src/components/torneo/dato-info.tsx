"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tarjeta de una cifra con un ⓘ que explica de dónde sale. Se abre con un toque
 * (celular) o al pasar el mouse (escritorio) y se cierra al salir de la tarjeta o tocar de nuevo.
 */
export function DatoInfo({
  label,
  valor,
  sub,
  tono,
  info,
  grande = false,
}: {
  label: string;
  valor: string;
  sub?: string;
  tono?: "bueno" | "malo";
  /** Explicación: de dónde sale la cifra y cómo se calcula. */
  info?: React.ReactNode;
  grande?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div
      className="border-border relative rounded-2xl border p-3"
      onMouseEnter={() => info && setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        {info && (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-label={`¿De dónde sale «${label}»?`}
            className={cn(
              "-mt-0.5 -mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
              abierto ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Info className="size-3.5" />
          </button>
        )}
      </div>
      <p
        className={cn(
          "mt-0.5 truncate font-bold",
          grande ? "text-lg" : "text-base",
          tono === "bueno" && "text-emerald-600 dark:text-emerald-400",
          tono === "malo" && "text-destructive",
        )}
      >
        {valor}
      </p>
      {sub && <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p>}
      {info && abierto && (
        <div
          role="tooltip"
          className="bg-popover text-popover-foreground border-border absolute inset-x-0 top-full z-30 mt-1 min-w-[14rem] rounded-xl border p-2.5 text-xs leading-relaxed shadow-lg"
        >
          {info}
        </div>
      )}
    </div>
  );
}
