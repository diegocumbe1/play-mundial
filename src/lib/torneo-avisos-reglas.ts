/** Reglas puras de los avisos de torneo: cuándo y con qué texto (sin I/O). */

export type TipoAviso =
  | "recordatorio"
  | "en_vivo"
  | "por_aprobar"
  | "finalizado"
  | "siguiente"
  | "set_1"
  | "set_2"
  | "set_3"
  | "set_4"
  | "set_5";

/** Aviso del set `n` (1…5), uno por set para no repetirlo. */
export const tipoSet = (n: number): TipoAviso => `set_${Math.min(Math.max(n, 1), 5)}` as TipoAviso;

/** ¿El dispositivo está en pausa ahora? */
export const estaPausado = (pausadoHasta: string | null | undefined, ahora: Date): boolean =>
  !!pausadoHasta && new Date(pausadoHasta).getTime() > ahora.getTime();

/** ¿Sigue a alguno de estos equipos? Lista vacía = los sigue a todos. */
export function sigueEquipos(
  seguidos: readonly string[] | null | undefined,
  equipos: readonly (string | null)[],
): boolean {
  if (!seguidos || seguidos.length === 0) return true;
  return equipos.some((id) => !!id && seguidos.includes(id));
}

/** Sets ganados por A y por B a partir de los sets cerrados. */
export function setsGanados(sets: readonly [number, number][]): [number, number] {
  let a = 0;
  let b = 0;
  for (const [x, y] of sets) {
    if (x > y) a++;
    else if (y > x) b++;
  }
  return [a, b];
}

/** Opciones de "avisar X minutos antes". 0 = sin recordatorio. */
export const MINUTOS_RECORDATORIO = [0, 5, 10, 15, 30, 60] as const;
/** Hasta cuánto antes hay que mirar los partidos: el mayor de los recordatorios. */
export const VENTANA_RECORDATORIO_MIN = Math.max(...MINUTOS_RECORDATORIO);

/** ¿Ya toca recordar? Desde X minutos antes hasta que empiece; después ya no sirve. */
export function tocaRecordatorio(programadoAt: string, minutosAntes: number, ahora: Date): boolean {
  if (minutosAntes <= 0) return false;
  const faltanMs = new Date(programadoAt).getTime() - ahora.getTime();
  return faltanMs > 0 && faltanMs <= minutosAntes * 60_000;
}

export const setsEnTexto = (sets: [number, number][]): string =>
  sets.map(([a, b]) => `${a}-${b}`).join(", ");

/** "Cancha estándar" si el organizador la nombró; si no, "Cancha 2". */
export function nombreCancha(cancha: number, nombres: readonly string[] = []): string {
  return nombres[cancha - 1]?.trim() || `Cancha ${cancha}`;
}

/** Hora y cancha de un partido, en hora de Colombia. */
export function cuandoYDonde(
  programadoAt: string | null,
  cancha: number | null,
  nombresCanchas: readonly string[] = [],
): string {
  const hora = programadoAt
    ? new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(programadoAt))
    : null;
  return [hora, cancha ? nombreCancha(cancha, nombresCanchas) : null].filter(Boolean).join(" · ");
}

/** Minutos que faltan, redondeados: el aviso dice la verdad aunque salga un minuto después. */
export const minutosParaEmpezar = (programadoAt: string, ahora: Date): number =>
  Math.max(1, Math.round((new Date(programadoAt).getTime() - ahora.getTime()) / 60_000));

/** Enlace que abre el partido en el panel del organizador. */
export const enlacePartido = (torneoId: string, encuentroId: string): string =>
  `/admin/torneos/${torneoId}?partido=${encuentroId}`;
