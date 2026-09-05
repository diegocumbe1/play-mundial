"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Users, X } from "lucide-react";

import { BoletaModal } from "@/components/rifa/boleta-modal";
import { BoletasLoteModal } from "@/components/rifa/boletas-lote-modal";
import { Button } from "@/components/ui/button";
import { anchoNumeros, formatCOP, formatNumero, numerosDeRifa } from "@/lib/rifa";
import type { Boleta, Rifa } from "@/types";

/** Grilla de números del backoffice: 3 estados y gestión por número. */
export function GrillaAdmin({
  rifa,
  boletas,
}: {
  rifa: Rifa;
  boletas: Boleta[];
}) {
  const [abierto, setAbierto] = useState<number | null>(null);
  /** Modo "varios números para un mismo comprador". */
  const [multi, setMulti] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [modalLote, setModalLote] = useState(false);

  const porNumero = useMemo(() => {
    const m = new Map<number, Boleta>();
    for (const b of boletas) m.set(b.numero, b);
    return m;
  }, [boletas]);

  const ancho = anchoNumeros(rifa);
  const numeros = numerosDeRifa(rifa);
  const elegidos = [...seleccion].sort((a, b) => a - b);

  function alternar(n: number) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  function salirDeMulti() {
    setMulti(false);
    setSeleccion(new Set());
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {multi
            ? "Toca los números libres que le vas a vender a la misma persona."
            : "Toca un número para gestionarlo."}
        </p>
        {multi ? (
          <Button variant="ghost" size="sm" onClick={salirDeMulti}>
            <X className="size-3.5" /> Salir de selección
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setMulti(true)}>
            <CheckSquare className="size-3.5" /> Vender varios a una persona
          </Button>
        )}
      </div>

      {/* 10 columnas fijas (como un talonario): las 100 boletas caben en una vista. */}
      <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
        {numeros.map((n) => {
          const b = porNumero.get(n);
          const estado = b?.estado ?? "libre";
          const elegido = seleccion.has(n);
          const base =
            "tap-scale flex aspect-square w-full items-center justify-center rounded-md text-[10px] font-bold tabular-nums transition-colors sm:text-xs";
          const cls = elegido
            ? "bg-primary text-primary-foreground ring-2 ring-primary"
            : estado === "pagado"
              ? "bg-emerald-500/20 text-emerald-700 line-through decoration-emerald-600/60 dark:text-emerald-300"
              : estado === "reservado"
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                : "bg-muted text-foreground hover:bg-muted/70";
          // En modo selección los números ya tomados no se pueden elegir.
          const bloqueado = multi && estado !== "libre";
          return (
            <button
              key={n}
              type="button"
              disabled={bloqueado}
              onClick={() => (multi ? alternar(n) : setAbierto(n))}
              className={`${base} ${cls} ${bloqueado ? "opacity-40" : ""}`}
            >
              {formatNumero(n, ancho)}
            </button>
          );
        })}
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5"><i className="bg-muted size-3 rounded" /> Libre</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-amber-500/40" /> Apartado</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded bg-emerald-500/40" /> Pagado</span>
      </div>

      {/* Barra de la selección múltiple */}
      {multi && elegidos.length > 0 && (
        <div className="border-border bg-card sticky bottom-4 z-10 mt-3 flex items-center justify-between gap-3 rounded-xl border p-3 shadow-lg">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {elegidos.length} número(s) · {formatCOP(elegidos.length * rifa.precio_boleta)}
            </p>
            <p className="text-muted-foreground truncate text-xs tabular-nums">
              {elegidos.map((n) => formatNumero(n, ancho)).join(", ")}
            </p>
          </div>
          <Button size="sm" onClick={() => setModalLote(true)}>
            <Users className="size-4" /> Asignar comprador
          </Button>
        </div>
      )}

      {abierto !== null && (
        <BoletaModal
          rifaId={rifa.id}
          rifa={rifa}
          numero={abierto}
          boleta={porNumero.get(abierto)}
          ancho={ancho}
          open
          onClose={() => setAbierto(null)}
        />
      )}

      {modalLote && (
        <BoletasLoteModal
          rifaId={rifa.id}
          numeros={elegidos}
          ancho={ancho}
          precio={rifa.precio_boleta}
          open
          onClose={() => setModalLote(false)}
          onListo={salirDeMulti}
        />
      )}
    </>
  );
}
