import type { EstadoPartido, GoleadorFlash, MarcadorLV } from "@/types";

import { fetchConReintentos } from "./fetch-con-reintentos";

/**
 * Proveedor COMPLEMENTARIO: FlashScore vía RapidAPI (flashscore4).
 *
 * NO es la fuente de verdad para liquidar (eso lo decide FUTBOL_PROVIDER).
 * Aporta tres cosas que los proveedores oficiales no dan bien:
 *   1. EN VIVO con minuto real (`live_minute`) y eventos (goles/tarjetas).
 *   2. Marcador REGLAMENTARIO exacto (90' + reposición), reconstruido desde el
 *      feed de goles — clave en eliminatorias, donde el "fullTime" de los
 *      proveedores oficiales ya incluye el alargue.
 *   3. Bracket / llave de eliminación (endpoint Draw).
 *
 * Cuota: el plan de RapidAPI tiene límite duro (p.ej. Pro = 1.000/día). Por eso
 * estas funciones deben llamarse SOLO cuando hay partido en ventana activa
 * (ver `hayPartidoActivo` en app/api/sync/route.ts). Un mismo endpoint de lista
 * ("en vivo") trae TODOS los partidos, así N partidos simultáneos = 1 request.
 *
 * Config por env (ver .env.example). Si falta la key, la integración se
 * considera desactivada y las funciones lanzan `FlashscoreDeshabilitado`.
 */

const BASE_PATH = "/api/flashscore/v2";

interface FlashscoreConfig {
  host: string;
  key: string;
  sportId: string;
  templateId: string;
  tournamentId: string;
  stageId: string;
  seasonId: string;
  /** URL del torneo (para filtrar la lista global de "en vivo"). */
  tournamentUrl: string;
}

/** Error de configuración: la integración de flashscore no está activa. */
export class FlashscoreDeshabilitado extends Error {
  constructor() {
    super("FlashScore deshabilitado: falta FLASHSCORE_RAPIDAPI_KEY");
    this.name = "FlashscoreDeshabilitado";
  }
}

/** `true` si hay key configurada (permite decidir sin lanzar). */
export function flashscoreActivo(): boolean {
  return Boolean(process.env.FLASHSCORE_RAPIDAPI_KEY);
}

function getConfig(): FlashscoreConfig {
  const key = process.env.FLASHSCORE_RAPIDAPI_KEY;
  if (!key) throw new FlashscoreDeshabilitado();

  return {
    key,
    host: process.env.FLASHSCORE_RAPIDAPI_HOST ?? "flashscore4.p.rapidapi.com",
    sportId: process.env.FLASHSCORE_SPORT_ID ?? "1",
    templateId: process.env.FLASHSCORE_TOURNAMENT_TEMPLATE_ID ?? "",
    tournamentId: process.env.FLASHSCORE_TOURNAMENT_ID ?? "",
    stageId: process.env.FLASHSCORE_TOURNAMENT_STAGE_ID ?? "",
    seasonId: process.env.FLASHSCORE_SEASON_ID ?? "",
    tournamentUrl:
      process.env.FLASHSCORE_TOURNAMENT_URL ??
      "/football/world/world-championship/",
  };
}

/** GET tipado a la API de flashscore, con reintentos y timeout. */
async function flashGet<T>(
  cfg: FlashscoreConfig,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`https://${cfg.host}${BASE_PATH}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetchConReintentos(url, {
    headers: {
      "x-rapidapi-host": cfg.host,
      "x-rapidapi-key": cfg.key,
    },
    cache: "no-store",
  });

  const json = (await res.json()) as T & { message?: string; error?: boolean };
  if (!res.ok || json?.error) {
    throw new Error(
      `FlashScore ${res.status}: ${json?.message ?? res.statusText}`,
    );
  }
  return json as T;
}

// --- Formas crudas de la API (solo los campos que usamos) -------------------

interface FsMatchStatus {
  stage: string | null;
  is_cancelled: boolean;
  is_postponed: boolean;
  is_in_progress: boolean;
  is_finished: boolean;
  is_finished_after_extra_time: boolean;
  is_finished_after_penalties: boolean;
  live_minute: number | null;
}

interface FsTeam {
  team_id: string;
  name: string | null;
  small_image_path: string | null;
  red_cards: number;
}

interface FsMatch {
  match_id: string;
  timestamp: number;
  match_status?: FsMatchStatus;
  home_team: FsTeam;
  away_team: FsTeam;
  scores?: { home: number | null; away: number | null };
}

interface FsTournamentGroup {
  tournament_id: string;
  tournament_url: string;
  name: string;
  matches: FsMatch[];
}

interface FsSummaryPlayer {
  name: string;
  type: string; // "Goal" | "Own Goal" | "Penalty" | "Yellow Card" | ...
}

interface FsSummaryEvent {
  minutes: string | null; // "28", "45+2", "105", ...
  team: "home" | "away";
  players: FsSummaryPlayer[];
}

interface FsDrawMatch {
  match_id: string;
  timestamp: number;
  home_team: { name: string | null; short_name: string | null };
  away_team: { name: string | null; short_name: string | null };
  scores?: { home: number | null; away: number | null };
  winner: "home" | "away" | null;
}

interface FsDrawRound {
  round_id: number;
  round_name: string;
  matches: FsDrawMatch[];
}

// --- Tipos de salida (nuestros) --------------------------------------------

/** Partido en vivo del Mundial, con minuto real y estado derivado. */
export interface PartidoVivoFlash {
  match_id: string;
  fecha: string; // ISO
  equipo_local: string;
  equipo_visitante: string;
  goles_local: number | null;
  goles_visitante: number | null;
  /** Minuto de juego real reportado por flashscore (null en descanso). */
  minuto: number | null;
  estado: EstadoPartido;
  en_pausa: boolean;
  rojas_local: number;
  rojas_visitante: number;
}

/** Desglose completo de un partido para la UI y el auto-fill. */
export interface DetallePartidoFlash {
  reglamentario: MarcadorLV;
  /** Marcador SOLO del alargue; null si no hubo goles en alargue. */
  alargue: MarcadorLV | null;
  /** Marcador de la tanda de penales; null si no hubo tanda. */
  penales: MarcadorLV | null;
  /** Goleadores en juego (reglamentario + alargue), en orden cronológico. */
  goleadores: GoleadorFlash[];
}

// --- Mapeos -----------------------------------------------------------------

/** Normaliza nombres para cruzar equipos entre proveedores (sin tildes/casing). */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function mapEstado(st: FsMatchStatus): EstadoPartido {
  if (st.is_cancelled) return "cancelado";
  if (st.is_finished) return "finalizado";
  if (st.is_in_progress) return "en_juego";
  return "programado";
}

function mapVivo(m: FsMatch): PartidoVivoFlash | null {
  const st = m.match_status;
  if (!st) return null;
  return {
    match_id: m.match_id,
    fecha: new Date(m.timestamp * 1000).toISOString(),
    equipo_local: m.home_team.name ?? "Por definir",
    equipo_visitante: m.away_team.name ?? "Por definir",
    goles_local: m.scores?.home ?? null,
    goles_visitante: m.scores?.away ?? null,
    minuto: st.live_minute,
    estado: mapEstado(st),
    // Flashscore expone el descanso vía `stage` ("Half Time").
    en_pausa: st.stage === "Half Time" || st.stage === "Break Time",
    rojas_local: m.home_team.red_cards ?? 0,
    rojas_visitante: m.away_team.red_cards ?? 0,
  };
}

// --- Endpoints públicos -----------------------------------------------------

/**
 * Partidos EN VIVO del Mundial (1 request trae todos los vivos de todos los
 * torneos; filtramos por la URL del torneo configurado).
 */
export async function fetchMundialEnVivo(): Promise<PartidoVivoFlash[]> {
  const cfg = getConfig();
  const grupos = await flashGet<FsTournamentGroup[]>(cfg, "/matches/live", {
    sport_id: cfg.sportId,
  });

  return grupos
    .filter((g) => g.tournament_url === cfg.tournamentUrl)
    .flatMap((g) => g.matches)
    .map(mapVivo)
    .filter((p): p is PartidoVivoFlash => p !== null);
}

/**
 * Desglose completo de un partido, calculado desde el feed de goles del
 * `summary`: marcador reglamentario (90'), alargue y tanda de penales, más la
 * lista de goleadores en juego.
 *
 * Estructura real del feed (validada con partidos por penales):
 *   - Eventos en orden cronológico: 1' … 90+X' (reglamentario), luego 9X'-120+X'
 *     (alargue), y al final la TANDA con `minutes` REINICIADO a "1","2","3"…
 *     (número de penal) y tipo "Penalty" / "Penalty missed".
 *   - `team` es el equipo que SE ANOTA el gol (para "Own goal" ya viene el que
 *     se beneficia, no el autor).
 *
 * Por eso la tanda se detecta por el "salto" de minuto hacia abajo, no por el
 * valor: si sumáramos por minuto ≤90 contaríamos los penales de la tanda.
 */
export async function fetchDetallePartido(
  matchId: string,
): Promise<DetallePartidoFlash> {
  const cfg = getConfig();
  const eventos = await flashGet<FsSummaryEvent[]>(
    cfg,
    "/matches/match/summary",
    { match_id: matchId },
  );
  return calcularDetalle(eventos);
}

/** Solo el marcador reglamentario (lo que usa el auto-fill para liquidar). */
export async function fetchMarcadorReglamentario(
  matchId: string,
): Promise<MarcadorLV> {
  return (await fetchDetallePartido(matchId)).reglamentario;
}

/** Núcleo puro (testeable): separa juego de tanda y arma el desglose. */
export function calcularDetalle(
  eventos: FsSummaryEvent[],
): DetallePartidoFlash {
  const inicioTanda = indiceInicioTanda(eventos);
  const enJuego = eventos.slice(0, inicioTanda);
  const tanda = eventos.slice(inicioTanda);

  const reg = { local: 0, visitante: 0 };
  const ext = { local: 0, visitante: 0 };
  const goleadores: GoleadorFlash[] = [];

  for (const e of enJuego) {
    const gol = golDeEvento(e);
    if (!gol) continue;

    const min = minutoBase(e.minutes);
    const acumulador = min !== null && min > 90 ? ext : reg; // >90 = alargue
    if (e.team === "home") acumulador.local += 1;
    else acumulador.visitante += 1;

    goleadores.push({
      minuto: e.minutes ?? "",
      team: e.team,
      jugador: gol.nombre,
      en_contra: gol.enContra,
      penal: gol.penal,
    });
  }

  // Tanda: cada evento con un penal (convertido o fallado) es un lanzamiento.
  let penLocal = 0;
  let penVisitante = 0;
  let huboTanda = false;
  for (const e of tanda) {
    const esLanzamiento = e.players?.some(
      (p) => p.type === "Penalty" || p.type === "Penalty missed",
    );
    if (!esLanzamiento) continue;
    huboTanda = true;
    if (e.players?.some((p) => p.type === "Penalty")) {
      if (e.team === "home") penLocal += 1;
      else penVisitante += 1;
    }
  }

  return {
    reglamentario: reg,
    alargue: ext.local || ext.visitante ? ext : null,
    penales: huboTanda ? { local: penLocal, visitante: penVisitante } : null,
    goleadores,
  };
}

/**
 * Índice donde empieza la tanda de penales, detectado por el reinicio del
 * minuto (p.ej. 89' → 1'). Devuelve `eventos.length` si no hubo tanda.
 */
function indiceInicioTanda(eventos: FsSummaryEvent[]): number {
  let maxMin = -1;
  for (let i = 0; i < eventos.length; i++) {
    const min = minutoBase(eventos[i].minutes);
    if (min === null) continue;

    const esPenal = eventos[i].players?.some((p) =>
      p.type.startsWith("Penalty"),
    );
    // Ya vamos avanzados en el partido y el minuto "cae" a valores bajos con un
    // penal → arrancó la tanda.
    if (maxMin >= 45 && min <= 20 && esPenal) return i;
    if (min > maxMin) maxMin = min;
  }
  return eventos.length;
}

/** Autor y naturaleza del gol de un evento en juego; null si no es gol. */
function golDeEvento(
  e: FsSummaryEvent,
): { nombre: string; enContra: boolean; penal: boolean } | null {
  const p = e.players?.find(
    (x) => x.type === "Goal" || x.type === "Own goal" || x.type === "Penalty",
  );
  if (!p) return null;
  return {
    nombre: p.name,
    enContra: p.type === "Own goal",
    penal: p.type === "Penalty",
  };
}

/** Minuto base a partir de "28" / "45+2" / "90+4"; null si no es parseable. */
function minutoBase(minutes: string | null): number | null {
  if (!minutes) return null;
  const n = Number.parseInt(minutes.split("+")[0], 10);
  return Number.isNaN(n) ? null : n;
}

/** Bracket / llave de eliminación del Mundial (endpoint Draw). */
export async function fetchMundialBracket(): Promise<FsDrawRound[]> {
  const cfg = getConfig();
  return flashGet<FsDrawRound[]>(cfg, "/tournaments/draw", {
    tournament_template_id: cfg.templateId,
    tournament_id: cfg.tournamentId,
    tournament_stage_id: cfg.stageId,
    season_id: cfg.seasonId,
  });
}

/**
 * Resultados (finalizados) del torneo. 1 request = todos los partidos jugados.
 * Útil para resolver el `match_id` de flashscore de cada partido nuestro
 * (cruce por nombres normalizados + fecha) antes de pedir su `summary`.
 */
export async function fetchMundialResultados(): Promise<FsMatch[]> {
  const cfg = getConfig();
  return flashGet<FsMatch[]>(cfg, "/tournaments/results", {
    tournament_template_id: cfg.templateId,
    tournament_id: cfg.tournamentId,
    tournament_stage_id: cfg.stageId,
    season_id: cfg.seasonId,
  });
}
