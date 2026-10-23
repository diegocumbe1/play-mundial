import type { PlataformaConfig } from "@/types";

/**
 * Núcleo PURO del cobro por activar una rifa. Vive aparte de `planes.ts`
 * (que es `server-only`) para que la calculadora de ganancias del navegador
 * use exactamente la misma regla que cobra el servidor.
 */

/** Lo que hace falta de la configuración para calcular el cobro de una rifa. */
export type ConfigCobroRifa = Pick<
  PlataformaConfig,
  | "cobro_rifa_modo"
  | "cobro_rifa_pct"
  | "cobro_rifa_min"
  | "cobro_rifa_max"
  | "cobro_rifa_max_5000"
  | "cobro_rifa_max_10000"
  | "precio_rifa_100"
  | "precio_rifa_500"
  | "precio_rifa_1000"
>;

/** Deja el cobro dentro del piso y el techo configurados (0 = desactivado). */
function acotar(valor: number, min: number, max: number): number {
  let v = Math.max(0, Math.round(valor));
  if (min > 0) v = Math.max(v, min);
  if (max > 0) v = Math.min(v, max);
  return v;
}

/**
 * Techo del cobro según el tamaño: hasta 1.000 números, hasta 5.000 y más.
 * Una rifa grande mueve más datos y más gestión, así que su tope es mayor.
 */
export function topeCobroRifa(c: ConfigCobroRifa, n: number): number {
  if (n <= 1000) return c.cobro_rifa_max;
  if (n <= 5000) return c.cobro_rifa_max_5000 ?? c.cobro_rifa_max;
  return c.cobro_rifa_max_10000 ?? c.cobro_rifa_max;
}

/** Cuánto cuesta activar una rifa de `n` números a `precioBoleta` cada uno. */
export function cobroActivacionRifa(c: ConfigCobroRifa, n: number, precioBoleta: number): number {
  // Regla vigente: un % del recaudo proyectado (números × precio), acotado.
  // Es la única monótona: a más recaudo, más cobro.
  if (c.cobro_rifa_modo === "porcentaje") {
    const recaudo = Math.max(0, n) * Math.max(0, precioBoleta);
    return acotar((recaudo * c.cobro_rifa_pct) / 100, c.cobro_rifa_min, topeCobroRifa(c, n));
  }
  // Modo "boleta": activar la rifa cuesta lo mismo que uno de sus puestos.
  if (c.cobro_rifa_modo === "boleta") {
    return acotar(precioBoleta, c.cobro_rifa_min, topeCobroRifa(c, n));
  }
  return n <= 100 ? c.precio_rifa_100 : n <= 500 ? c.precio_rifa_500 : c.precio_rifa_1000;
}

/** Recorta la configuración a lo que necesita el cálculo (para pasarla a un Client Component). */
export function configCobroRifa(c: PlataformaConfig): ConfigCobroRifa {
  return {
    cobro_rifa_modo: c.cobro_rifa_modo,
    cobro_rifa_pct: c.cobro_rifa_pct,
    cobro_rifa_min: c.cobro_rifa_min,
    cobro_rifa_max: c.cobro_rifa_max,
    cobro_rifa_max_5000: c.cobro_rifa_max_5000,
    cobro_rifa_max_10000: c.cobro_rifa_max_10000,
    precio_rifa_100: c.precio_rifa_100,
    precio_rifa_500: c.precio_rifa_500,
    precio_rifa_1000: c.precio_rifa_1000,
  };
}

/**
 * Proyección de ganancias de una rifa para UN precio por número. El cobro de
 * activación se calcula sobre la rifa vendida completa (así lo cobra la
 * plataforma); lo que cambia con `pctVendido` es lo que de verdad entra.
 */
export interface ProyeccionRifa {
  precio: number;
  recaudoTotal: number;
  vendidos: number;
  recaudo: number;
  costoActivacion: number;
  ganancia: number;
  /** Números que hay que vender para cubrir premio + activación (`null` si el precio es 0). */
  equilibrio: number | null;
}

export function proyectarRifa(
  c: ConfigCobroRifa,
  { cantidad, precio, costoPremio, pctVendido }: {
    cantidad: number;
    precio: number;
    costoPremio: number;
    pctVendido: number;
  },
): ProyeccionRifa {
  const n = Math.max(0, Math.trunc(cantidad));
  const p = Math.max(0, precio);
  const costoActivacion = cobroActivacionRifa(c, n, p);
  const vendidos = Math.round((n * Math.min(100, Math.max(0, pctVendido))) / 100);
  const recaudo = vendidos * p;
  const gastos = Math.max(0, costoPremio) + costoActivacion;
  return {
    precio: p,
    recaudoTotal: n * p,
    vendidos,
    recaudo,
    costoActivacion,
    ganancia: recaudo - gastos,
    equilibrio: p > 0 ? Math.ceil(gastos / p) : null,
  };
}
