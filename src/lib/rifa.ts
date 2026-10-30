import type {
  Boleta,
  BolaSorteo,
  BoletaPublica,
  CriterioPremio,
  DashboardRifa,
  ModoCifras,
  MovimientoRifa,
  OrdenSorteo,
  Premio,
  Rifa,
  TipoRifa,
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
import { formatCOP as cop } from "@/lib/polla";
import { formatFechaCO } from "@/lib/fecha-co";

/**
 * Enmascara un nombre para vistas públicas: conserva las 2 primeras letras de
 * cada palabra y tapa el resto. "Maria Torres" → "Ma*** To****".
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

/**
 * Empaqueta los números tomados en un bitmap base64 (bit i → `inicio + i`).
 * Es lo que viaja en cada sondeo de la página pública: 10.000 números caben
 * en ~1,7 KB. Ver `decodificarOcupados`.
 */
export function codificarOcupados(rifa: RangoRifa, tomados: number[]): string {
  const inicio = inicioNumeros(rifa);
  const bytes = new Uint8Array(Math.ceil(rifa.cantidad_numeros / 8));
  for (const n of tomados) {
    const i = n - inicio;
    if (i >= 0 && i < rifa.cantidad_numeros) bytes[i >> 3] |= 1 << (i & 7);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Inverso de `codificarOcupados`: la grilla pública completa (ocupado/libre). */
export function decodificarOcupados(rifa: RangoRifa, ocupados: string): BoletaPublica[] {
  const bin = atob(ocupados);
  const inicio = inicioNumeros(rifa);
  return Array.from({ length: rifa.cantidad_numeros }, (_, i) => ({
    numero: inicio + i,
    ocupado: ((bin.charCodeAt(i >> 3) || 0) & (1 << (i & 7))) !== 0,
  }));
}

/** Métricas financieras del dashboard de una rifa (para el admin del tenant). */
export function calcularDashboard(
  rifa: Rifa,
  boletas: Boleta[],
  movimientos: MovimientoRifa[] = [],
): DashboardRifa {
  const total = rifa.cantidad_numeros;
  const pagadas = boletas.filter((b) => b.estado === "pagado").length;
  const pendientes = boletas.filter((b) => b.estado === "reservado").length;
  const vendidas = pagadas + pendientes;
  const libres = Math.max(0, total - vendidas);

  // Abonos (separar con saldo): un apartado que ya abonó cuenta lo abonado como
  // recaudado y solo su saldo como por cobrar. Una pagada por abonos reparte el
  // efectivo según sus abonos, no según el medio del último.
  const abonadoReservadas = boletas
    .filter((b) => b.estado === "reservado")
    .reduce((s, b) => s + Math.min(b.monto_abonado ?? 0, rifa.precio_boleta), 0);
  const efectivoDe = (b: Boleta) =>
    (b.monto_abonado ?? 0) > 0
      ? Math.min(b.abonado_efectivo ?? 0, rifa.precio_boleta)
      : b.estado === "pagado" && b.metodo_pago === "efectivo"
        ? rifa.precio_boleta
        : 0;

  const recaudado = pagadas * rifa.precio_boleta + abonadoReservadas;
  const porCobrar = pendientes * rifa.precio_boleta - abonadoReservadas;
  const esperadoTotal = total * rifa.precio_boleta;
  const pctCumplimiento =
    esperadoTotal > 0 ? Math.round((recaudado / esperadoTotal) * 100) : 0;
  const pctVendido = total > 0 ? Math.round((vendidas / total) * 100) : 0;

  // Sin medio registrado (boletas viejas) se asume transferencia, el medio por defecto.
  const recaudadoEfectivo = boletas.reduce((s, b) => s + efectivoDe(b), 0);
  const recaudadoTransferencia = recaudado - recaudadoEfectivo;
  const salidas = (metodo: MovimientoRifa["metodo"]) =>
    movimientos.filter((m) => m.metodo === metodo).reduce((s, m) => s + m.monto, 0);
  const salidasEfectivo = salidas("efectivo");
  const salidasTransferencia = salidas("transferencia");

  return {
    recaudadoEfectivo,
    recaudadoTransferencia,
    salidasEfectivo,
    salidasTransferencia,
    saldo: recaudado - salidasEfectivo - salidasTransferencia,
    saldoEfectivo: recaudadoEfectivo - salidasEfectivo,
    saldoTransferencia: recaudadoTransferencia - salidasTransferencia,
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
  // Con 4 cifras el número es el resultado completo: no hay primeras/últimas.
  if (formatoCifras >= 4) return `${formatoCifras} cifras del premio mayor`;
  if (modo === "primeras_dos") return `primeras ${formatoCifras} cifras`;
  if (modo === "ambas") return `primeras o últimas ${formatoCifras} cifras`;
  return `últimas ${formatoCifras} cifras`;
}

/** Igual que `labelModoCifras`, pero para el criterio de un premio puntual. */
export function labelCriterioPremio(
  criterio: CriterioPremio,
  formatoCifras: number,
): string {
  if (formatoCifras >= 4) return `${formatoCifras} cifras del premio mayor`;
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

/** ¿El sorteo tiene ronda final (se filtran finalistas y luego sale el ganador)? */
export function tieneRondaFinal(bolas: number, ganadores: number): boolean {
  return bolas > 1 && ganadores >= 1 && ganadores < bolas;
}

/**
 * Cómo se juega el sorteo propio, en palabras para el jugador. Cubre los dos
 * modos: una sola ronda ("se sacan 3 y el premio mayor es la última") y el de
 * dos rondas ("se sacan 5 finalistas y de esas 5 sale 1 ganadora").
 */
export function labelSorteoPropio(
  bolas: number,
  ganadores: number,
  orden: OrdenSorteo,
): string {
  if (bolas <= 1) return "Se saca 1 balota al azar y ese número gana.";

  if (tieneRondaFinal(bolas, ganadores)) {
    const final =
      ganadores === 1
        ? "se revuelven esas y sale 1: esa se lleva el premio mayor"
        : `se revuelven esas y salen ${ganadores}, y el premio mayor se lo lleva ${
            orden === "ultimo_mayor" ? "la última" : "la primera"
          }`;
    return `Se sacan ${bolas} balotas al azar como finalistas; ${final}.`;
  }

  const cual = orden === "ultimo_mayor" ? "la última" : "la primera";
  return `Se sacan ${bolas} balotas al azar; el premio mayor se lo lleva ${cual} en salir.`;
}

/**
 * Cómo se gana un premio puntual, partido en dos para la tarjeta del premio:
 * `antes` va en letra normal y `destacado` en grande ("Gana con las" +
 * "primeras 2 cifras"). En lotería sale del criterio del premio; en el sorteo
 * propio, de qué balota se lo lleva según `sorteo_orden`. `null` si no aplica.
 */
export function comoSeGanaPremio(
  rifa: {
    tipo: TipoRifa;
    formato_cifras: number;
    sorteo_bolas: number;
    sorteo_ganadores: number;
    sorteo_orden: OrdenSorteo;
  },
  criterio: CriterioPremio | null,
  posicion: number,
): { antes: string; destacado: string } | null {
  if (rifa.tipo === "loteria") {
    if (!criterio) return null;
    return { antes: "Gana con las", destacado: labelCriterioPremio(criterio, rifa.formato_cifras) };
  }
  const bolas = rifa.sorteo_bolas || 1;
  const ganadores = rifa.sorteo_ganadores || 1;
  const conPremio = tieneRondaFinal(bolas, ganadores) ? ganadores : bolas;
  if (posicion > conPremio || conPremio <= 1) return null;
  // Balota (1-based, en orden de salida) que se lleva este premio.
  const balota = rifa.sorteo_orden === "ultimo_mayor" ? conPremio - posicion + 1 : posicion;
  const cual =
    balota === 1 ? "primera" : balota === conPremio ? "última" : `${balota}.ª`;
  return { antes: "Gana la", destacado: `${cual} balota` };
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
 * Arma las balotas que se muestran (backoffice, público y simulación) a partir
 * de las dos rondas. Es la única traducción de "números sorteados" a "qué se ve
 * en pantalla", para que el panel, el live y el replay no se contradigan.
 *
 * Sin ronda final (`finales` vacío) cada balota que sale ya lleva su premio.
 * Con ronda final, las de la primera quedan como finalistas sin premio y los
 * premios se reparten entre las de la segunda.
 */
export function construirBolas({
  finalistas,
  finales = [],
  premios,
  orden,
  nombre = () => null,
}: {
  finalistas: number[];
  finales?: number[];
  /** Descripciones de los premios, del mayor al menor. */
  premios: string[];
  orden: OrdenSorteo;
  nombre?: (numero: number) => string | null;
}): BolaSorteo[] {
  const hayFinal = finales.length > 0;

  const conPremio = (numeros: number[], fase: BolaSorteo["fase"]): BolaSorteo[] =>
    numeros.map((numero, i) => {
      const pos = posicionPremioDeBola(i, numeros.length, premios.length, orden);
      return {
        orden: i + 1,
        fase,
        numero,
        premio: pos ? (premios[pos - 1] ?? null) : null,
        mayor: pos === 1,
        nombre: nombre(numero),
      };
    });

  if (!hayFinal) return conPremio(finalistas, "ganadora");

  return [
    ...finalistas.map((numero, i) => ({
      orden: i + 1,
      fase: "finalista" as const,
      numero,
      premio: null,
      mayor: false,
      nombre: nombre(numero),
    })),
    ...conPremio(finales, "ganadora"),
  ];
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

/* -------------------------------------------------------------------------- */
/* Elección rápida de números (mínimo por compra en rifas grandes)             */
/* -------------------------------------------------------------------------- */

/** `cantidad` números libres al azar, en orden ascendente. */
export function elegirAlAzar(
  libres: number[],
  cantidad: number,
  rng: () => number = Math.random,
): number[] {
  return sortearBolas(libres, cantidad, rng).sort((a, b) => a - b);
}

/**
 * `cantidad` números libres SEGUIDOS (p. ej. 4520–4529), en un tramo elegido
 * al azar entre todos los que caben. `null` si no queda ningún tramo así.
 */
export function elegirSeguidos(
  libres: number[],
  cantidad: number,
  rng: () => number = Math.random,
): number[] | null {
  const n = Math.max(1, Math.trunc(cantidad));
  const orden = [...libres].sort((a, b) => a - b);
  // Inicios válidos: el número abre una racha de al menos `n` consecutivos.
  const inicios: number[] = [];
  let racha = 0;
  for (let i = orden.length - 1; i >= 0; i--) {
    racha = i + 1 < orden.length && orden[i + 1] === orden[i] + 1 ? racha + 1 : 1;
    if (racha >= n) inicios.push(orden[i]);
  }
  if (inicios.length === 0) return null;
  const inicio = inicios[Math.floor(rng() * inicios.length)];
  return Array.from({ length: n }, (_, i) => inicio + i);
}

/* -------------------------------------------------------------------------- */
/* Reglas de pago por cuotas: quién juega cada premio                          */
/* -------------------------------------------------------------------------- */

export type ReglasCuotas = Pick<
  Rifa,
  | "precio_boleta"
  | "solo_pagadas_juegan"
  | "permite_abonos"
  | "abono_minimo"
  | "dias_limite_pago"
  | "fecha_loteria"
>;

/** Lo que importa de un premio para saber quién lo juega. */
export type ReglaPremio = {
  fecha_loteria?: string | null;
  /** Cuánto debe llevar pagado el número para jugarlo. null = pago completo. */
  minimo_para_jugar?: number | null;
};

/** Fecha en que se juega un premio: la suya o la de la rifa. */
export function fechaDePremio(rifa: Pick<Rifa, "fecha_loteria">, premio: ReglaPremio): string | null {
  return (premio.fecha_loteria ?? rifa.fecha_loteria)?.slice(0, 10) ?? null;
}

/**
 * Cuánto debe llevar pagado un número para jugar este premio. Por defecto el
 * precio completo; un premio puede pedir menos ("con la cuota al día") solo si
 * la rifa permite abonos.
 */
export function requeridoParaPremio(rifa: ReglasCuotas, premio: ReglaPremio): number {
  const precio = rifa.precio_boleta;
  if (!rifa.permite_abonos || !premio.minimo_para_jugar) return precio;
  return Math.min(precio, premio.minimo_para_jugar);
}

/**
 * Último instante en que un pago cuenta para el sorteo de `fecha`: fin del día
 * (hora Colombia) `dias_limite_pago` días antes. `null` = sin límite.
 */
export function cortePagoSorteo(rifa: ReglasCuotas, fecha: string | null): Date | null {
  if (rifa.dias_limite_pago == null || !fecha) return null;
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  // 23:59:59 en Colombia (UTC−5) = 04:59:59 UTC del día siguiente.
  return new Date(Date.UTC(y, m - 1, d - rifa.dias_limite_pago + 1, 4, 59, 59));
}

/** Día límite (AAAA-MM-DD) para tener el pago de un premio, o null sin límite. */
export function diaLimitePago(rifa: ReglasCuotas, premio: ReglaPremio): string | null {
  const fecha = fechaDePremio(rifa, premio);
  if (rifa.dias_limite_pago == null || !fecha) return null;
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - rifa.dias_limite_pago)).toISOString().slice(0, 10);
}

/**
 * Números que juegan ESTE premio: cuánto llevaban pagado al corte de su sorteo
 * frente a lo que exige el premio. Sin "solo pagadas" juega todo lo vendido.
 */
export function elegiblesParaPremio(
  rifa: ReglasCuotas,
  premio: ReglaPremio,
  boletas: Boleta[],
  abonos: { boleta_id: string; monto: number; created_at: string }[] = [],
): Boleta[] {
  if (!rifa.solo_pagadas_juegan) {
    return boletas.filter((b) => b.estado === "pagado" || b.estado === "reservado");
  }
  const requerido = requeridoParaPremio(rifa, premio);
  const corte = cortePagoSorteo(rifa, fechaDePremio(rifa, premio))?.getTime() ?? Infinity;
  const abonosPorBoleta = new Map<string, { monto: number; t: number }[]>();
  for (const a of abonos) {
    const lista = abonosPorBoleta.get(a.boleta_id) ?? [];
    lista.push({ monto: a.monto, t: Date.parse(a.created_at) });
    abonosPorBoleta.set(a.boleta_id, lista);
  }
  return boletas.filter((b) => {
    if (b.estado === "libre") return false;
    const propios = abonosPorBoleta.get(b.id);
    const pagado = propios
      ? propios.filter((a) => a.t <= corte).reduce((s, a) => s + a.monto, 0)
      : b.estado === "pagado" && (!b.pagado_at || Date.parse(b.pagado_at) <= corte)
        ? rifa.precio_boleta
        : 0;
    return pagado > 0 && pagado >= requerido;
  });
}

/**
 * Qué exige un premio, en corto, para su tarjeta: "Pago completo hasta el 18
 * de noviembre". `null` si la rifa no tiene reglas de pago que contar.
 */
export function requisitoPremioTexto(rifa: ReglasCuotas, premio: ReglaPremio): string | null {
  if (!rifa.solo_pagadas_juegan || (!rifa.permite_abonos && rifa.dias_limite_pago == null)) {
    return null;
  }
  const req = requeridoParaPremio(rifa, premio);
  const que = req >= rifa.precio_boleta ? "pago completo" : `mínimo ${cop(req)} abonados`;
  const limite = diaLimitePago(rifa, premio);
  return `Para jugar: ${que}${limite ? ` hasta el ${formatFechaCO(limite, { conAnio: false })}` : ""}`;
}

/**
 * Reglas de pago en palabras, para el enlace público y la vista previa del
 * formulario. Cada línea es una regla. Vacía si la rifa no tiene reglas de pago.
 */
export function reglasPagoTexto(rifa: ReglasCuotas, premios: (ReglaPremio & { orden?: number })[]): string[] {
  if (!rifa.solo_pagadas_juegan || (!rifa.permite_abonos && rifa.dias_limite_pago == null)) {
    return [];
  }
  const lineas: string[] = [];

  if (rifa.permite_abonos && rifa.abono_minimo) {
    const cuotas = Math.ceil(rifa.precio_boleta / rifa.abono_minimo);
    // La última cuota vence con el último sorteo (menos el límite de pago).
    const ultimo = [...premios].sort((a, b) =>
      (fechaDePremio(rifa, a) ?? "").localeCompare(fechaDePremio(rifa, b) ?? ""),
    ).at(-1);
    const vence = ultimo ? (diaLimitePago(rifa, ultimo) ?? fechaDePremio(rifa, ultimo)) : null;
    lineas.push(
      `Separa tu número con ${cop(rifa.abono_minimo)}` +
        (cuotas > 1 ? ` y paga en ${cuotas} cuotas` : "") +
        (vence ? `; la última hasta el ${formatFechaCO(vence, { conAnio: false })}.` : "."),
    );
  }

  // Un renglón por premio con fecha: qué exige y hasta cuándo.
  const conFecha = premios
    .map((p, i) => ({ p, i, fecha: fechaDePremio(rifa, p) }))
    .filter((x) => x.fecha);
  const distintas = new Set(conFecha.map((x) => x.fecha)).size > 1;
  if (distintas) {
    for (const { p, i, fecha } of conFecha) {
      const req = requeridoParaPremio(rifa, p);
      const limite = diaLimitePago(rifa, p) ?? fecha!;
      lineas.push(
        `${p.orden ?? i + 1}° premio (${formatFechaCO(fecha, { conAnio: false })}): ` +
          (req >= rifa.precio_boleta ? "número pagado completo" : `mínimo ${cop(req)} abonados`) +
          ` a más tardar el ${formatFechaCO(limite, { conAnio: false })}.`,
      );
    }
  } else {
    const req = premios.length ? Math.min(...premios.map((p) => requeridoParaPremio(rifa, p))) : rifa.precio_boleta;
    lineas.push(
      req >= rifa.precio_boleta
        ? "Solo juegan los números pagados completos."
        : `Juegan los números con al menos ${cop(req)} abonados.`,
    );
    if (rifa.dias_limite_pago != null) {
      lineas.push(
        rifa.dias_limite_pago === 0
          ? "El pago cuenta si queda registrado a más tardar el día del sorteo."
          : `El pago cuenta si queda registrado a más tardar ${rifa.dias_limite_pago} día(s) antes del sorteo.`,
      );
    }
  }
  lineas.push("Número sin pagar a tiempo no participa en ese premio.");
  return lineas;
}

/**
 * ¿Los premios juegan en fechas distintas? Basta con que uno traiga su propia
 * fecha de lotería: entonces cada premio se resuelve con su propio resultado.
 */
export function premiosPorFecha(premios: { fecha_loteria?: string | null }[]): boolean {
  return premios.some((p) => !!p.fecha_loteria);
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
  /** Reglas de cuotas: qué números juegan ESE premio. Por defecto, la regla simple. */
  elegiblesDe?: (premio: Premio) => Boleta[],
): GanadorResuelto[] {
  const cifras = cifrasDeResultado(resultado, rifa.formato_cifras);
  if (!cifras) return [];

  const elegibles = boletasElegibles(rifa, boletas);
  const porNumeroGeneral = new Map(elegibles.map((b) => [b.numero, b]));

  return premios
    .filter((p) => p.criterio !== null)
    .map((premio) => {
      const numero =
        premio.criterio === "primeras_2" ? cifras.primeras : cifras.ultimas;
      const porNumero = elegiblesDe
        ? new Map(elegiblesDe(premio).map((b) => [b.numero, b]))
        : porNumeroGeneral;
      const boleta = porNumero.get(numero) ?? null;
      return {
        premio_id: premio.id,
        criterio: premio.criterio,
        numero,
        boleta_id: boleta?.id ?? null,
      };
    });
}
