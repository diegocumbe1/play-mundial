import type { EstadoPartido, Partido } from "@/types";

/**
 * Estado "en vivo" derivado de la hora, no del proveedor.
 *
 * El plan gratuito de football-data es inestable con el `status`: a veces deja
 * un partido en juego como `SCHEDULED`/`TIMED` (lo guardamos como 'programado')
 * aunque ya tenga marcador. Si pintáramos el badge con ese estado, parpadearía
 * entre "En vivo" y "Próximo" en cada sync. Por eso derivamos "en vivo" de la
 * hora de inicio, que es estable.
 *
 * NO derivamos el minuto de juego: sin el `elapsed` real del proveedor, un
 * reloj calculado se desfasa (descanso, añadido) y mostraría algo distinto a la
 * FIFA. En su lugar mostramos "Actualizado hace X" (ver components/actualizado).
 */

/** Duración máxima de un partido: 90' + descanso + añadidos + margen extra. */
export const DURACION_MAX_MIN = 150;

/**
 * Estado efectivo del partido, robusto ante el desfase del proveedor.
 * Respeta `finalizado`/`cancelado` (son estables); el resto se decide por hora.
 */
export function estadoEfectivo(
  partido: Pick<Partido, "estado" | "fecha">,
  ahora: number = Date.now(),
): EstadoPartido {
  if (partido.estado === "finalizado" || partido.estado === "cancelado") {
    return partido.estado;
  }
  const inicio = new Date(partido.fecha).getTime();
  const fin = inicio + DURACION_MAX_MIN * 60_000;
  if (ahora >= inicio && ahora <= fin) return "en_juego";
  return "programado";
}
