"use client";

import { useEffect, useState } from "react";

/**
 * Muestra el MINUTO real y el marcador en vivo de flashscore para un partido.
 *
 * Poll a `/api/live` (caché compartida en el server → 1 request a flashscore por
 * TTL sin importar cuántos lo miren). Cruza el partido por nombre de equipo.
 * Si no hay dato en vivo para este partido, no renderiza nada (el padre sigue
 * mostrando su fallback, p.ej. "Actualizado hace X").
 */

interface PartidoVivo {
  equipo_local: string;
  equipo_visitante: string;
  goles_local: number | null;
  goles_visitante: number | null;
  minuto: number | null;
  en_pausa: boolean;
}

interface RespuestaVivo {
  activo: boolean;
  partidos: PartidoVivo[];
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function coincide(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na));
}

export function MinutoEnVivo({
  local,
  visitante,
  variante = "inline",
  intervalMs = 60_000,
  fallback = null,
}: {
  /** Nombre crudo del equipo local (el mismo que guarda el proveedor). */
  local: string;
  /** Nombre crudo del equipo visitante. */
  visitante: string;
  variante?: "inline" | "badge";
  intervalMs?: number;
  /** Qué mostrar mientras no hay dato en vivo de flashscore. */
  fallback?: React.ReactNode;
}) {
  const [vivo, setVivo] = useState<PartidoVivo | null>(null);

  useEffect(() => {
    let activo = true;

    async function tick() {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const data = (await res.json()) as RespuestaVivo;
        const m =
          data.partidos?.find(
            (p) =>
              coincide(p.equipo_local, local) &&
              coincide(p.equipo_visitante, visitante),
          ) ?? null;
        if (activo) setVivo(m);
      } catch {
        // Silencioso: no rompemos la UI si el proveedor falla.
      }
    }

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [local, visitante, intervalMs]);

  if (!vivo) return <>{fallback}</>;

  const etiqueta = vivo.en_pausa
    ? "Descanso"
    : vivo.minuto != null
      ? `${vivo.minuto}'`
      : "En vivo";
  const marcador =
    vivo.goles_local != null && vivo.goles_visitante != null
      ? `${vivo.goles_local}-${vivo.goles_visitante}`
      : null;

  if (variante === "badge") {
    return (
      <span className="bg-polla-red/15 text-polla-red ring-polla-red/30 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1">
        <span className="bg-polla-red size-1.5 animate-pulse rounded-full" aria-hidden />
        {etiqueta}
        {marcador && <span className="text-white">· {marcador}</span>}
      </span>
    );
  }

  return (
    <span className="text-polla-red inline-flex items-center gap-1.5 font-semibold tabular-nums">
      <span className="bg-polla-red size-1.5 animate-pulse rounded-full" aria-hidden />
      {etiqueta}
      {marcador && <span className="text-polla-muted">· {marcador}</span>}
    </span>
  );
}
