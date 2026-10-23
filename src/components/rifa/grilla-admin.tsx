"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, Users, X } from "lucide-react";

import { BoletaModal } from "@/components/rifa/boleta-modal";
import { BoletasLoteModal } from "@/components/rifa/boletas-lote-modal";
import {
  BloquesGrilla,
  bloqueDe,
  BuscadorNumero,
  TAM_BLOQUE,
  UMBRAL_BLOQUES,
} from "@/components/rifa/bloques-grilla";
import { EleccionRapida } from "@/components/rifa/eleccion-rapida";
import { Button } from "@/components/ui/button";
import {
  anchoNumeros,
  formatCOP,
  formatNumero,
  inicioNumeros,
  numerosDeRifa,
  ultimoNumero,
} from "@/lib/rifa";
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
  const numeros = useMemo(() => numerosDeRifa(rifa), [rifa]);
  const elegidos = [...seleccion].sort((a, b) => a - b);

  // Rifas grandes: la grilla va por bloques de 100 (ver BloquesGrilla).
  const inicio = inicioNumeros(rifa);
  const grande = rifa.cantidad_numeros > UMBRAL_BLOQUES;
  const [bloque, setBloque] = useState(inicio);
  const libres = useMemo(() => numeros.filter((n) => !porNumero.has(n)), [numeros, porNumero]);
  const libresAcum = useMemo(() => {
    const acc = [0];
    for (const n of numeros) acc.push(acc[acc.length - 1] + (porNumero.has(n) ? 0 : 1));
    return acc;
  }, [numeros, porNumero]);
  const libresEn = useCallback(
    (desde: number, hasta: number) => {
      const a = Math.max(0, desde - inicio);
      const b = Math.min(numeros.length, hasta - inicio + 1);
      return b > a ? libresAcum[b] - libresAcum[a] : 0;
    },
    [libresAcum, numeros.length, inicio],
  );
  const visibles = grande
    ? numeros.slice(bloque - inicio, bloque - inicio + TAM_BLOQUE)
    : numeros;
  const minimo = Math.min(Math.max(1, rifa.min_numeros_compra ?? 1), Math.max(1, libres.length));

  // Número buscado: queda marcado en la grilla y a la vista.
  const [buscado, setBuscado] = useState<number | null>(null);
  useEffect(() => {
    if (buscado == null) return;
    document.getElementById(`num-${buscado}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [buscado, bloque]);

  function elegir(lista: number[]) {
    setSeleccion(new Set(lista));
    if (grande && lista.length > 0) setBloque(bloqueDe(lista[0], inicio));
  }

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

      {multi && (
        <EleccionRapida minimo={minimo} libres={libres} onElegir={elegir} tono="admin" />
      )}

      {grande ? (
        <BloquesGrilla
          inicio={inicio}
          ultimo={ultimoNumero(rifa)}
          ancho={ancho}
          bloque={bloque}
          onBloque={setBloque}
          libresEn={libresEn}
          tono="admin"
          onBuscar={setBuscado}
        />
      ) : (
        <BuscadorNumero
          inicio={inicio}
          ultimo={ultimoNumero(rifa)}
          ancho={ancho}
          tono="admin"
          onBuscar={setBuscado}
          className="mx-auto mb-3 max-w-3xl"
        />
      )}

      {/* 10 columnas fijas (como un talonario): las 100 boletas caben en una vista.
          Las celdas son cuadradas, así que en desktop se limita el ancho para que
          la grilla no crezca de alto con la página ancha. */}
      <div className="mx-auto grid max-w-3xl grid-cols-10 gap-1 sm:gap-1.5 lg:gap-2">
        {visibles.map((n) => {
          const b = porNumero.get(n);
          const estado = b?.estado ?? "libre";
          const elegido = seleccion.has(n);
          const base =
            "tap-scale flex aspect-square w-full items-center justify-center rounded-md text-[10px] font-bold tabular-nums transition-colors sm:text-xs lg:rounded-lg lg:text-base";
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
              id={`num-${n}`}
              type="button"
              disabled={bloqueado}
              onClick={() => (multi ? alternar(n) : setAbierto(n))}
              className={`${base} ${cls} ${bloqueado ? "opacity-40" : ""} ${
                n === buscado ? "ring-primary ring-offset-background relative z-[1] scale-110 animate-pulse ring-2 ring-offset-2" : ""
              }`}
            >
              {formatNumero(n, ancho)}
            </button>
          );
        })}
      </div>

      <div className="text-muted-foreground mx-auto mt-3 flex max-w-3xl flex-wrap gap-4 text-xs">
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
            {/* Desde el panel no se bloquea (el organizador puede tener sus razones),
                pero sí se avisa que la compra queda por debajo de su propia regla. */}
            {elegidos.length < minimo && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                La rifa pide mínimo {minimo} por compra.
              </p>
            )}
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
