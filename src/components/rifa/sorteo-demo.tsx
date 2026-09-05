"use client";

import { useMemo, useState } from "react";
import { PlayCircle, Shuffle, X } from "lucide-react";

import { SorteoAnimado } from "@/components/rifa/sorteo-animado";
import { construirBolas, labelSorteoPropio, tieneRondaFinal } from "@/lib/rifa";
import type { BolaSorteo, OrdenSorteo } from "@/types";

/** Saca `cuantas` números distintos al azar dentro del rango (solo para la demo). */
function numerosDeEjemplo(cuantas: number, min: number, max: number): number[] {
  const disponibles = Array.from({ length: Math.max(1, max - min + 1) }, (_, i) => min + i);
  const salida: number[] = [];
  for (let i = 0; i < Math.min(cuantas, disponibles.length); i++) {
    const j = i + Math.floor(Math.random() * (disponibles.length - i));
    [disponibles[i], disponibles[j]] = [disponibles[j], disponibles[i]];
    salida.push(disponibles[i]);
  }
  return salida;
}

/**
 * Simulación de cómo va a salir el sorteo: mismos pasos, mismas etiquetas
 * ("no válido" / premio) y el mismo componente que se usa el día del sorteo,
 * pero con números de ejemplo. Sirve para que el organizador —y el comprador—
 * entiendan la mecánica ANTES de que haya nada en juego.
 */
export function SorteoDemo({
  bolas,
  ganadores = 1,
  orden,
  premios,
  min,
  max,
  ancho,
  className,
}: {
  /** Balotas finalistas de la 1ª ronda (la demo cambia con este número). */
  bolas: number;
  /** Ganadoras que salen de esas finalistas en la 2ª ronda. */
  ganadores?: number;
  orden: OrdenSorteo;
  /** Descripción de los premios, del mayor al menor. */
  premios: string[];
  min: number;
  max: number;
  ancho: number;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  /** Cambia para volver a sortear la demo con otros números. */
  const [tirada, setTirada] = useState(0);

  const cuantas = Math.min(10, Math.max(1, bolas));
  const cuantasGanadoras = Math.min(cuantas, Math.max(1, ganadores));
  const clavePremios = premios.filter((p) => p.trim()).join("|");

  const demo = useMemo<BolaSorteo[]>(() => {
    const lista = clavePremios ? clavePremios.split("|") : ["Premio mayor"];
    const finalistas = numerosDeEjemplo(cuantas, min, max);
    // Misma mecánica del sorteo real: si hay ronda final, las ganadoras salen
    // de entre las finalistas (no del total de números).
    const finales = tieneRondaFinal(cuantas, cuantasGanadoras)
      ? numerosDeEjemplo(cuantasGanadoras, 0, finalistas.length - 1).map(
          (i) => finalistas[i],
        )
      : [];
    return construirBolas({ finalistas, finales, premios: lista, orden });
    // `tirada` es justamente lo que fuerza a re-sortear la demo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tirada, cuantas, cuantasGanadoras, orden, min, max, clavePremios]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setTirada((t) => t + 1);
          setAbierto(true);
        }}
        className={
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors " +
          "border-[var(--rifa-line,var(--border))] hover:bg-[var(--rifa-ocupado,var(--muted))] " +
          (className ?? "")
        }
      >
        <PlayCircle className="size-4" /> Ver simulación del sorteo
      </button>
    );
  }

  return (
    <div
      className={
        "rounded-xl border p-3 border-[var(--rifa-line,var(--border))] " + (className ?? "")
      }
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Simulación</p>
          <p className="text-xs text-[var(--rifa-muted,var(--muted-foreground))]">
            {labelSorteoPropio(cuantas, cuantasGanadoras, orden)} Los números son de ejemplo: pulsa el
            botón para sacar cada balota, igual que el día del sorteo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar simulación"
          className="text-[var(--rifa-muted,var(--muted-foreground))] rounded-md p-1 hover:bg-[var(--rifa-ocupado,var(--muted))]"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Manual a propósito: la simulación enseña el mismo botón que vas a
          usar el día del sorteo. */}
      <SorteoAnimado
        key={tirada}
        bolas={demo}
        ancho={ancho}
        min={min}
        max={max}
        modo="manual"
        finalistas={tieneRondaFinal(cuantas, cuantasGanadoras) ? cuantas : 0}
      />

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => setTirada((t) => t + 1)}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline text-[var(--rifa-accent,var(--primary))]"
        >
          <Shuffle className="size-3.5" /> Simular otra vez
        </button>
      </div>
    </div>
  );
}
