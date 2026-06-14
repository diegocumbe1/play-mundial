import type { PartidoExterno } from "@/types";

import { fetchApiFootballFixtures } from "./api-football";
import { fetchFootballDataFixtures } from "./football-data";

/**
 * Selección de proveedor de datos de fútbol vía env `FUTBOL_PROVIDER`.
 * Por defecto `apifootball` para no romper configuraciones existentes.
 */
export type FutbolProvider = "apifootball" | "footballdata";

export function getProvider(): FutbolProvider {
  return process.env.FUTBOL_PROVIDER === "footballdata"
    ? "footballdata"
    : "apifootball";
}

/** Trae los partidos del proveedor configurado, ya mapeados a `PartidoExterno`. */
export function fetchFixtures(): Promise<PartidoExterno[]> {
  return getProvider() === "footballdata"
    ? fetchFootballDataFixtures()
    : fetchApiFootballFixtures();
}
