"use client";

import { useState } from "react";

import { formatNumero } from "@/lib/rifa";

/** Desde cuántos números la grilla se pinta por bloques de 100 y no entera. */
export const UMBRAL_BLOQUES = 1000;
export const TAM_BLOQUE = 100;

/** Primer número del bloque de 100 al que pertenece `n`. */
export function bloqueDe(n: number, inicio: number): number {
  return inicio + Math.floor((n - inicio) / TAM_BLOQUE) * TAM_BLOQUE;
}

/** Estilos por contexto: la página pública usa las variables del tema de la rifa. */
const TONOS = {
  publica: {
    activo: "bg-[var(--rifa-accent)] text-[var(--rifa-accent-ink)]",
    normal: "border border-[var(--rifa-line)] bg-[var(--rifa-surface)]",
    sub: "text-[var(--rifa-muted)]",
    input: "border-[var(--rifa-line)] bg-[var(--rifa-surface)]",
  },
  admin: {
    activo: "bg-primary text-primary-foreground",
    normal: "border border-border bg-muted/40 hover:bg-muted",
    sub: "text-muted-foreground",
    input: "border-input bg-background",
  },
} as const;

/**
 * Navegación de una grilla grande (10.000 números = 100 bloques de 100). En vez
 * de pintar todo —inusable en un celular— se elige el millar y luego la
 * centena; cada chip dice cuántos libres le quedan para ir directo a donde hay.
 */
export function BloquesGrilla({
  inicio,
  ultimo,
  ancho,
  bloque,
  onBloque,
  libresEn,
  tono,
}: {
  inicio: number;
  ultimo: number;
  ancho: number;
  /** Primer número del bloque visible. */
  bloque: number;
  onBloque: (bloque: number) => void;
  /** Libres entre `desde` y `hasta` (inclusive). */
  libresEn: (desde: number, hasta: number) => number;
  tono: keyof typeof TONOS;
}) {
  const t = TONOS[tono];
  const [buscar, setBuscar] = useState("");

  // Primer nivel: tramos de 1.000 solo si hay más de 10 bloques.
  const tamMillar = TAM_BLOQUE * 10;
  const millares: number[] = [];
  for (let m = inicio; m <= ultimo; m += tamMillar) millares.push(m);
  const millarActual = inicio + Math.floor((bloque - inicio) / tamMillar) * tamMillar;
  const centenas: number[] = [];
  for (let b = millarActual; b <= Math.min(ultimo, millarActual + tamMillar - 1); b += TAM_BLOQUE) {
    centenas.push(b);
  }

  const rango = (desde: number, tam: number) =>
    `${formatNumero(desde, ancho)}–${formatNumero(Math.min(ultimo, desde + tam - 1), ancho)}`;

  function ir() {
    const n = Number(buscar.trim());
    if (!Number.isInteger(n) || n < inicio || n > ultimo) return;
    onBloque(bloqueDe(n, inicio));
  }

  const chip = (activo: boolean) =>
    `tap-scale flex flex-col items-center rounded-md px-1 py-1.5 text-[11px] font-semibold tabular-nums transition-colors ${
      activo ? t.activo : t.normal
    }`;

  return (
    <div className="mb-3 flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ir();
        }}
      >
        <input
          inputMode="numeric"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value.replace(/\D/g, ""))}
          placeholder={`Busca un número (${formatNumero(inicio, ancho)}–${formatNumero(ultimo, ancho)})`}
          className={`h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm ${t.input}`}
        />
        <button type="submit" className={`rounded-lg px-3 text-sm font-semibold ${t.activo}`}>
          Ir
        </button>
      </form>

      {millares.length > 1 && (
        <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
          {millares.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onBloque(m)}
              aria-pressed={m === millarActual}
              className={chip(m === millarActual)}
            >
              {rango(m, tamMillar)}
              <span className={`text-[9px] font-normal ${m === millarActual ? "" : t.sub}`}>
                {libresEn(m, m + tamMillar - 1)} libres
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
        {centenas.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onBloque(b)}
            aria-pressed={b === bloque}
            className={chip(b === bloque)}
          >
            {rango(b, TAM_BLOQUE)}
            <span className={`text-[9px] font-normal ${b === bloque ? "" : t.sub}`}>
              {libresEn(b, b + TAM_BLOQUE - 1)} libres
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
