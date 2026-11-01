import { Check, X } from "lucide-react";

import type { MarcaOcupado } from "@/lib/temas-rifa";

/**
 * Estilos de las casillas de la grilla pública. Libre y vendido se distinguen
 * por forma y no solo por color (en temas oscuros los dos tonos quedaban casi
 * iguales): la libre va rellena con borde del acento; la vendida sin relleno,
 * borde punteado, número apagado y una marca encima.
 * Usan las CSS vars del tema (`--rifa-*`).
 */
export const CELDA_LIBRE =
  "border-2 bg-[var(--rifa-surface)] text-[var(--rifa-text)] border-[color-mix(in_srgb,var(--rifa-accent)_45%,transparent)]";
export const CELDA_OCUPADA =
  "relative border border-dashed border-[var(--rifa-line)] bg-transparent text-[var(--rifa-ocupado-ink)]";

/** Número de una casilla vendida, con la marca elegida en la rifa. */
export function NumeroOcupado({ texto, marca }: { texto: string; marca: MarcaOcupado }) {
  if (marca === "tachado") {
    return (
      <span className="line-through decoration-2 decoration-[var(--rifa-accent)] opacity-70">{texto}</span>
    );
  }
  // Insignia en la esquina: la marca se ve de lejos y el número sigue legible.
  const Icono = marca === "chulito" ? Check : X;
  return (
    <>
      <span className="opacity-60">{texto}</span>
      <span
        aria-hidden
        className="absolute -right-1 -top-1 flex size-[45%] min-h-3 min-w-3 items-center justify-center rounded-full bg-[var(--rifa-accent)] text-[var(--rifa-accent-ink)] shadow-sm"
      >
        <Icono strokeWidth={4} className="size-[75%]" />
      </span>
    </>
  );
}
