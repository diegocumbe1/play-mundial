import type {
  Boleta,
  BoletaPublica,
  CriterioPremio,
  DashboardRifa,
  ModoCifras,
  OrdenSorteo,
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

/* -------------------------------------------------------------------------- */
/* Numeración: la rifa puede ir 00–29 (desde 0) o 01–30 (desde 1)              */
/* -------------------------------------------------------------------------- */

/** Lo mínimo que hace falta para saber qué números tiene una rifa. */
export type RangoRifa = Pick<Rifa, "cantidad_numeros"> & {
  numero_inicial?: number | null;
};

/** Primer número de la rifa: 1 solo si se configuró así; si no, 0. */
export function inicioNumeros(rifa: RangoRifa): number {
  return rifa.numero_inicial === 1 ? 1 : 0;
}

/** Último número de la rifa (30 en una de 30 que empieza en 1). */
export function ultimoNumero(rifa: RangoRifa): number {
  return inicioNumeros(rifa) + rifa.cantidad_numeros - 1;
}

/** Dígitos con los que se pinta un número (30 → 2 → "07"). */
export function anchoNumeros(rifa: RangoRifa): number {
  return String(Math.max(0, ultimoNumero(rifa))).length;
}

/** Pinta un número con ceros a la izquierda: (7, 2) → "07". */
export function formatNumero(numero: number, ancho: number): string {
  return String(numero).padStart(ancho, "0");
}

/** Todos los números de la rifa, en orden. */
export function numerosDeRifa(rifa: RangoRifa): number[] {
  const inicio = inicioNumeros(rifa);
  return Array.from({ length: rifa.cantidad_numeros }, (_, i) => inicio + i);
}

/** ¿El número cae dentro del rango vigente de la rifa? */
export function numeroEnRango(rifa: RangoRifa, numero: number): boolean {
  return numero >= inicioNumeros(rifa) && numero <= ultimoNumero(rifa);
}

/** Cómo se lee la numeración en pantalla: "01–30". */
export function labelRango(rifa: RangoRifa): string {
  const ancho = anchoNumeros(rifa);
  return `${formatNumero(inicioNumeros(rifa), ancho)}–${formatNumero(ultimoNumero(rifa), ancho)}`;
}

/** Números tomados (reservados o pagados) de una rifa. */
export function numerosTomados(boletas: Boleta[]): Set<number> {
  return new Set(
    boletas.filter((b) => b.estado !== "libre").map((b) => b.numero),
  );
}

/**
 * Construye la grilla PÚBLICA con el rango real de la rifa (desde 0 o desde 1).
 * Un número tomado (reservado O pagado) se marca solo como `ocupado` — nunca se
 * revela el estado real de pago.
 */
export function construirGrillaPublica(
  rifa: RangoRifa,
  boletas: Boleta[],
): BoletaPublica[] {
  const tomados = numerosTomados(boletas);
  return numerosDeRifa(rifa).map((numero) => ({
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
  const porCobrar = pendientes * rifa.precio_boleta;
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
    porCobrar,
    esperadoTotal,
    pctCumplimiento,
    pctVendido,
  };
}

/**
 * Cómo juega la rifa, en palabras: "últimas 2 cifras". Siempre nombra CUÁNTAS
 * cifras son (`formato_cifras`), que es el dato que el jugador necesita para
 * cruzar su número con el resultado de la lotería.
 */
export function labelModoCifras(
  modo: ModoCifras,
  formatoCifras: number,
): string {
  if (modo === "primeras_dos") return `primeras ${formatoCifras} cifras`;
  if (modo === "ambas") return `primeras o últimas ${formatoCifras} cifras`;
  return `últimas ${formatoCifras} cifras`;
}

/** Igual que `labelModoCifras`, pero para el criterio de un premio puntual. */
export function labelCriterioPremio(
  criterio: CriterioPremio,
  formatoCifras: number,
): string {
  return criterio === "primeras_2"
    ? `primeras ${formatoCifras} cifras`
    : `últimas ${formatoCifras} cifras`;
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

/* -------------------------------------------------------------------------- */
/* Sorteo propio (tipo `interna`): balotas al azar, tipo baloto                */
/* -------------------------------------------------------------------------- */

/**
 * Cómo se juega el sorteo propio, en palabras para el jugador:
 * "Se sacan 3 balotas al azar; el premio mayor se lo lleva la última".
 */
export function labelSorteoPropio(bolas: number, orden: OrdenSorteo): string {
  if (bolas <= 1) return "Se saca 1 balota al azar y ese número gana.";
  const cual = orden === "ultimo_mayor" ? "la última" : "la primera";
  return `Se sacan ${bolas} balotas al azar; el premio mayor se lo lleva ${cual} en salir.`;
}

/**
 * Qué premio se lleva la balota `indice` (0-based) de un sorteo de `bolas`.
 * Devuelve la POSICIÓN del premio (1 = premio mayor) o `null` si esa balota
 * salió de más (suplente, sin premio asignado).
 */
export function posicionPremioDeBola(
  indice: number,
  bolas: number,
  totalPremios: number,
  orden: OrdenSorteo,
): number | null {
  const posicion = orden === "ultimo_mayor" ? bolas - indice : indice + 1;
  return posicion >= 1 && posicion <= totalPremios ? posicion : null;
}

/**
 * Saca `bolas` números distintos al azar de entre los candidatos (Fisher-Yates
 * parcial). El `rng` es inyectable para poder probar el sorteo; en producción
 * la Server Action pasa uno basado en `crypto`.
 */
export function sortearBolas(
  candidatos: number[],
  bolas: number,
  rng: () => number = Math.random,
): number[] {
  const pool = [...candidatos];
  const cuantas = Math.min(Math.max(0, Math.trunc(bolas)), pool.length);
  const salida: number[] = [];
  for (let i = 0; i < cuantas; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    salida.push(pool[i]);
  }
  return salida;
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
