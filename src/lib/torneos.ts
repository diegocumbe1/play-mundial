import type {
  AlertaTorneo,
  DashboardTorneo,
  EquipoTorneo,
  EquipoTorneoPublico,
  EstadoEquipoTorneo,
  EstadoTorneo,
  FormatoTorneo,
  GastoTorneo,
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

  const utilidadProyectada = ingresos.proyectados - gastosCalc.proyectados;
  const utilidadActual = ingresos.recaudados - gastosCalc.pagados;

  return {
    cupoTotal,
    equiposRegistrados,
    equiposConfirmados,
    equiposPendientes,
    cuposDisponibles,
    pctOcupacion,
    ingresosProyectados: ingresos.proyectados,
    ingresosRecaudados: ingresos.recaudados,
    porCobrar: ingresos.porCobrar,
    pctRecaudado: ingresos.pctRecaudado,
    gastosProyectados: gastosCalc.proyectados,
    gastosPagados: gastosCalc.pagados,
    gastosPendientes: gastosCalc.pendientes,
    utilidadProyectada,
    utilidadActual,
    puntoEquilibrioEquipos: calcularPuntoEquilibrio(
      gastosCalc.proyectados,
      torneo.valor_inscripcion,
    ),
    utilidadPorEquipoConfirmado:
      equiposConfirmados > 0 ? Math.round(utilidadActual / equiposConfirmados) : 0,
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
): AlertaTorneo[] {
  const dash = calcularDashboardTorneo(torneo, equipos, gastos);
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

  // Punto de equilibrio.
  if (dash.puntoEquilibrioEquipos !== null && enJuego) {
    const faltan = dash.puntoEquilibrioEquipos - dash.equiposConfirmados;
    if (faltan > 0) {
      alertas.push({
        nivel: "info",
        mensaje: `Necesitas ${faltan} equipo${faltan === 1 ? "" : "s"} adicional${faltan === 1 ? "" : "es"} para llegar al punto de equilibrio.`,
      });
    } else if (dash.gastosProyectados > 0) {
      alertas.push({
        nivel: "info",
        mensaje: "Ya superaste el punto de equilibrio: de aquí en adelante es utilidad.",
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
