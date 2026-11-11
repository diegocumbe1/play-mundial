import "server-only";

import { OPCIONES_MARCADOR_POR_DEFECTO, type OpcionesMarcador } from "@/lib/marcador-voz";
import type { ReglasTorneo } from "@/lib/torneo-reglas";

/**
 * Cliente del marcador en vivo (dc-sport-score, proyecto aparte).
 *
 * El juez marca los puntos desde su celular en dc-sport-score; aquí solo se
 * crea la sala del partido y se LEE su estado. El resultado oficial lo
 * confirma el organizador en la plataforma: dc-sport-score nunca escribe aquí.
 *
 * - `DC_SPORT_SCORE_URL`: dónde lo alcanza el servidor (ej. http://localhost:3001).
 * - `DC_SPORT_SCORE_PUBLIC_URL`: la URL que abren el juez y la TV (ngrok o
 *   dominio). Si falta, se usa la anterior.
 * Sin `DC_SPORT_SCORE_URL` la integración queda apagada y todo se carga a mano.
 */

const URL_INTERNA = process.env.DC_SPORT_SCORE_URL?.replace(/\/$/, "") || null;
const URL_PUBLICA = process.env.DC_SPORT_SCORE_PUBLIC_URL?.replace(/\/$/, "") || URL_INTERNA;
const ADMIN_PIN = process.env.DC_SPORT_SCORE_ADMIN_PIN || null;

export const marcadorDisponible = (): boolean => !!URL_INTERNA;

// Valores que acepta dc-sport-score (public/config/options.json de ese proyecto).
const PUNTOS_VALIDOS = [10, 15, 20, 21, 25];
const ALARGUES_VALIDOS = [0, 2, 4, 6];
const ALARGUE_SIN_TOPE = 99;

/** Reglas del torneo → configuración del marcador. `null` si no se puede representar. */
export function configMarcador(juego: ReglasTorneo["juego"]): {
  pointsPerSet: number;
  totalSets: number;
  decidingSetPoints: number;
  overtime: number;
} | null {
  if (!PUNTOS_VALIDOS.includes(juego.puntos_set)) return null;
  const decisivo = juego.sets > 1 ? juego.puntos_decisivo : juego.puntos_set;
  if (!PUNTOS_VALIDOS.includes(decisivo)) return null;
  let overtime = ALARGUE_SIN_TOPE;
  if (!juego.diferencia_dos) overtime = 0;
  else if (juego.tope_puntos) {
    overtime = juego.tope_puntos - juego.puntos_set;
    if (!ALARGUES_VALIDOS.includes(overtime)) return null;
  }
  return {
    pointsPerSet: juego.puntos_set,
    totalSets: juego.sets,
    decidingSetPoints: decisivo,
    overtime,
  };
}

/** Código de sala válido para dc-sport-score (3 a 24: letras, números, - y _). */
export function salaDePartido(encuentroId: string): string {
  return `t-${encuentroId.replace(/-/g, "").slice(0, 12)}`;
}

export function enlacesMarcador(sala: string) {
  return {
    /** Celular del juez: un toque suma al instante y corrige con «Deshacer». */
    juez: `${URL_PUBLICA}/control?sala=${sala}&modo=juez`,
    /** Control de los dos equipos: un toque suma, dos toques restan. */
    control: `${URL_PUBLICA}/control?sala=${sala}`,
    /** Solo celular (control + marcador + voz) cuando no hay TV. */
    soloCelular: `${URL_PUBLICA}/control?sala=${sala}&modo=uno`,
    /**
     * Pantalla del organizador (TV, PC o celular conectado a la pantalla): muestra
     * el marcador y desde ahí se configura el sonido (voz y música).
     */
    pantalla: `${URL_PUBLICA}/marcador?sala=${sala}`,
  };
}

/**
 * Crea (o reconfigura, si aún no empezó) la sala del partido. `opciones`: colores
 * de los equipos y la voz (quién habla y si anuncia el nombre o el color).
 */
export async function crearSalaMarcador(
  sala: string,
  nombreA: string,
  nombreB: string,
  juego: ReglasTorneo["juego"],
  opciones: OpcionesMarcador = OPCIONES_MARCADOR_POR_DEFECTO,
): Promise<string | null> {
  if (!URL_INTERNA) return "El marcador en vivo no está configurado.";
  const config = configMarcador(juego);
  if (!config) {
    return "Las reglas de este torneo (puntos o alargue) no las admite el marcador en vivo: carga el resultado a mano.";
  }
  try {
    const res = await fetch(`${URL_INTERNA}/api/rooms/${sala}/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teams: [
          { name: nombreA.slice(0, 40), color: opciones.colores[0] },
          { name: nombreB.slice(0, 40), color: opciones.colores[1] },
        ],
        ...config,
        voice: {
          enabled: true,
          speaker: opciones.voz,
          announce: opciones.anuncio === "color" ? "color" : "name",
        },
        // Música del torneo en la pantalla del marcador (enlace de YouTube; vacío = sin música).
        music: { youtube: juego.musica_youtube ?? "" },
        torneo: true, // Sin música y el juez no puede borrar el partido desde el control.
      }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; needPin?: boolean };
    // Sala con juego en curso: ya existe y está bien, no se reconfigura.
    if (body.needPin) return null;
    return res.ok && body.ok ? null : (body.error ?? "El marcador no respondió bien.");
  } catch {
    return "No se pudo conectar con el marcador en vivo.";
  }
}

/**
 * Audio MP3 (base64) de una frase de prueba con la voz elegida, para escuchar
 * cómo sonará el marcador antes de abrirlo. Requiere el PIN de administración.
 */
export async function probarVozMarcador(voz: string, texto: string): Promise<{ audio: string } | { error: string }> {
  if (!URL_INTERNA) return { error: "El marcador en vivo no está configurado." };
  if (!ADMIN_PIN) return { error: "Falta DC_SPORT_SCORE_ADMIN_PIN para probar la voz." };
  try {
    const res = await fetch(`${URL_INTERNA}/api/voz/prueba`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-pin": ADMIN_PIN },
      body: JSON.stringify({ speaker: voz, text: texto }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!res.ok) return { error: "El marcador no pudo generar la voz de prueba." };
    return { audio: Buffer.from(await res.arrayBuffer()).toString("base64") };
  } catch {
    return { error: "No se pudo conectar con el marcador en vivo." };
  }
}

/**
 * Borra la sala temporal cuando el partido ya tiene resultado oficial: el
 * histórico vive en `encuentros`. Si falla, la sala expira sola en el marcador.
 * Sin PIN no se intenta, para no sumar intentos fallidos en el marcador.
 */
export async function borrarSalaMarcador(sala: string): Promise<void> {
  if (!URL_INTERNA || !ADMIN_PIN) return;
  try {
    await fetch(`${URL_INTERNA}/api/rooms/${sala}`, {
      method: "DELETE",
      headers: { "x-admin-pin": ADMIN_PIN },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
  } catch {
    // El resultado ya quedó guardado: no se molesta al organizador por esto.
  }
}

/** Estado de dc-sport-score, solo lo que se usa. */
interface EstadoSala {
  court: number[];
  points: number[];
  /** `matchOver`: alguien ganó los sets necesarios. `finished`: el juez lo cerró a mano. */
  phase: "playing" | "setOver" | "matchOver" | "finished";
  setResults: { teams: number[]; points: number[] }[];
  /** Set a medias cuando el juez finalizó el partido: no cuenta en el resultado. */
  openSet?: { teams: number[]; points: number[] } | null;
}

export interface MarcadorLeido {
  /** Sets con el puntaje de A y B (incluye el set en curso si ya tiene puntos). */
  sets: [number, number][];
  /** El juez ya no va a marcar más: falta que el organizador acepte o corrija. */
  terminado: boolean;
  /** Set que quedó a medias al finalizar; no está en `sets`. */
  setSinTerminar: [number, number] | null;
}

/**
 * Traduce el estado de la sala a sets [A, B]. dc-sport-score cambia de lado a
 * los equipos en cada set, así que se ubica a cada uno por su índice de
 * equipo (0 = A, 1 = B) y no por el lado de la cancha.
 */
export function estadoASets(e: EstadoSala): MarcadorLeido {
  const deEquipo = (teams: number[], points: number[], equipo: number) =>
    points[teams.indexOf(equipo)] ?? 0;
  const sets = e.setResults.map(
    (r) => [deEquipo(r.teams, r.points, 0), deEquipo(r.teams, r.points, 1)] as [number, number],
  );
  const [a, b] = [deEquipo(e.court, e.points, 0), deEquipo(e.court, e.points, 1)];
  if (e.phase === "playing" && (a > 0 || b > 0)) sets.push([a, b]);
  const abierto = e.phase === "finished" ? e.openSet : null;
  return {
    sets,
    terminado: e.phase === "matchOver" || e.phase === "finished",
    setSinTerminar: abierto
      ? [deEquipo(abierto.teams, abierto.points, 0), deEquipo(abierto.teams, abierto.points, 1)]
      : null,
  };
}

/** Lee el marcador de una sala. `null` si no responde (no rompe la página). */
export async function leerMarcador(sala: string, timeoutMs = 2500): Promise<MarcadorLeido | null> {
  if (!URL_INTERNA) return null;
  try {
    const res = await fetch(`${URL_INTERNA}/api/rooms/${sala}`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return estadoASets((await res.json()) as EstadoSala);
  } catch {
    return null;
  }
}
