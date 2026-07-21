import type {
  Boleta,
  BoletaPublica,
  CriterioPremio,
  DashboardRifa,
  Premio,
  Rifa,
} from "@/types";

/**
 * Núcleo PURO y testeable de la vertical de rifas (sin I/O). Espeja el estilo de
 * `calcularResultadoPartido` / `calcularDetalle`: entra data, sale el cálculo.
 *
 * Cubre: métricas del dashboard financiero, resolución de ganadores por lotería,
 * construcción de la grilla pública (ocupado/libre) y enmascarado de nombres.
 */

/** Formatea COP. Reexport para tener todo el dominio rifa en un solo import. */
export { formatCOP } from "@/lib/polla";

/**
 * Enmascara un nombre para vistas públicas: conserva las 2 primeras letras de
 * cada palabra y tapa el resto. "Diego Cumbe" → "Di**** Cu***".
 */
export function enmascararNombre(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => {
      if (palabra.length <= 2) return palabra;
      const visible = palabra.slice(0, 2);
      const oculto = "*".repeat(Math.max(3, palabra.length - 2));
      return visible + oculto;
    })
    .join(" ");
}

/** Números tomados (reservados o pagados) de una rifa. */
export function numerosTomados(boletas: Boleta[]): Set<number> {
  return new Set(
    boletas.filter((b) => b.estado !== "libre").map((b) => b.numero),
  );
}

/**
 * Construye la grilla PÚBLICA `0..cantidad-1`. Un número tomado (reservado O
 * pagado) se marca solo como `ocupado` — nunca se revela el estado real de pago.
 */
export function construirGrillaPublica(
  cantidad: number,
  boletas: Boleta[],
): BoletaPublica[] {
  const tomados = numerosTomados(boletas);
  return Array.from({ length: cantidad }, (_, numero) => ({
    numero,
    ocupado: tomados.has(numero),
  }));
}

/** Métricas financieras del dashboard de una rifa (para el admin del tenant). */
export function calcularDashboard(
  rifa: Rifa,
  boletas: Boleta[],
): DashboardRifa {
  const total = rifa.cantidad_numeros;
  const pagadas = boletas.filter((b) => b.estado === "pagado").length;
  const pendientes = boletas.filter((b) => b.estado === "reservado").length;
  const vendidas = pagadas + pendientes;
  const libres = Math.max(0, total - vendidas);

  const recaudado = pagadas * rifa.precio_boleta;
  const esperadoTotal = total * rifa.precio_boleta;
  const pctCumplimiento =
    esperadoTotal > 0 ? Math.round((recaudado / esperadoTotal) * 100) : 0;
  const pctVendido = total > 0 ? Math.round((vendidas / total) * 100) : 0;

  return {
    total,
    vendidas,
    pagadas,
    pendientes,
    libres,
    recaudado,
    esperadoTotal,
    pctCumplimiento,
    pctVendido,
  };
}

/** Cifras relevantes de un resultado de lotería, según el formato de la rifa. */
export function cifrasDeResultado(
  resultado: string,
  formatoCifras: number,
): { primeras: number; ultimas: number } | null {
  const digitos = resultado.replace(/\D/g, "");
  if (digitos.length < formatoCifras) return null;
  const primeras = parseInt(digitos.slice(0, formatoCifras), 10);
  const ultimas = parseInt(digitos.slice(-formatoCifras), 10);
  if (Number.isNaN(primeras) || Number.isNaN(ultimas)) return null;
  return { primeras, ultimas };
}

/** Un ganador propuesto tras cruzar el resultado de la lotería con las boletas. */
export interface GanadorResuelto {
  premio_id: string;
  criterio: CriterioPremio | null;
  numero: number;
  /** Boleta ganadora, o `null` si nadie compró ese número. */
  boleta_id: string | null;
}

/** Boletas elegibles para el sorteo (regla "no pagada no juega"). */
export function boletasElegibles(rifa: Rifa, boletas: Boleta[]): Boleta[] {
  return boletas.filter((b) =>
    rifa.solo_pagadas_juegan
      ? b.estado === "pagado"
      : b.estado === "pagado" || b.estado === "reservado",
  );
}

/**
 * Resuelve los ganadores de una rifa de LOTERÍA cruzando el resultado con las
 * boletas elegibles. Para cada premio con criterio (`primeras_2`/`ultimas_2`)
 * toma el número objetivo y busca quién lo tiene. Devuelve también los premios
 * cuyo número no fue vendido (`boleta_id = null`), para avisar en el backoffice.
 */
export function resolverGanadores(
  rifa: Rifa,
  premios: Premio[],
  boletas: Boleta[],
  resultado: string,
): GanadorResuelto[] {
  const cifras = cifrasDeResultado(resultado, rifa.formato_cifras);
  if (!cifras) return [];

  const elegibles = boletasElegibles(rifa, boletas);
  const porNumero = new Map(elegibles.map((b) => [b.numero, b]));

  return premios
    .filter((p) => p.criterio !== null)
    .map((premio) => {
      const numero =
        premio.criterio === "primeras_2" ? cifras.primeras : cifras.ultimas;
      const boleta = porNumero.get(numero) ?? null;
      return {
        premio_id: premio.id,
        criterio: premio.criterio,
        numero,
        boleta_id: boleta?.id ?? null,
      };
    });
}
