import type { GoleadorFlash, MarcadorLV, Partido } from "@/types";

/**
 * Deriva de un `Partido` todo lo que la UI necesita mostrar del resultado:
 * el marcador que LIQUIDA (reglamentario), el final oficial (incl. prórroga),
 * y el desglose informativo (prórroga, penales, goleadores).
 *
 * Regla de la polla: solo cuenta el 90' (reglamentario). El resto se muestra
 * como contexto, marcado claramente como "no afecta los premios".
 */
export interface ResumenPartido {
  /** Marcador a los 90' que liquida la polla. `null` si aún no hay. */
  reglamentario: MarcadorLV | null;
  /** Marcador final oficial (incluye prórroga). `null` si aún no hay. */
  final: MarcadorLV | null;
  /** Solo el alargue; `null` si no hubo goles en alargue. */
  alargue: MarcadorLV | null;
  /** Tanda de penales; `null` si no hubo tanda. */
  penales: MarcadorLV | null;
  /** El final difiere del reglamentario: hubo tiempo extra que no cuenta. */
  finalDifiere: boolean;
  /** Ganador de la tanda (para "clasificado"). */
  ganadorPenales: "local" | "visitante" | null;
  /** Goleadores en juego (reglamentario + alargue), en orden. */
  goleadores: GoleadorFlash[];
  /** Hay algo extra que explicar (prórroga o penales). */
  hayExtra: boolean;
}

function marcador(l: number | null, v: number | null): MarcadorLV | null {
  return l !== null && v !== null ? { local: l, visitante: v } : null;
}

export function resumenPartido(p: Partido): ResumenPartido {
  const reglamentario = marcador(
    p.goles_reglamentario_local,
    p.goles_reglamentario_visitante,
  );
  // El final REAL de flashscore manda sobre el del proveedor (que a veces trae
  // un marcador equivocado en partidos con prórroga/penales).
  const final =
    p.detalle_flash?.final ?? marcador(p.goles_local, p.goles_visitante);
  const alargue = p.detalle_flash?.alargue ?? null;
  const penales = p.detalle_flash?.penales ?? null;

  const finalDifiere = Boolean(
    reglamentario &&
      final &&
      (final.local !== reglamentario.local ||
        final.visitante !== reglamentario.visitante),
  );

  const ganadorPenales = penales
    ? penales.local > penales.visitante
      ? "local"
      : "visitante"
    : null;

  return {
    reglamentario,
    final,
    alargue,
    penales,
    finalDifiere,
    ganadorPenales,
    goleadores: p.detalle_flash?.goleadores ?? [],
    hayExtra: finalDifiere || penales !== null || alargue !== null,
  };
}
