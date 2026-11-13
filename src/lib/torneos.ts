import type {
  AlertaTorneo,
  CategoriaTorneo,
  DashboardTorneo,
  EquipoTorneo,
  EquipoTorneoPublico,
  EstadoEquipoTorneo,
  EstadoTorneo,
  FormatoTorneo,
  GastoTorneo,
  IngresoTorneo,
  PagoEquipoTorneo,
  PremioTorneo,
  Torneo,
} from "@/types";

/**
 * Núcleo PURO y testeable de la vertical de torneos (sin I/O, sin Supabase).
 * Mismo estilo que `src/lib/rifa.ts`: entra data, sale el cálculo.
 *
 * Cubre: ingresos, gastos, rentabilidad, punto de equilibrio, alertas de
 * viabilidad y el corte público de equipos (sin datos personales).
 */

/** Formatea COP. Reexport para tener todo el dominio torneo en un solo import. */
export { formatCOP } from "@/lib/polla";
import { formatCOP } from "@/lib/polla";

// ---------------------------------------------------------------------------
// Catálogos (copy del backoffice)
// ---------------------------------------------------------------------------

/** Deportes sugeridos. El campo es texto libre: la lista solo agiliza el alta. */
export const DEPORTES = [
  "Fútbol",
  "Fútbol sala",
  "Fútbol 8",
  "Voleibol",
  "Voleiplaya",
  "Baloncesto",
  "Pádel",
  "Tenis",
  "Ultimate",
  "Otro",
] as const;

/** Categorías de gasto sugeridas para el módulo financiero. */
export const CATEGORIAS_GASTO: { id: string; nombre: string }[] = [
  { id: "alquiler_cancha", nombre: "Alquiler de cancha" },
  { id: "arbitraje", nombre: "Arbitraje" },
  { id: "premiacion", nombre: "Premiación" },
  { id: "trofeos", nombre: "Trofeos" },
  { id: "medallas", nombre: "Medallas" },
  { id: "hidratacion", nombre: "Hidratación" },
  { id: "uniformes", nombre: "Uniformes" },
  { id: "publicidad", nombre: "Publicidad" },
  { id: "fotografia", nombre: "Fotografía" },
  { id: "transmision", nombre: "Transmisión" },
  { id: "sonido", nombre: "Sonido" },
  { id: "ambulancia", nombre: "Ambulancia" },
  { id: "personal", nombre: "Personal" },
  { id: "logistica", nombre: "Logística" },
  { id: "transporte", nombre: "Transporte" },
  { id: "impuestos", nombre: "Impuestos" },
  { id: "imprevistos", nombre: "Imprevistos" },
  { id: "otro", nombre: "Otro" },
];

/** Categorías que representan el costo del escenario deportivo. */
const CATEGORIAS_ESCENARIO = ["alquiler_cancha"];

/** Categorías de gasto que cubren la premiación. */
const CATEGORIAS_PREMIACION = ["premiacion", "trofeos", "medallas"];

/** Nombre del puesto: 1 → "1er puesto", 2 → "2° puesto"… */
export function labelPuesto(puesto: number): string {
  if (puesto === 1) return "1er puesto";
  if (puesto === 2) return "2° puesto";
  if (puesto === 3) return "3er puesto";
  return `${puesto}° puesto`;
}

/** Cómo se conoce al ganador de cada puesto (para el copy público). */
export function apodoPuesto(puesto: number): string | null {
  if (puesto === 1) return "Campeón";
  if (puesto === 2) return "Subcampeón";
  return null;
}

/** Nombre legible de una categoría de gasto (acepta texto libre). */
export function labelCategoriaGasto(id: string): string {
  return CATEGORIAS_GASTO.find((c) => c.id === id)?.nombre ?? id;
}

/** Nombre legible del formato de competencia. */
export function labelFormatoTorneo(formato: FormatoTorneo): string {
  const mapa: Record<FormatoTorneo, string> = {
    todos_contra_todos: "Todos contra todos",
    eliminacion_directa: "Eliminación directa",
    grupos_eliminacion: "Grupos + eliminación",
    personalizado: "Personalizado",
  };
  return mapa[formato];
}

/** Nombre legible del estado del torneo. */
export function labelEstadoTorneo(estado: EstadoTorneo): string {
  const mapa: Record<EstadoTorneo, string> = {
    borrador: "Borrador",
    inscripciones: "Inscripciones abiertas",
    programado: "Programado",
    en_curso: "En curso",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  };
  return mapa[estado];
}

/** Nombre legible del estado de un equipo. */
export function labelEstadoEquipo(estado: EstadoEquipoTorneo): string {
  const mapa: Record<EstadoEquipoTorneo, string> = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    rechazado: "Rechazado",
    retirado: "Retirado",
  };
  return mapa[estado];
}

/** Estados de torneo visibles para el público (espeja la policy `anon` de la RLS). */
export const ESTADOS_TORNEO_PUBLICOS: EstadoTorneo[] = [
  "inscripciones",
  "programado",
  "en_curso",
  "finalizado",
];

// ---------------------------------------------------------------------------
// Reglas de dominio
// ---------------------------------------------------------------------------

/**
 * Equipos que ocupan cupo: los pendientes y los confirmados. Los rechazados y
 * retirados liberan su lugar y no cuentan para nada financiero.
 */
export function equiposVigentes(equipos: EquipoTorneo[]): EquipoTorneo[] {
  return equipos.filter((e) => e.estado === "pendiente" || e.estado === "confirmado");
}

/** Lo que debe pagar un equipo: su monto propio o el valor de inscripción del torneo. */
export function montoEsperadoEquipo(torneo: Torneo, equipo: EquipoTorneo): number {
  return equipo.monto_inscripcion ?? torneo.valor_inscripcion;
}

/** Saldo pendiente de un equipo (nunca negativo). */
export function saldoEquipo(torneo: Torneo, equipo: EquipoTorneo): number {
  return Math.max(0, montoEsperadoEquipo(torneo, equipo) - equipo.monto_pagado);
}

/**
 * Corte PÚBLICO de los equipos: solo identidad deportiva. Nunca responsable,
 * teléfono, correo, comprobante, método de pago ni montos.
 */
export function construirEquiposPublicos(
  equipos: EquipoTorneo[],
): EquipoTorneoPublico[] {
  return equiposVigentes(equipos).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    escudo_url: e.escudo_url,
    confirmado: e.estado === "confirmado",
  }));
}

// ---------------------------------------------------------------------------
// Finanzas
// ---------------------------------------------------------------------------

/** Ingresos de un torneo: lo que se puede llegar a recaudar y lo que ya entró. */
export interface IngresosTorneo {
  /** Cupo completo × valor de inscripción. */
  proyectados: number;
  /** Dinero efectivamente recibido de los equipos vigentes. */
  recaudados: number;
  /** Saldo de los equipos ya registrados. */
  porCobrar: number;
  /** `recaudados / proyectados` en porcentaje entero. */
  pctRecaudado: number;
}

export function calcularIngresosTorneo(
  torneo: Torneo,
  equipos: EquipoTorneo[],
): IngresosTorneo {
  const vigentes = equiposVigentes(equipos);
  const proyectados = torneo.cupo_equipos * torneo.valor_inscripcion;
  const recaudados = vigentes.reduce((suma, e) => suma + e.monto_pagado, 0);
  const porCobrar = vigentes.reduce((suma, e) => suma + saldoEquipo(torneo, e), 0);
  const pctRecaudado =
    proyectados > 0 ? Math.round((recaudados / proyectados) * 100) : 0;

  return { proyectados, recaudados, porCobrar, pctRecaudado };
}

/**
 * Premios ordenados por puesto (1°, 2°, 3°…). Los guarda el backoffice ya
 * numerados, pero se ordena aquí para no depender del orden de la consulta.
 */
export function premiosOrdenados<T extends { puesto: number }>(premios: T[]): T[] {
  return [...premios].sort((a, b) => a.puesto - b.puesto);
}

/**
 * Cuánto cuesta la premiación en dinero. Los premios de tipo `producto` no
 * suman: su costo se registra como gasto (trofeos, medallas…).
 */
export function valorPremiacion(
  premios: { tipo: "valor" | "producto"; valor: number | null }[],
): number {
  return premios.reduce(
    (suma, p) => suma + (p.tipo === "valor" ? (p.valor ?? 0) : 0),
    0,
  );
}

/** Gastos de un torneo: lo presupuestado, lo ya pagado y lo que falta pagar. */
export interface GastosTorneo {
  proyectados: number;
  pagados: number;
  pendientes: number;
}

const sinTildes = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Categoría del torneo a la que pertenece un gasto de premiación, según el
 * nombre en su descripción («Premiación 5 vs 5» → categoría «5 vs 5»).
 * Los demás gastos son generales (`null`).
 */
export function categoriaDeGasto(gasto: GastoTorneo, categorias: CategoriaTorneo[]): CategoriaTorneo | null {
  if (!CATEGORIAS_PREMIACION.includes(gasto.categoria) || !gasto.descripcion) return null;
  const texto = sinTildes(gasto.descripcion);
  // Si un nombre contiene a otro, gana el más largo.
  return (
    [...categorias]
      .sort((a, b) => b.nombre.length - a.nombre.length)
      .find((c) => c.nombre.trim() && texto.includes(sinTildes(c.nombre.trim()))) ?? null
  );
}

/**
 * Separa los gastos que ya cuentan de los de premiación de categorías que aún no
 * tienen equipos inscritos (esos no se muestran ni suman hasta que haya inscritos).
 */
export function gastosSegunInscritos(
  gastos: GastoTorneo[],
  categorias: CategoriaTorneo[],
  equipos: EquipoTorneo[],
): { visibles: GastoTorneo[]; ocultos: GastoTorneo[] } {
  const vigentes = equiposVigentes(equipos);
  const visibles: GastoTorneo[] = [];
  const ocultos: GastoTorneo[] = [];
  for (const g of gastos) {
    const c = categoriaDeGasto(g, categorias);
    if (c && !vigentes.some((e) => e.categoria_id === c.id)) ocultos.push(g);
    else visibles.push(g);
  }
  return { visibles, ocultos };
}

export function calcularGastosTorneo(gastos: GastoTorneo[]): GastosTorneo {
  const proyectados = gastos.reduce((suma, g) => suma + g.valor_total, 0);
  const pagados = gastos
    .filter((g) => g.pagado)
    .reduce((suma, g) => suma + g.valor_total, 0);
  return { proyectados, pagados, pendientes: Math.max(0, proyectados - pagados) };
}

/**
 * Cuántos equipos hay que inscribir para cubrir los gastos.
 *
 * Devuelve `null` cuando no es calculable (inscripción gratuita o valor
 * inválido): sin ingreso por equipo no existe punto de equilibrio. Redondea
 * hacia arriba porque no se inscriben fracciones de equipo.
 */
export function calcularPuntoEquilibrio(
  gastosTotales: number,
  valorInscripcion: number,
): number | null {
  if (!Number.isFinite(gastosTotales) || !Number.isFinite(valorInscripcion)) return null;
  if (valorInscripcion <= 0) return null;
  if (gastosTotales <= 0) return 0;
  return Math.ceil(gastosTotales / valorInscripcion);
}

/** Métricas completas del torneo: ocupación, dinero y rentabilidad. */
export function calcularDashboardTorneo(
  torneo: Torneo,
  equipos: EquipoTorneo[],
  gastos: GastoTorneo[],
  /** Con categorías y premios, el punto de equilibrio usa el valor de cada categoría y la premiación. */
  categorias: CategoriaTorneo[] = [],
  premios: PremioTorneo[] = [],
  /** Otros ingresos (arbitraje, patrocinios…): suman a ingresos y utilidad. */
  otros: IngresoTorneo[] = [],
): DashboardTorneo {
  const vigentes = equiposVigentes(equipos);
  const equiposRegistrados = vigentes.length;
  const equiposConfirmados = vigentes.filter((e) => e.estado === "confirmado").length;
  const equiposPendientes = vigentes.filter((e) => e.estado === "pendiente").length;
  const cupoTotal = torneo.cupo_equipos;
  const cuposDisponibles = Math.max(0, cupoTotal - equiposRegistrados);
  const pctOcupacion =
    cupoTotal > 0 ? Math.round((equiposRegistrados / cupoTotal) * 100) : 0;

  const ingresos = calcularIngresosTorneo(torneo, equipos);
  const gastosCalc = calcularGastosTorneo(gastos);

  const otrosIngresos = otros.reduce((s, i) => s + i.valor, 0);
  const otrosIngresosRecibidos = otros.filter((i) => i.recibido).reduce((s, i) => s + i.valor, 0);
  const utilidadProyectada = ingresos.proyectados + otrosIngresos - gastosCalc.proyectados;
  const utilidadActual = ingresos.recaudados + otrosIngresosRecibidos - gastosCalc.pagados;

  return {
    cupoTotal,
    equiposRegistrados,
    equiposConfirmados,
    equiposPendientes,
    cuposDisponibles,
    pctOcupacion,
    ingresosProyectados: ingresos.proyectados + otrosIngresos,
    ingresosRecaudados: ingresos.recaudados + otrosIngresosRecibidos,
    otrosIngresos,
    otrosIngresosRecibidos,
    porCobrar: ingresos.porCobrar,
    pctRecaudado: ingresos.pctRecaudado,
    gastosProyectados: gastosCalc.proyectados,
    gastosPagados: gastosCalc.pagados,
    gastosPendientes: gastosCalc.pendientes,
    utilidadProyectada,
    utilidadActual,
    // Equipos inscritos que hacen falta (en total) para cubrir gastos y premios.
    puntoEquilibrioEquipos: (() => {
      const t = calcularCoberturaTorneo(torneo, categorias, equipos, gastos, premios, otros).total;
      return t.equiposParaEquilibrio === null ? null : t.inscritos + t.equiposParaEquilibrio;
    })(),
    utilidadPorEquipoConfirmado:
      equiposConfirmados > 0 ? Math.round(utilidadActual / equiposConfirmados) : 0,
  };
}

// ---------------------------------------------------------------------------
// Cifras reales y previstas del torneo (Finanzas y Resumen usan estas mismas)
// ---------------------------------------------------------------------------
export interface FilaDesglose {
  titulo: string;
  total: number;
  /** Los gastos que la forman, p. ej. «Arbitraje $ 600.000, Hidratación $ 250.000». */
  detalle: string;
}

/** «Premiación 5 vs 5 $ 2.500.000» o «Generales $ 850.000 (Arbitraje $ 600.000, …)». */
export function textoDesglose(f: FilaDesglose): string {
  return `${f.titulo} ${formatCOP(f.total)}${f.detalle ? ` (${f.detalle})` : ""}`;
}

export interface FilaEquilibrio {
  categoriaId: string | null;
  nombre: string;
  inscritos: number;
  valorInscripcion: number;
  /** Lo que cuesta su premiación (gasto registrado o premio en dinero, el mayor). */
  costo: number;
  /** Equipos que hacen falta para cubrir ese costo (`null` si la inscripción es gratis). */
  equipos: number | null;
  /** Cuántos faltan sobre los inscritos hoy (0 = ya cubre). */
  faltan: number | null;
}

export interface CifrasTorneo {
  inscritos: number;
  /** Equipos inscritos que han abonado algo. */
  equiposQuePagaron: number;
  /** Lo recibido: abonos de inscripción + otros ingresos ya recibidos. */
  ingresado: number;
  abonos: number;
  otrosRecibidos: number;
  gastado: number;
  gastosPagadosN: number;
  gastosPorPagarN: number;
  utilidadReal: number;
  /** Lo que deben en total los equipos inscritos (no el cupo). */
  inscripcionesPrevistas: number;
  otrosIngresos: number;
  ingresosPrevistos: number;
  gastosPrevistos: number;
  utilidadPrevista: number;
  porCobrar: number;
  /** cupo × valor: la meta con el cupo lleno (referencia). */
  metaCupoLleno: number;
  gastosIncluidos: FilaDesglose[];
  /** Premiación de categorías sin inscritos: aún no se cuenta. */
  gastosExcluidos: FilaDesglose[];
  equilibrio: {
    filas: FilaEquilibrio[];
    /** Gastos que no son de una categoría (arbitraje, cancha…): los cubren todas. */
    generales: { costo: number; equipos: number | null };
    /** Categorías sin inscritos, que no se consideran todavía. */
    sinInscritos: string[];
    valorPromedio: number;
    /** Equipos inscritos en total que cubren todo (menos otros ingresos). `null` si no se puede calcular. */
    equiposTotal: number | null;
    costoTotal: number;
  };
}

export function calcularCifrasTorneo(
  torneo: Torneo,
  categorias: CategoriaTorneo[],
  equipos: EquipoTorneo[],
  gastos: GastoTorneo[],
  premios: PremioTorneo[],
  otros: IngresoTorneo[],
): CifrasTorneo {
  const vigentes = equiposVigentes(equipos);
  const { visibles, ocultos } = gastosSegunInscritos(gastos, categorias, equipos);
  const sum = (l: { valor_total: number }[]) => l.reduce((t, x) => t + x.valor_total, 0);
  const enDinero = (p: PremioTorneo) => (p.tipo === "valor" ? (p.valor ?? 0) : 0);

  const abonos = vigentes.reduce((t, e) => t + e.monto_pagado, 0);
  const otrosRecibidos = otros.filter((i) => i.recibido).reduce((t, i) => t + i.valor, 0);
  const otrosIngresos = otros.reduce((t, i) => t + i.valor, 0);
  const gastado = sum(visibles.filter((g) => g.pagado));
  const gastosPrevistos = sum(visibles);
  const inscripcionesPrevistas = vigentes.reduce((t, e) => t + montoEsperadoEquipo(torneo, e), 0);
  const ingresosPrevistos = inscripcionesPrevistas + otrosIngresos;

  const nombreGasto = (g: GastoTorneo) =>
    `${labelCategoriaGasto(g.categoria)}${g.descripcion ? ` ${g.descripcion}` : ""} ${formatCOP(g.valor_total)}`;
  const agrupar = (lista: GastoTorneo[]): FilaDesglose[] => {
    const filas: FilaDesglose[] = [];
    for (const c of [...categorias].sort((a, b) => a.orden - b.orden)) {
      const deCat = lista.filter((x) => categoriaDeGasto(x, categorias)?.id === c.id);
      if (deCat.length > 0) filas.push({ titulo: `Premiación ${c.nombre}`, total: sum(deCat), detalle: "" });
    }
    const generales = lista.filter((x) => !categoriaDeGasto(x, categorias));
    if (generales.length > 0)
      filas.push({ titulo: "Generales", total: sum(generales), detalle: generales.map(nombreGasto).join(", ") });
    return filas;
  };

  // Punto de equilibrio: por categoría con inscritos, más los gastos generales.
  const grupos =
    categorias.length > 0
      ? [...categorias]
          .sort((a, b) => a.orden - b.orden)
          .map((c) => ({ id: c.id as string | null, nombre: c.nombre, valor: c.valor_inscripcion ?? torneo.valor_inscripcion }))
      : [{ id: null as string | null, nombre: torneo.nombre, valor: torneo.valor_inscripcion }];
  const conInscritos = grupos.filter((g) => vigentes.some((e) => (g.id ? e.categoria_id === g.id : true)));
  const filas: FilaEquilibrio[] = conInscritos.map((g) => {
    const inscritos = vigentes.filter((e) => (g.id ? e.categoria_id === g.id : true)).length;
    const gastoPrem = sum(visibles.filter((x) => (g.id ? categoriaDeGasto(x, categorias)?.id === g.id : false)));
    const premio = premios.filter((p) => (g.id ? p.categoria_id === g.id : true)).reduce((t, p) => t + enDinero(p), 0);
    const costo = g.id ? Math.max(gastoPrem, premio) : premio;
    const equiposNec = g.valor > 0 ? Math.ceil(costo / g.valor) : costo === 0 ? 0 : null;
    return {
      categoriaId: g.id,
      nombre: g.nombre,
      inscritos,
      valorInscripcion: g.valor,
      costo,
      equipos: equiposNec,
      faltan: equiposNec === null ? null : Math.max(0, equiposNec - inscritos),
    };
  });
  const valores = filas.filter((f) => f.valorInscripcion > 0).map((f) => f.valorInscripcion);
  const valorPromedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

  const generalesGastos = visibles.filter((x) => categorias.length === 0 || !categoriaDeGasto(x, categorias));
  const premiosGenerales =
    categorias.length > 0
      ? premios.filter((p) => !p.categoria_id || !categorias.some((c) => c.id === p.categoria_id)).reduce((t, p) => t + enDinero(p), 0)
      : 0;
  const premiacionGeneralRegistrada = sum(generalesGastos.filter((x) => CATEGORIAS_PREMIACION.includes(x.categoria)));
  const costoGenerales = sum(generalesGastos) + Math.max(0, premiosGenerales - premiacionGeneralRegistrada);
  const costoTotal = filas.reduce((t, f) => t + f.costo, 0) + costoGenerales;
  const aCubrir = Math.max(0, costoTotal - otrosIngresos);

  return {
    inscritos: vigentes.length,
    equiposQuePagaron: vigentes.filter((e) => e.monto_pagado > 0).length,
    ingresado: abonos + otrosRecibidos,
    abonos,
    otrosRecibidos,
    gastado,
    gastosPagadosN: visibles.filter((g) => g.pagado).length,
    gastosPorPagarN: visibles.filter((g) => !g.pagado).length,
    utilidadReal: abonos + otrosRecibidos - gastado,
    inscripcionesPrevistas,
    otrosIngresos,
    ingresosPrevistos,
    gastosPrevistos,
    utilidadPrevista: ingresosPrevistos - gastosPrevistos,
    porCobrar: vigentes.reduce((t, e) => t + saldoEquipo(torneo, e), 0),
    metaCupoLleno: torneo.cupo_equipos * torneo.valor_inscripcion,
    gastosIncluidos: agrupar(visibles),
    gastosExcluidos: agrupar(ocultos),
    equilibrio: {
      filas,
      generales: {
        costo: costoGenerales,
        equipos: valorPromedio > 0 ? Math.ceil(costoGenerales / valorPromedio) : costoGenerales === 0 ? 0 : null,
      },
      sinInscritos: grupos.filter((g) => !conInscritos.includes(g)).map((g) => g.nombre),
      valorPromedio,
      equiposTotal: valorPromedio > 0 ? Math.ceil(aCubrir / valorPromedio) : aCubrir === 0 ? 0 : null,
      costoTotal,
    },
  };
}

// ---------------------------------------------------------------------------
// Cobertura de la premiación y punto de equilibrio por categoría
// ---------------------------------------------------------------------------
/** Números clave de una categoría (o del torneo sin categorías). */
export interface CoberturaCategoria {
  categoriaId: string | null;
  nombre: string;
  cupo: number;
  /** Pendientes + confirmados (los que ocupan cupo). */
  inscritos: number;
  confirmados: number;
  pendientes: number;
  /** Cupos que faltan por llenar. */
  faltanParaCupo: number;
  /** Valor de inscripción de la categoría (o el del torneo). */
  valorInscripcion: number;
  /** Lo que deben pagar los inscritos (pagado o no). */
  ingresoInscritos: number;
  /** Lo que ya pagaron. */
  recaudado: number;
  /** Con el cupo lleno: inscritos + cupos libres × valor. */
  ingresoCupoLleno: number;
  /** Premios en dinero de esta categoría. */
  premios: number;
  /** ingresoInscritos − premios (negativo = no alcanza). */
  diferencia: number;
  /** Equipos que hacen falta para cubrir el premio (0 = ya cubre). `null` si la inscripción es gratis. */
  equiposParaCubrir: number | null;
  /** ¿Alcanza a cubrir el premio si se llena el cupo? */
  cubreConCupoLleno: boolean;
}

export interface CoberturaTorneo {
  categorias: CoberturaCategoria[];
  total: {
    cupo: number;
    inscritos: number;
    confirmados: number;
    pendientes: number;
    faltanParaCupo: number;
    ingresoInscritos: number;
    /** Arbitraje, patrocinios y otros ingresos registrados. */
    otrosIngresos: number;
    recaudado: number;
    ingresoCupoLleno: number;
    /** Premios en dinero de todo el torneo (por categoría + generales). */
    premios: number;
    /** Premios generales (sin categoría). */
    premiosGenerales: number;
    /**
     * Costo total: gastos presupuestados + la parte de los premios en dinero
     * que no está registrada como gasto de premiación (para no contarla dos veces).
     */
    costoTotal: number;
    gastos: number;
    /** ingresoInscritos + otrosIngresos − costoTotal (negativo = pierde). */
    diferencia: number;
    /** Equipos que faltan para el punto de equilibrio (aprox., con el valor promedio). `null` si no se puede calcular. */
    equiposParaEquilibrio: number | null;
    cubreConCupoLleno: boolean;
  };
}

/**
 * ¿Los inscritos alcanzan a cubrir la premiación? Por categoría (sus premios
 * contra lo que pagan sus equipos) y en total (premios + gastos del torneo).
 * Todo sale de los datos: cupo y valor de cada categoría, premios y gastos.
 */
export function calcularCoberturaTorneo(
  torneo: Torneo,
  categorias: CategoriaTorneo[],
  equipos: EquipoTorneo[],
  gastos: GastoTorneo[],
  premios: PremioTorneo[],
  /** Otros ingresos (arbitraje, patrocinios…): ayudan a cubrir el total. */
  otros: IngresoTorneo[] = [],
): CoberturaTorneo {
  const vigentes = equiposVigentes(equipos);
  const enDinero = (p: PremioTorneo) => (p.tipo === "valor" ? (p.valor ?? 0) : 0);
  // Sin categorías, el torneo entero es una sola.
  const grupos =
    categorias.length > 0
      ? [...categorias]
          .sort((a, b) => a.orden - b.orden)
          .map((c) => ({ id: c.id as string | null, nombre: c.nombre, cupo: c.cupo_equipos, valor: c.valor_inscripcion ?? torneo.valor_inscripcion }))
      : [{ id: null, nombre: torneo.nombre, cupo: torneo.cupo_equipos, valor: torneo.valor_inscripcion }];

  const filas: CoberturaCategoria[] = grupos.map((g) => {
    const deCat = vigentes.filter((e) => (g.id ? e.categoria_id === g.id : true));
    const inscritos = deCat.length;
    // Lo que debe cada equipo: su monto propio, o el valor de su categoría.
    const ingresoInscritos = deCat.reduce((s, e) => s + (e.monto_inscripcion ?? g.valor), 0);
    const faltanParaCupo = Math.max(0, g.cupo - inscritos);
    const premiosCat = premios
      .filter((p) => (g.id ? p.categoria_id === g.id : true))
      .reduce((s, p) => s + enDinero(p), 0);
    const diferencia = ingresoInscritos - premiosCat;
    const ingresoCupoLleno = ingresoInscritos + faltanParaCupo * g.valor;
    return {
      categoriaId: g.id,
      nombre: g.nombre,
      cupo: g.cupo,
      inscritos,
      confirmados: deCat.filter((e) => e.estado === "confirmado").length,
      pendientes: deCat.filter((e) => e.estado === "pendiente").length,
      faltanParaCupo,
      valorInscripcion: g.valor,
      ingresoInscritos,
      recaudado: deCat.reduce((s, e) => s + e.monto_pagado, 0),
      ingresoCupoLleno,
      premios: premiosCat,
      diferencia,
      equiposParaCubrir: diferencia >= 0 ? 0 : g.valor > 0 ? Math.ceil(-diferencia / g.valor) : null,
      cubreConCupoLleno: ingresoCupoLleno >= premiosCat,
    };
  });

  const suma = (k: keyof CoberturaCategoria) => filas.reduce((s, f) => s + (f[k] as number), 0);
  // Con categorías, los premios sin categoría son generales del torneo.
  const premiosGenerales =
    categorias.length > 0
      ? premios.filter((p) => !p.categoria_id || !categorias.some((c) => c.id === p.categoria_id)).reduce((s, p) => s + enDinero(p), 0)
      : 0;
  const premiosTotal = suma("premios") + premiosGenerales;
  const gastosTotal = gastos.reduce((s, g) => s + g.valor_total, 0);
  const gastosPremiacion = gastos
    .filter((g) => CATEGORIAS_PREMIACION.includes(g.categoria))
    .reduce((s, g) => s + g.valor_total, 0);
  const costoTotal = gastosTotal + Math.max(0, premiosTotal - gastosPremiacion);
  const ingresoInscritos = suma("ingresoInscritos");
  const otrosIngresos = otros.reduce((s, i) => s + i.valor, 0);
  const ingresoCupoLleno = suma("ingresoCupoLleno") + otrosIngresos;
  const diferencia = ingresoInscritos + otrosIngresos - costoTotal;
  // Valor promedio de los cupos que quedan (o de todas las categorías si no queda ninguno).
  const libres = filas.filter((f) => f.faltanParaCupo > 0 && f.valorInscripcion > 0);
  const base = libres.length > 0 ? libres : filas.filter((f) => f.valorInscripcion > 0);
  const valorPromedio = base.length > 0 ? base.reduce((s, f) => s + f.valorInscripcion, 0) / base.length : 0;

  return {
    categorias: filas,
    total: {
      cupo: suma("cupo"),
      inscritos: suma("inscritos"),
      confirmados: suma("confirmados"),
      pendientes: suma("pendientes"),
      faltanParaCupo: suma("faltanParaCupo"),
      ingresoInscritos,
      otrosIngresos,
      recaudado: suma("recaudado"),
      ingresoCupoLleno,
      premios: premiosTotal,
      premiosGenerales,
      costoTotal,
      gastos: gastosTotal,
      diferencia,
      equiposParaEquilibrio: diferencia >= 0 ? 0 : valorPromedio > 0 ? Math.ceil(-diferencia / valorPromedio) : null,
      cubreConCupoLleno: ingresoCupoLleno >= costoTotal,
    },
  };
}

/**
 * Alertas de viabilidad, en lenguaje del organizador. Puro y determinista: la
 * hora entra por parámetro para poder probarlo sin depender del reloj.
 */
export function validarViabilidadTorneo(
  torneo: Torneo,
  equipos: EquipoTorneo[],
  gastos: GastoTorneo[],
  premios: PremioTorneo[] = [],
  ahora: number = Date.now(),
  categorias: CategoriaTorneo[] = [],
  otros: IngresoTorneo[] = [],
): AlertaTorneo[] {
  const dash = calcularDashboardTorneo(torneo, equipos, gastos, categorias, premios, otros);
  const cobertura = calcularCoberturaTorneo(torneo, categorias, equipos, gastos, premios, otros);
  const alertas: AlertaTorneo[] = [];
  const enJuego = torneo.estado !== "cancelado" && torneo.estado !== "finalizado";

  // Cierre de inscripciones vencido.
  if (
    torneo.cierre_inscripciones &&
    new Date(torneo.cierre_inscripciones).getTime() < ahora &&
    torneo.estado === "inscripciones"
  ) {
    alertas.push({
      nivel: "alerta",
      mensaje:
        "La fecha de cierre de inscripciones ya pasó. Cierra el torneo o amplía el plazo.",
    });
  }

  // Mínimo de equipos.
  if (torneo.minimo_equipos && dash.equiposRegistrados < torneo.minimo_equipos && enJuego) {
    const faltan = torneo.minimo_equipos - dash.equiposRegistrados;
    alertas.push({
      nivel: "alerta",
      mensaje: `No se alcanza el mínimo de equipos: faltan ${faltan} para llegar a ${torneo.minimo_equipos}.`,
    });
  }

  // Rentabilidad proyectada (cupo lleno vs. gastos presupuestados).
  if (dash.utilidadProyectada < 0) {
    alertas.push({
      nivel: "error",
      mensaje: `El torneo genera una pérdida proyectada de ${formatCOP(Math.abs(dash.utilidadProyectada))} aun con el cupo lleno.`,
    });
  }

  // Rentabilidad de hoy.
  if (dash.gastosPagados > dash.ingresosRecaudados && dash.gastosPagados > 0) {
    alertas.push({
      nivel: "alerta",
      mensaje: `Los gastos pagados superan lo recaudado en ${formatCOP(dash.gastosPagados - dash.ingresosRecaudados)}.`,
    });
  }

  // Punto de equilibrio: lo que deben los inscritos contra premios + gastos.
  const t = cobertura.total;
  if (enJuego && t.costoTotal > 0) {
    if (t.diferencia < 0) {
      const equiposTxt =
        t.equiposParaEquilibrio !== null
          ? ` (≈ ${t.equiposParaEquilibrio} equipo${t.equiposParaEquilibrio === 1 ? "" : "s"} más)`
          : "";
      alertas.push({
        nivel: t.cubreConCupoLleno ? "info" : "alerta",
        mensaje:
          `Con los ${t.inscritos} inscritos${t.otrosIngresos > 0 ? ` y ${formatCOP(t.otrosIngresos)} de otros ingresos` : ""} faltan ${formatCOP(-t.diferencia)} para cubrir premios y gastos${equiposTxt}.` +
          (t.cubreConCupoLleno ? "" : " Ni con el cupo lleno alcanza: revisa premios, gastos o valor de inscripción."),
      });
    } else {
      alertas.push({
        nivel: "info",
        mensaje: `Con los ${t.inscritos} inscritos${t.otrosIngresos > 0 ? ` y ${formatCOP(t.otrosIngresos)} de otros ingresos` : ""} ya cubres premios y gastos: quedan ${formatCOP(t.diferencia)} de margen.`,
      });
    }
  }

  // Escasez de cupos (útil para empujar la difusión).
  if (enJuego && dash.cuposDisponibles > 0 && dash.cuposDisponibles <= 3) {
    alertas.push({
      nivel: "info",
      mensaje: `Quedan ${dash.cuposDisponibles} cupo${dash.cuposDisponibles === 1 ? "" : "s"} disponible${dash.cuposDisponibles === 1 ? "" : "s"}.`,
    });
  }

  // Configuración incompleta.
  if (premios.length === 0) {
    alertas.push({
      nivel: "info",
      mensaje:
        "No has definido la premiación. Es lo primero que pregunta un equipo antes de inscribirse.",
    });
  } else {
    // Premios en dinero sin gasto que los respalde: la utilidad miente.
    const enDinero = valorPremiacion(premios);
    const presupuestado = gastos
      .filter((g) => CATEGORIAS_PREMIACION.includes(g.categoria))
      .reduce((suma, g) => suma + g.valor_total, 0);
    if (enDinero > presupuestado) {
      alertas.push({
        nivel: "alerta",
        mensaje: `La premiación en dinero suma ${formatCOP(enDinero)} y solo tienes ${formatCOP(presupuestado)} registrado como gasto: la utilidad proyectada está optimista.`,
      });
    }
  }
  if (!gastos.some((g) => CATEGORIAS_ESCENARIO.includes(g.categoria))) {
    alertas.push({
      nivel: "info",
      mensaje:
        "No has registrado el costo del escenario. Sin él, la utilidad proyectada es optimista.",
    });
  }

  return alertas;
}

/**
 * Lo recibido por cada medio de pago (cuadre de caja). Solo cuenta los abonos
 * de equipos vigentes, igual que `ingresosRecaudados` del dashboard.
 */
export function recaudoPorMetodo(
  pagos: Pick<PagoEquipoTorneo, "equipo_id" | "monto" | "metodo">[],
  equipos: EquipoTorneo[],
): { efectivo: number; transferencia: number } {
  const vigentes = new Set(equiposVigentes(equipos).map((e) => e.id));
  const out = { efectivo: 0, transferencia: 0 };
  for (const p of pagos) {
    if (vigentes.has(p.equipo_id)) out[p.metodo] += p.monto;
  }
  return out;
}
