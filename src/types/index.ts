/**
 * Tipos del dominio de la Polla Futbolera.
 *
 * Reflejan el esquema definido en `supabase/migrations`. Cuando conectemos el
 * CLI de Supabase podremos autogenerar tipos con:
 *   supabase gen types typescript --linked > src/types/database.ts
 * y derivar estos de ahí. Por ahora se mantienen a mano.
 */

/** Estado del ciclo de vida de un partido. */
export type EstadoPartido =
  | "programado"
  | "en_juego"
  | "finalizado"
  | "cancelado";

/** Origen del registro de un partido. */
export type FuentePartido = "manual" | "api";

/** Un partido sobre el que se hacen pronósticos. */
export interface Partido {
  id: string;
  /** Id en el proveedor externo (API). `null` si se creó manualmente. */
  external_id: string | null;
  fuente: FuentePartido;
  liga: string | null;
  temporada: string | null;
  equipo_local: string;
  equipo_visitante: string;
  equipo_local_logo: string | null;
  equipo_visitante_logo: string | null;
  /** Fecha/hora del partido en formato ISO 8601. */
  fecha: string;
  /** Goles reales, disponibles solo cuando el partido finaliza. */
  goles_local: number | null;
  goles_visitante: number | null;
  estado: EstadoPartido;
  /** Si el partido en juego está pausado (medio tiempo / descanso). */
  en_pausa: boolean;
  /** Si el premio del partido ya se le pagó al/los ganador(es). */
  premio_pagado: boolean;
  created_at: string;
  updated_at: string;
}

/** Datos para crear un partido manualmente. */
export type NuevoPartido = Pick<
  Partido,
  "equipo_local" | "equipo_visitante" | "fecha" | "liga"
>;

/**
 * Forma de un partido proveniente de la API externa, lista para hacer upsert.
 * Se identifica por `external_id`.
 */
export type PartidoExterno = Pick<
  Partido,
  | "external_id"
  | "liga"
  | "temporada"
  | "equipo_local"
  | "equipo_visitante"
  | "equipo_local_logo"
  | "equipo_visitante_logo"
  | "fecha"
  | "goles_local"
  | "goles_visitante"
  | "estado"
  | "en_pausa"
>;

/**
 * Una apuesta a un partido concreto. El modelo es "polla por partido": cada
 * apuesta es independiente y tiene su costo. No se acumula entre partidos.
 */
export interface Apuesta {
  id: string;
  partido_id: string;
  nombre: string;
  telefono: string | null;
  goles_local: number;
  goles_visitante: number;
  /** Estado de pago de esta apuesta. */
  pagado: boolean;
  created_at: string;
  updated_at: string;
}

/** Una apuesta tal como la arma el formulario (sin ids ni datos de persona). */
export interface ApuestaInput {
  partido_id: string;
  goles_local: number;
  goles_visitante: number;
}

/** Resultado económico calculado de un partido (pozo, ganadores, reparto). */
export interface ResultadoPartido {
  partido: Partido;
  /** Total de apuestas pagadas del partido. */
  apuestasPagadas: number;
  /** Pozo en COP = apuestasPagadas * costo. */
  pozo: number;
  /** Parte del pozo para la casa por porcentaje (ej. 20%). */
  casaBase: number;
  /** Bolsa de premio (pozo - casaBase, ej. 80%). */
  premioPool: number;
  /** Apuestas que acertaron el marcador exacto (solo si finalizó). */
  ganadores: Apuesta[];
  /** Premio para cada ganador (bolsa repartida en partes iguales). */
  premioPorGanador: number;
  /** Monto final que queda para la casa (base + residuo + pozo si nadie gana). */
  enCasa: number;
}

/** Resultado estándar devuelto por las Server Actions. */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
