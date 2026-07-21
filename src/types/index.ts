/**
 * Tipos del dominio de la Polla Futbolera.
 *
 * Reflejan el esquema definido en `supabase/migrations`. Cuando conectemos el
 * CLI de Supabase podremos autogenerar tipos con:
 *   supabase gen types typescript --linked > src/types/database.ts
 * y derivar estos de ahí. Por ahora se mantienen a mano.
 */

/** Estado del ciclo de vida de un partido. */
export type EstadoPartido =
  | "programado"
  | "en_juego"
  | "finalizado"
  | "cancelado";

/** Origen del registro de un partido. */
export type FuentePartido = "manual" | "api";

/** Medio por el que el participante pagó su apuesta. */
export type MetodoPago = "efectivo" | "transferencia";

/** Un partido sobre el que se hacen pronósticos. */
export interface Partido {
  id: string;
  /** Id en el proveedor externo (API). `null` si se creó manualmente. */
  external_id: string | null;
  fuente: FuentePartido;
  liga: string | null;
  temporada: string | null;
  equipo_local: string;
  equipo_visitante: string;
  equipo_local_logo: string | null;
  equipo_visitante_logo: string | null;
  /** Fecha/hora del partido en formato ISO 8601. */
  fecha: string;
  /** Goles reales, disponibles solo cuando el partido finaliza. */
  goles_local: number | null;
  goles_visitante: number | null;
  /** Marcador válido para la polla: 90' + reposición, sin prórroga ni penales. */
  goles_reglamentario_local: number | null;
  goles_reglamentario_visitante: number | null;
  estado: EstadoPartido;
  /** Si el partido en juego está pausado (medio tiempo / descanso). */
  en_pausa: boolean;
  /** Si el marcador reglamentario fue confirmado manualmente por el admin. */
  resultado_manual: boolean;
  /** Si el premio del partido ya se le pagó al/los ganador(es). */
  premio_pagado: boolean;
  /**
   * Detalle informativo del resultado más allá del 90' (prórroga, penales y
   * goleadores), reconstruido desde flashscore. NO liquida la polla; solo se
   * muestra en la UI. `null` si no hay datos de flashscore para el partido.
   */
  detalle_flash: DetalleFlash | null;
  created_at: string;
  updated_at: string;
}

/** Un marcador local/visitante (prórroga o tanda de penales). */
export interface MarcadorLV {
  local: number;
  visitante: number;
}

/** Un gol con su autor y minuto tal cual lo reporta flashscore. */
export interface GoleadorFlash {
  minuto: string; // "45+2", "80", ...
  team: "home" | "away";
  jugador: string;
  /** Gol en contra (autogol). */
  en_contra: boolean;
  /** Penal convertido en juego (no de la tanda). */
  penal: boolean;
}

/** Detalle del resultado guardado en `partidos.detalle_flash`. */
export interface DetalleFlash {
  /**
   * Marcador final REAL según flashscore (reglamentario + alargue, sin tanda).
   * Es la fuente de verdad del "final oficial"; puede diferir del que trae el
   * proveedor gratuito, que a veces guarda un marcador equivocado.
   */
  final: MarcadorLV;
  /** Marcador SOLO del alargue; null si no hubo goles en alargue. */
  alargue: MarcadorLV | null;
  /** Marcador de la tanda de penales; null si no hubo tanda. */
  penales: MarcadorLV | null;
  /** Goleadores en juego (reglamentario + alargue), en orden cronológico. */
  goleadores: GoleadorFlash[];
  /** `match_id` de flashscore del que salió el detalle. */
  match_id: string;
}

/** Datos para crear un partido manualmente. */
export type NuevoPartido = Pick<
  Partido,
  "equipo_local" | "equipo_visitante" | "fecha" | "liga"
>;

/**
 * Forma de un partido proveniente de la API externa, lista para hacer upsert.
 * Se identifica por `external_id`.
 */
export type PartidoExterno = Pick<
  Partido,
  | "external_id"
  | "liga"
  | "temporada"
  | "equipo_local"
  | "equipo_visitante"
  | "equipo_local_logo"
  | "equipo_visitante_logo"
  | "fecha"
  | "goles_local"
  | "goles_visitante"
  | "goles_reglamentario_local"
  | "goles_reglamentario_visitante"
  | "estado"
  | "en_pausa"
>;

/**
 * Una apuesta a un partido concreto. El modelo es "polla por partido": cada
 * apuesta es independiente y tiene su costo. No se acumula entre partidos.
 */
export interface Apuesta {
  id: string;
  partido_id: string;
  cliente_id: string | null;
  nombre: string;
  telefono: string | null;
  goles_local: number;
  goles_visitante: number;
  /** Estado de pago de esta apuesta. */
  pagado: boolean;
  /** Medio confirmado por el admin cuando marca la apuesta como pagada. */
  metodo_pago: MetodoPago | null;
  /** Nota opcional del admin sobre el pago (ej. "lo recogió mi mamá"). */
  nota_pago: string | null;
  /**
   * La apuesta se cerró sin pago: el dinero nunca llegó. No cuenta para el
   * pozo (pagado queda en false) ni se sigue mostrando como pendiente.
   */
  no_pago: boolean;
  /** Si el premio de esta apuesta ganadora ya fue entregado. */
  premio_pagado: boolean;
  /** Nota opcional del admin sobre el pago del premio (ej. "corresponde a Edilson"). */
  nota_premio: string | null;
  created_at: string;
  updated_at: string;
}

/** Apuesta visible en pantallas publicas: sin nombre, telefono ni cliente_id. */
export type ApuestaCliente = Pick<
  Apuesta,
  | "id"
  | "partido_id"
  | "goles_local"
  | "goles_visitante"
  | "pagado"
  | "created_at"
  | "updated_at"
>;

/** Una apuesta tal como la arma el formulario (sin ids ni datos de persona). */
export interface ApuestaInput {
  partido_id: string;
  goles_local: number;
  goles_visitante: number;
}

/** Resultado económico calculado de un partido (pozo, ganadores, reparto). */
export interface ResultadoPartido {
  partido: Partido;
  /** Total de apuestas pagadas del partido. */
  apuestasPagadas: number;
  /** Pozo en COP = apuestasPagadas * costo. */
  pozo: number;
  /** Parte del pozo para la casa por porcentaje (ej. 20%). */
  casaBase: number;
  /** Bolsa de premio (pozo - casaBase, ej. 80%). */
  premioPool: number;
  /** Apuestas que acertaron el marcador exacto (solo si finalizó). */
  ganadores: Apuesta[];
  /** Premio para cada ganador (bolsa repartida en partes iguales). */
  premioPorGanador: number;
  /** Monto final que queda para la casa (base + residuo + pozo si nadie gana). */
  enCasa: number;
}

/** Resumen de resultado para un jugador anónimo, sin exponer apuestas ajenas. */
export interface ResultadoCliente {
  apuestas: ApuestaCliente[];
  resumenes: {
    partido_id: string;
    apuestasPagadas: number;
    pozo: number;
    premioPool: number;
    premioPorGanador: number;
    enCasa: number;
    ganadoresClienteIds: string[];
    marcadores: {
      goles_local: number;
      goles_visitante: number;
      cantidad: number;
      pagadas: number;
      propias: number;
      esMarcadorActual: boolean;
      premioPorPersona: number;
    }[];
  }[];
}

/**
 * Un marcador elegido por la comunidad, para pantallas públicas.
 * Solo expone conteos: nunca dinero, pagos, nombres ni datos personales.
 */
export interface MarcadorComunidad {
  goles_local: number;
  goles_visitante: number;
  /** Personas que eligieron este marcador (todas las apuestas, sin importar pago). */
  cantidad: number;
  /** Coincide con el marcador oficial/reglamentario vigente del partido. */
  esMarcadorActual: boolean;
  /** El dispositivo actual eligió este marcador (para el chip "Tu marcador"). */
  esPropio: boolean;
}

/**
 * Un partido con sus marcadores comunitarios, para la vista pública y el
 * carrusel del home. Es un "corte" seguro de {@link Partido}: no incluye
 * dinero, pagos, ni ninguna apuesta identificable.
 */
export interface PartidoComunidad {
  partido_id: string;
  equipo_local: string;
  equipo_visitante: string;
  equipo_local_logo: string | null;
  equipo_visitante_logo: string | null;
  estado: EstadoPartido;
  fecha: string;
  /** Marcador oficial vigente (reglamentario si finalizó, en vivo si está en juego). */
  marcadorOficial: { goles_local: number; goles_visitante: number } | null;
  /** Si el marcador oficial ya es el reglamentario definitivo (→ etiqueta "Reglamentario"). */
  esReglamentario: boolean;
  /**
   * Marcador final oficial cuando difiere del reglamentario (hubo prórroga o
   * penales). `null` si el partido se definió en los 90'. Informativo: no
   * cuenta para la polla. Solo datos deportivos públicos (sin dinero).
   */
  finalOficial: {
    goles_local: number;
    goles_visitante: number;
    penales: MarcadorLV | null;
  } | null;
  /** Total de personas participando en el partido. */
  totalPersonas: number;
  /** Marcadores agrupados, ordenados por popularidad. */
  marcadores: MarcadorComunidad[];
}

/** Resultado estándar devuelto por las Server Actions. */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ===========================================================================
// Vertical "Rifas" — plataforma multi-tenant. Ver docs/plan-rifas.md
// ===========================================================================

/** Rol de una membresía dentro de un tenant. */
export type RolMembership = "superadmin" | "owner";
/** Plan de cobro de un tenant / de una rifa concreta. */
export type PlanTenant = "gratis" | "pago_rifa" | "suscripcion";
/** Tipo de rifa: sorteo propio o atada a una lotería. */
export type TipoRifa = "interna" | "loteria";
/** Ciclo de vida de una rifa. */
export type EstadoRifa =
  | "borrador"
  | "activa"
  | "cerrada"
  | "sorteada"
  | "pagada"
  | "cancelada";
/** Con qué cifras de la lotería se gana. */
export type ModoCifras = "primeras_dos" | "ultimas_dos" | "ambas";
/** Estado de una boleta (número). */
export type EstadoBoleta = "libre" | "reservado" | "pagado";
/** Criterio de un premio de lotería. */
export type CriterioPremio = "primeras_2" | "ultimas_2";
/** Estado de un cobro en el ledger. */
export type EstadoCobro = "pendiente" | "pagado" | "anulado";

/** Organizador (dueño de sus rifas). */
export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  estado: "activo" | "archivado";
  plan_actual: PlanTenant;
  suscripcion_vence_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Vínculo auth.user ↔ tenant con rol. */
export interface Membership {
  id: string;
  user_id: string;
  tenant_id: string;
  rol: RolMembership;
  created_at: string;
}

/** Datos de cobro que configura cada tenant (reemplaza POLLA.banco). */
export interface TenantPagoConfig {
  tenant_id: string;
  /** Número/cuenta Nequi. */
  nequi_llave: string | null;
  /** Llave Bre-B / alias (otra forma de transferencia). */
  llave: string | null;
  titular: string | null;
  qr_url: string | null;
  whatsapp: string | null;
  mensaje_qr: string | null;
  updated_at: string;
}

/** Precios y reglas de la capa gratuita, editables por el superadmin. */
export interface PlataformaConfig {
  moneda: string;
  precio_rifa_100: number;
  precio_rifa_500: number;
  precio_suscripcion_mes: number;
  free_rifas_por_mes: number;
  free_rifas_total: number;
  free_max_numeros: number;
  updated_at: string;
}

/** Una rifa configurable. */
export interface Rifa {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoRifa;
  estado: EstadoRifa;
  precio_boleta: number;
  cantidad_numeros: number;
  formato_cifras: 2 | 3;
  solo_pagadas_juegan: boolean;
  slug_publico: string;
  /** Preset de tema visual (ver src/lib/temas-rifa). */
  tema: string;
  loteria: string | null;
  fecha_loteria: string | null;
  modo_cifras: ModoCifras | null;
  resultado_loteria: string | null;
  fecha_apertura: string | null;
  fecha_cierre: string | null;
  fecha_sorteo: string | null;
  cobro_tipo: PlanTenant | null;
  activada_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Un premio de la rifa (por valor o producto). */
export interface Premio {
  id: string;
  rifa_id: string;
  tipo: "valor" | "producto";
  descripcion: string;
  valor: number | null;
  cantidad_ganadores: number;
  criterio: CriterioPremio | null;
  orden: number;
  created_at: string;
}

/** Una boleta (número) — corazón del módulo financiero. */
export interface Boleta {
  id: string;
  rifa_id: string;
  tenant_id: string;
  numero: number;
  estado: EstadoBoleta;
  comprador_nombre: string | null;
  comprador_telefono: string | null;
  cliente_id: string | null;
  metodo_pago: MetodoPago | null;
  nota: string | null;
  consentimiento_datos: boolean;
  pagado_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Un ganador resuelto de la rifa. */
export interface Ganador {
  id: string;
  rifa_id: string;
  premio_id: string;
  boleta_id: string | null;
  numero: number;
  mensaje_felicitacion: string | null;
  publicado: boolean;
  created_at: string;
}

/**
 * Boleta en vistas PÚBLICAS. Nunca expone comprador/teléfono NI el estado real:
 * al público un número tomado se ve solo como `ocupado` (no revela quién no pagó).
 */
export interface BoletaPublica {
  numero: number;
  ocupado: boolean;
}

/** Ganador en vistas públicas: número + nombre enmascarado, sin datos sensibles. */
export interface GanadorPublico {
  numero: number;
  nombre_enmascarado: string;
  premio: string;
  mensaje_felicitacion: string | null;
}

/** Métricas financieras del dashboard de una rifa. */
export interface DashboardRifa {
  total: number;
  vendidas: number;
  pagadas: number;
  pendientes: number;
  libres: number;
  recaudado: number;
  esperadoTotal: number;
  pctCumplimiento: number;
  pctVendido: number;
}

/** Un cobro del ledger (prepago manual). */
export interface Cobro {
  id: string;
  tenant_id: string;
  rifa_id: string | null;
  tipo: PlanTenant;
  monto: number;
  estado: EstadoCobro;
  periodo: string | null;
  comprobante: string | null;
  created_at: string;
  pagado_at: string | null;
}

/** Datos para crear/editar una rifa desde el backoffice. */
export interface RifaInput {
  nombre: string;
  descripcion?: string | null;
  tipo: TipoRifa;
  precio_boleta: number;
  cantidad_numeros: number;
  formato_cifras: 2 | 3;
  solo_pagadas_juegan: boolean;
  tema?: string;
  loteria?: string | null;
  fecha_loteria?: string | null;
  modo_cifras?: ModoCifras | null;
  fecha_sorteo?: string | null;
}
