"use client";

import { useMemo, useState } from "react";

import { BoletaModal } from "@/components/rifa/boleta-modal";
import type { Boleta } from "@/types";

/** Grilla de números del backoffice: 3 estados y gestión por número. */
export function GrillaAdmin({
  rifaId,
  cantidad,
  boletas,
}: {
  rifaId: string;
  cantidad: number;
  boletas: Boleta[];
}) {
  const [abierto, setAbierto] = useState<number | null>(null);

  const porNumero = useMemo(() => {
    const m = new Map<number, Boleta>();
    for (const b of boletas) m.set(b.numero, b);
    return m;
  }, [boletas]);

  const ancho = String(cantidad - 1).length;

  return (
    <>
      {/* 10 columnas fijas (como un talonario): las 100 boletas caben en una vista. */}
      <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
        {Array.from({ length: cantidad }, (_, n) => {
          const b = porNumero.get(n);
          const estado = b?.estado ?? "libre";
          const base =
            "tap-scale flex aspect-square w-full items-center justify-center rounded-md text-[10px] font-bold tabular-nums transition-colors sm:text-xs";
          const cls =
            estado === "pagado"
              ? "bg-emerald-500/20 text-emerald-700 line-through decoration-emerald-600/60 dark:text-emerald-300"
              : estado === "reservado"
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                : "bg-muted text-foreground hover:bg-muted/70";
          return (
            <button key={n} type="button" onClick={() => setAbierto(n)} className={`${base} ${cls}`}>
              {String(n).padStart(ancho, "0")}
            </button>
          );
        })}
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5"><i className="bg-muted size-3 rounded" /> Libre</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-amber-500/40" /> Apartado</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-emerald-500/40" /> Pagado</span>
      </div>

      <BoletaModal
        rifaId={rifaId}
        numero={abierto}
        boleta={abierto != null ? porNumero.get(abierto) : undefined}
        ancho={ancho}
        open={abierto !== null}
        onClose={() => setAbierto(null)}
      />
    </>
  );
}
