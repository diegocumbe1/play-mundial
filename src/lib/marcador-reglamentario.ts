import type { Partido } from "@/types";

export type Marcador = {
  goles_local: number;
  goles_visitante: number;
};

/** Marcador que liquida la polla: 90' + reposición, sin prórroga ni penales. */
export function getMarcadorReglamentario(
  partido: Partido,
): Marcador | null {
  if (
    partido.goles_reglamentario_local === null ||
    partido.goles_reglamentario_visitante === null
  ) {
    return null;
  }

  return {
    goles_local: partido.goles_reglamentario_local,
    goles_visitante: partido.goles_reglamentario_visitante,
  };
}

/** Marcador que se muestra en vivo mientras el partido no ha finalizado. */
export function getMarcadorActual(partido: Partido): Marcador | null {
  if (partido.estado === "finalizado") {
    return getMarcadorReglamentario(partido);
  }

  if (partido.goles_local === null || partido.goles_visitante === null) {
    return null;
  }

  return {
    goles_local: partido.goles_local,
    goles_visitante: partido.goles_visitante,
  };
}
