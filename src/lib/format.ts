import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { EstadoPartido } from "@/types";

/** Formatea una fecha ISO a algo legible en español. Ej: "14 jun 2026, 15:00". */
export function formatFecha(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es });
}

/**
 * Formato corto estilo colombiano para las cards de partido.
 * Ej: "Jue 19 Jun · 3:00 PM".
 */
export function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  const fecha = format(d, "EEE d MMM", { locale: es });
  // Hora 12h con meridiano limpio "AM/PM" (date-fns en es da "p. m.").
  const hora = format(d, "h:mm", { locale: es });
  const meridiano = d.getHours() < 12 ? "AM" : "PM";
  const cap = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  return `${cap} · ${hora} ${meridiano}`;
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
