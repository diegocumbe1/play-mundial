import type { EstadoPartido, PartidoExterno } from "@/types";

import { fetchConReintentos } from "./fetch-con-reintentos";

/**
 * Proveedor: football-data.org (v4).
 *
 * Config por env:
 *   FOOTBALL_DATA_TOKEN        -> token gratuito (requerido) — header X-Auth-Token
 *   FOOTBALL_DATA_COMPETITION  -> código de competición (default WC = FIFA World Cup).
 *                                 Otros gratis: CL, PL, PD, SA, BL1, FL1, EC, BSA…
 *   FOOTBALL_DATA_SEASON       -> año de inicio de temporada (opcional; si se
 *                                 omite, usa la temporada vigente)
 *   FOOTBALL_DATA_BASE_URL     -> base url (default api.football-data.org/v4)
 *
 * A diferencia del plan Free de API-Football, este SÍ trae partidos futuros
 * (status SCHEDULED/TIMED) de la temporada vigente.
 */

const BASE_URL =
  process.env.FOOTBALL_DATA_BASE_URL ?? "https://api.football-data.org/v4";
const COMPETITION = process.env.FOOTBALL_DATA_COMPETITION ?? "WC";
const SEASON = process.env.FOOTBALL_DATA_SEASON;

interface FdTeam {
  name: string | null;
  crest: string | null;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  competition: { name: string };
  season: { startDate: string };
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: { fullTime: { home: number | null; away: number | null } };
}

interface FdResponse {
  matches?: FdMatch[];
  message?: string;
  error?: number;
}

function mapEstado(status: string): EstadoPartido {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return "en_juego";
    case "FINISHED":
    case "AWARDED":
      return "finalizado";
    case "SUSPENDED":
    case "CANCELLED":
      return "cancelado";
    default: // SCHEDULED, TIMED, POSTPONED
      return "programado";
  }
}

function mapMatch(m: FdMatch): PartidoExterno {
  return {
    external_id: `fd:${m.id}`,
    liga: m.competition?.name ?? null,
    temporada: m.season?.startDate?.slice(0, 4) ?? SEASON ?? null,
    // En fases por definir, football-data deja los equipos en null.
    equipo_local: m.homeTeam?.name ?? "Por definir",
    equipo_visitante: m.awayTeam?.name ?? "Por definir",
    equipo_local_logo: m.homeTeam?.crest ?? null,
    equipo_visitante_logo: m.awayTeam?.crest ?? null,
    fecha: m.utcDate,
    goles_local: m.score?.fullTime?.home ?? null,
    goles_visitante: m.score?.fullTime?.away ?? null,
    estado: mapEstado(m.status),
    // PAUSED = medio tiempo / descanso. El partido sigue siendo 'en_juego'.
    en_pausa: m.status === "PAUSED",
  };
}

export async function fetchFootballDataFixtures(): Promise<PartidoExterno[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    throw new Error("Falta la variable de entorno FOOTBALL_DATA_TOKEN");
  }

  const url = new URL(`${BASE_URL}/competitions/${COMPETITION}/matches`);
  if (SEASON) {
    url.searchParams.set("season", SEASON);
  }

  const res = await fetchConReintentos(url, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });

  const json = (await res.json()) as FdResponse;

  if (!res.ok) {
    throw new Error(
      `football-data.org respondió ${res.status}: ${json.message ?? res.statusText}`,
    );
  }

  return (json.matches ?? []).map(mapMatch);
}
