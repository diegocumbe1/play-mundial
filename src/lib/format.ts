import type { EstadoPartido } from "@/types";

/**
 * Zona horaria fija para toda la app. Sin esto, las fechas se formatean en la
 * zona del runtime: en Vercel (UTC) un partido de las 12:00 PM Colombia salía
 * como "5:00 PM". Forzamos Colombia para que siempre coincida con la realidad.
 */
const TZ = "America/Bogota";

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Formatea una fecha ISO a algo legible en español. Ej: "14 jun 2026, 15:00". */
export function formatFecha(iso: string): string {
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${g("day")} ${cap(g("month").replace(".", ""))} ${g("year")}, ${g("hour")}:${g("minute")}`;
}

/**
 * Formato corto estilo colombiano para las cards de partido.
 * Ej: "Mié 17 Jun · 12:00 PM". Siempre en hora de Colombia.
 */
export function formatFechaCorta(iso: string): string {
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const weekday = cap(g("weekday").replace(".", ""));
  const month = cap(g("month").replace(".", ""));
  // dayPeriod en es-CO viene como "a. m." / "p. m."; lo normalizamos.
  const meridiano = g("dayPeriod").toLowerCase().includes("p") ? "PM" : "AM";
  return `${weekday} ${g("day")} ${month} · ${g("hour")}:${g("minute")} ${meridiano}`;
}

/** Formatea un número como pesos colombianos sin decimales. Ej: "$1.200.000". */
export function formatCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
}

/** Etiqueta legible para el estado de un partido. */
export function estadoLabel(estado: EstadoPartido): string {
  const labels: Record<EstadoPartido, string> = {
    programado: "Programado",
    en_juego: "En juego",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  };
  return labels[estado];
}

/** Variante de `Badge` (shadcn) según el estado. */
export function estadoVariant(
  estado: EstadoPartido,
): "default" | "secondary" | "destructive" | "outline" {
  switch (estado) {
    case "en_juego":
      return "default";
    case "finalizado":
      return "secondary";
    case "cancelado":
      return "destructive";
    default:
      return "outline";
  }
}
