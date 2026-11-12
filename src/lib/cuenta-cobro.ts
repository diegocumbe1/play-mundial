/** Reglas puras de las cuentas de cobro (sin I/O): números, letras y estados. */

import type { CuentaCobro, EstadoCuentaCobro, LineaCobro } from "@/types";

const UNIDADES = [
  "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho",
  "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro",
  "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

/** 0–999 en palabras. */
function centenas(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (r > 0) {
    if (r < 30) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`);
    }
  }
  return partes.join(" ");
}

/** Entero 0–999.999.999 en palabras ("ciento treinta mil"). */
export function numeroEnPalabras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) return "";
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? "un millón" : `${apocopar(centenas(millones))} millones`);
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${apocopar(centenas(miles))} mil`);
  if (resto > 0) partes.push(centenas(resto));
  return partes.join(" ");
}

/** "uno" → "un" delante de mil y millones ("veintiún mil", "treinta y un mil"). */
function apocopar(texto: string): string {
  return texto.replace(/veintiuno$/, "veintiún").replace(/ y uno$/, " y un").replace(/(^|\s)uno$/, "$1un");
}

/** "CIENTO TREINTA MIL PESOS M/CTE". */
export function valorEnLetras(valor: number): string {
  const palabras = numeroEnPalabras(valor);
  if (!palabras) return "";
  const moneda = valor === 1 ? "peso" : valor >= 1_000_000 && valor % 1_000_000 === 0 ? "de pesos" : "pesos";
  return `${palabras} ${moneda} M/CTE`.toUpperCase();
}

/** Consecutivo con ceros a la izquierda: 1 → "001". */
export const numeroCuenta = (n: number): string => String(n).padStart(3, "0");

/** "2026-11-11" → "11 de noviembre de 2026" (sin depender de la zona horaria). */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${Number(m[3])} de ${meses[Number(m[2]) - 1]} de ${m[1]}`;
}

/** El cliente solo puede completar sus datos mientras la cuenta está «enviada». */
export const clienteEdita = (estado: EstadoCuentaCobro): boolean => estado === "enviada";

export const ETIQUETA_ESTADO: Record<EstadoCuentaCobro, string> = {
  enviada: "Enviada · esperando datos",
  datos_completos: "Datos completos",
  pagada: "Pagada",
  anulada: "Anulada",
};

/** Hoy en Colombia, "YYYY-MM-DD". */
export const hoyColombia = (): string =>
  new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

/** Total de una línea. */
export const totalLinea = (l: Pick<LineaCobro, "cantidad" | "valor_unitario">): number =>
  l.cantidad * l.valor_unitario;

/** Suma de todas las líneas. */
export const totalLineas = (lineas: readonly LineaCobro[]): number =>
  lineas.reduce((suma, l) => suma + totalLinea(l), 0);

/**
 * Conceptos de una cuenta: sus líneas o, si es una cuenta de un solo concepto
 * (anterior a las líneas), ese concepto como una línea.
 */
export function lineasDe(
  c: Pick<CuentaCobro, "lineas" | "concepto" | "concepto_detalle" | "valor">,
): LineaCobro[] {
  if (c.lineas && c.lineas.length > 0) return c.lineas;
  return [{ descripcion: c.concepto, detalle: c.concepto_detalle, cantidad: 1, valor_unitario: c.valor }];
}

/** Título corto de la cuenta a partir de sus líneas: «Concepto» o «Concepto y 2 más». */
export function conceptoResumen(lineas: readonly LineaCobro[]): string {
  if (lineas.length === 0) return "";
  const [primera, ...resto] = lineas;
  return resto.length === 0 ? primera.descripcion : `${primera.descripcion} y ${resto.length} más`;
}

/** "11 de noviembre de 2026, 10:42 p. m." en hora de Colombia. */
export function fechaHoraLarga(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const f = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return f.replace(" a. m.", " a. m.").replace(" p. m.", " p. m.");
}
