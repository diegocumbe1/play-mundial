import { z } from "zod";

/**
 * Restricciones de horario de un equipo (las pone el organizador): qué días
 * puede jugar, desde y hasta qué hora puede empezar un partido y fechas
 * puntuales en que no puede. El programador automático las respeta y los
 * partidos ya programados que las incumplen se pueden reprogramar.
 *
 * Todo en hora de Colombia (UTC-5, sin horario de verano).
 */

const hora = z.string().regex(/^\d{2}:\d{2}$/);

export const restriccionesSchema = z.object({
  /** Días de la semana en que SÍ puede jugar (0 = domingo … 6 = sábado). Vacío = todos. */
  dias: z.array(z.number().int().min(0).max(6)).default([]),
  /** Hora mínima de inicio del partido, "HH:MM". `null` = sin mínimo. */
  desde: hora.nullable().default(null),
  /** Hora máxima de inicio del partido, "HH:MM". `null` = sin máximo. */
  hasta: hora.nullable().default(null),
  /** Fechas "YYYY-MM-DD" en que no puede jugar (viajes, compromisos…). */
  fechas_no: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).default([]),
  /** Nota libre para el organizador. */
  nota: z.string().trim().max(200).default(""),
});

export type RestriccionesEquipo = z.infer<typeof restriccionesSchema>;

export const SIN_RESTRICCIONES: RestriccionesEquipo = {
  dias: [],
  desde: null,
  hasta: null,
  fechas_no: [],
  nota: "",
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Lee lo guardado (o `null`) sin fallar: lo inválido se ignora. */
export function leerRestricciones(raw: unknown): RestriccionesEquipo {
  const r = restriccionesSchema.safeParse(raw ?? {});
  return r.success ? r.data : SIN_RESTRICCIONES;
}

export function tieneRestricciones(r: RestriccionesEquipo | null | undefined): boolean {
  if (!r) return false;
  return (r.dias.length > 0 && r.dias.length < 7) || !!r.desde || !!r.hasta || r.fechas_no.length > 0;
}

/** "13:30" → minutos desde la medianoche. */
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** "8:00 p. m." para mostrar. */
export function horaLegible(hhmm: string): string {
  const m = minutos(hhmm);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${h < 12 ? "a. m." : "p. m."}`;
}

/** Fecha y hora de Colombia de un instante. */
function enColombia(iso: string | Date): { fecha: string; dia: number; minuto: number } {
  const t = (typeof iso === "string" ? new Date(iso) : iso).getTime() - 5 * 3600_000;
  const d = new Date(t);
  return {
    fecha: d.toISOString().slice(0, 10),
    dia: d.getUTCDay(),
    minuto: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/**
 * Por qué el equipo NO puede jugar un partido que empieza en `inicio`, o
 * `null` si puede. Ej.: "no juega los miércoles", "solo desde las 8:00 p. m.".
 */
export function motivoRestriccion(r: RestriccionesEquipo | null | undefined, inicio: string | Date): string | null {
  if (!r) return null;
  const c = enColombia(inicio);
  if (r.fechas_no.includes(c.fecha)) return `no puede el ${c.fecha.split("-").reverse().join("/")}`;
  if (r.dias.length > 0 && r.dias.length < 7 && !r.dias.includes(c.dia)) return `no juega los ${DIAS[c.dia]}`;
  if (r.desde && c.minuto < minutos(r.desde)) return `solo puede desde las ${horaLegible(r.desde)}`;
  if (r.hasta && c.minuto > minutos(r.hasta)) return `solo puede empezar hasta las ${horaLegible(r.hasta)}`;
  return null;
}

/** ¿Algún día de juego le sirve al equipo? Sirve para avisar restricciones imposibles. */
export function resumenRestricciones(r: RestriccionesEquipo | null | undefined): string {
  if (!tieneRestricciones(r)) return "Sin restricciones";
  const partes: string[] = [];
  if (r!.dias.length > 0 && r!.dias.length < 7) {
    partes.push(`Solo ${[...r!.dias].sort().map((d) => DIAS_CORTOS[d]).join(", ")}`);
  }
  if (r!.desde && r!.hasta) partes.push(`de ${horaLegible(r!.desde)} a ${horaLegible(r!.hasta)}`);
  else if (r!.desde) partes.push(`desde ${horaLegible(r!.desde)}`);
  else if (r!.hasta) partes.push(`hasta ${horaLegible(r!.hasta)}`);
  if (r!.fechas_no.length > 0) partes.push(`${r!.fechas_no.length} fecha(s) bloqueada(s)`);
  return partes.join(" · ");
}

/**
 * Motivo por el que un partido no sirve en `inicio` para alguno de sus dos
 * equipos ("Los Cumbe no juega los miércoles"), o `null` si a ambos les sirve.
 */
export function choquePartido(
  inicio: string | Date,
  equipos: { nombre: string; restricciones: RestriccionesEquipo | null | undefined }[],
): string | null {
  for (const e of equipos) {
    const m = motivoRestriccion(e.restricciones, inicio);
    if (m) return `${e.nombre} ${m}`;
  }
  return null;
}
