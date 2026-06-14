import type { EstadoPartido, PartidoExterno } from "@/types";

/**
 * Proveedor: API-Football (https://www.api-football.com/).
 *
 * Config por env:
 *   API_FOOTBALL_KEY        -> clave de api-sports.io (requerida)
 *   API_FOOTBALL_BASE_URL   -> base url (default v3.football.api-sports.io)
 *   MUNDIAL_LEAGUE_ID       -> id de liga (default 1 = FIFA World Cup)
 *   MUNDIAL_SEASON          -> temporada (default 2026)
 *
 * Nota: el plan Free solo cubre temporadas 2022–2024.
 */

const BASE_URL =
  process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";
const LEAGUE_ID = process.env.MUNDIAL_LEAGUE_ID ?? "1";
const SEASON = process.env.MUNDIAL_SEASON ?? "2026";

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { name: string; season: number };
  teams: {
    home: { name: string; logo: string | null };
    away: { name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
}

interface ApiResponse<T> {
  errors: unknown;
  results: number;
  response: T[];
}

/** Mapea `status.short` de API-Football a nuestro `EstadoPartido`. */
function mapEstado(short: string): EstadoPartido {
  const finalizados = ["FT", "AET", "PEN"];
  const enJuego = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
  const cancelados = ["CANC", "ABD", "AWD", "WO"];

  if (finalizados.includes(short)) return "finalizado";
  if (enJuego.includes(short)) return "en_juego";
  if (cancelados.includes(short)) return "cancelado";
  return "programado"; // NS, TBD, PST, etc.
}

function mapFixture(f: ApiFixture): PartidoExterno {
  return {
    external_id: `af:${f.fixture.id}`,
    liga: f.league.name,
    temporada: String(f.league.season),
    equipo_local: f.teams.home.name,
    equipo_visitante: f.teams.away.name,
    equipo_local_logo: f.teams.home.logo,
    equipo_visitante_logo: f.teams.away.logo,
    fecha: f.fixture.date,
    goles_local: f.goals.home,
    goles_visitante: f.goals.away,
    estado: mapEstado(f.fixture.status.short),
  };
}

export async function fetchApiFootballFixtures(): Promise<PartidoExterno[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("Falta la variable de entorno API_FOOTBALL_KEY");
  }

  const url = new URL("/fixtures", BASE_URL);
  url.searchParams.set("league", LEAGUE_ID);
  url.searchParams.set("season", SEASON);

  const res = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football respondió ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as ApiResponse<ApiFixture>;

  // API-Football devuelve 200 con errores en el body (ej. season no permitida).
  if (json.errors && typeof json.errors === "object") {
    const msgs = Object.values(json.errors as Record<string, string>);
    if (msgs.length > 0) {
      throw new Error(`API-Football: ${msgs.join(" ")}`);
    }
  }

  return json.response.map(mapFixture);
}
