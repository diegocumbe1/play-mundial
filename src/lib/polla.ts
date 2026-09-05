import type { Apuesta, Partido, ResultadoPartido } from "@/types";
import { getMarcadorReglamentario } from "@/lib/marcador-reglamentario";

/**
 * Configuración económica de la polla (costo por partido y reparto del pozo).
 *
 * Los datos de cobro (cuenta, llave, QR y WhatsApp) NO viven aquí: se leen de
 * `plataforma_pago_config` vía `getPlataformaPagoConfig()` y los edita el
 * superadmin. Nunca quemar una cuenta real en el código.
 */
export const POLLA = {
  nombre: "Polla Mundial 2026",
  /** Costo por cada partido apostado (COP). */
  costo: 5000,
  /** Porcentaje del pozo que se queda la casa (el resto va al premio). */
  porcentajeCasa: 0.2,
} as const;

/** Formatea un número como pesos colombianos. Ej: 5000 -> "$ 5.000". */
export function formatCOP(monto: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(monto);
}

/**
 * Calcula el resultado económico de un partido a partir de sus apuestas.
 *
 * Modelo: pozo = (apuestas pagadas) × costo. De cada pozo, la casa se queda
 * `porcentajeCasa` (ej. 20%) y el resto (ej. 80%) es la bolsa de premio. Si el
 * partido finalizó, ganan quienes acertaron el marcador exacto y se reparten la
 * bolsa en partes iguales. Si NO hay ganadores, todo el pozo queda en casa.
 * El residuo del redondeo también va a la casa.
 */
export function calcularResultadoPartido(
  partido: Partido,
  apuestas: Apuesta[],
): ResultadoPartido {
  const pagadas = apuestas.filter((a) => a.pagado);
  const pozo = pagadas.length * POLLA.costo;

  // Reparto base por porcentaje (proyección que aplica desde el primer peso).
  const casaBase = Math.round(pozo * POLLA.porcentajeCasa);
  const premioPool = pozo - casaBase;

  const marcadorReglamentario = getMarcadorReglamentario(partido);
  const finalizado =
    partido.estado === "finalizado" && marcadorReglamentario !== null;

  const ganadores = finalizado
    ? pagadas.filter(
        (a) =>
          a.goles_local === marcadorReglamentario.goles_local &&
          a.goles_visitante === marcadorReglamentario.goles_visitante,
      )
    : [];

  let premioPorGanador = 0;
  let enCasa = 0;

  if (finalizado) {
    if (ganadores.length > 0) {
      premioPorGanador = Math.floor(premioPool / ganadores.length);
      const repartido = premioPorGanador * ganadores.length;
      // La casa se lleva su base + el residuo del redondeo.
      enCasa = casaBase + (premioPool - repartido);
    } else {
      // Nadie acertó: todo el pozo queda en casa.
      enCasa = pozo;
    }
  }

  return {
    partido,
    apuestasPagadas: pagadas.length,
    pozo,
    casaBase,
    premioPool,
    ganadores,
    premioPorGanador,
    enCasa,
  };
}
