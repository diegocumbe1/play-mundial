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
  /** Nota opcional del admin sobre el pago del premio (ej. "corresponde a otra persona"). */
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
// Plataforma multi-producto — qué verticales tiene habilitadas cada organizador
// ===========================================================================

/** Verticales de negocio de la plataforma. */
export type ProductoPlataforma = "rifas" | "torneos";

/** Producto habilitado (o no) para un organizador. Lo administra el superadmin. */
export interface TenantProducto {
  id: string;
  tenant_id: string;
  producto: ProductoPlataforma;
  habilitado: boolean;
  created_at: string;
  updated_at: string;
}

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
/**
 * En el sorteo propio, qué balota se lleva el premio mayor: la última que sale
 * (lo habitual, deja la emoción para el final) o la primera.
 */
export type OrdenSorteo = "ultimo_mayor" | "primero_mayor";
/** Estado de un cobro en el ledger. */
export type EstadoCobro = "pendiente" | "pagado" | "anulado";

/** Organizador (dueño de sus rifas). */
/**
 * Ciclo de vida de una cuenta de organizador. Las que se registran solas nacen
 * `pendiente`: pueden preparar rifas en borrador, pero no publicarlas hasta que
 * el superadmin apruebe.
 */
export type EstadoTenant = "pendiente" | "activo" | "rechazado" | "archivado";

export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  estado: EstadoTenant;
  /** WhatsApp del organizador: su identidad real y única en la plataforma. */
  telefono: string | null;
  /** Cuándo lo aprobó el superadmin. */
  aprobado_at: string | null;
  /** Nota interna del superadmin (motivo del rechazo, contexto). */
  nota_admin: string | null;
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
  /** Campo legado: antes guardaba el número/cuenta Nequi. */
  nequi_llave: string | null;
  /** Entidad/canal de la cuenta: Nequi, Daviplata, banco, otro. */
  cuenta_tipo: string | null;
  /** Número de cuenta, celular, producto o identificador de esa entidad. */
  cuenta_numero: string | null;
  /** Llave Bre-B / alias (otra forma de transferencia). */
  llave: string | null;
  titular: string | null;
  qr_url: string | null;
  whatsapp: string | null;
  mensaje_qr: string | null;
  updated_at: string;
}

/** Datos de cobro de la plataforma para que los organizadores paguen planes. */
export interface PlataformaPagoConfig {
  /** Campo legado: antes guardaba el número/cuenta Nequi. */
  nequi_llave: string | null;
  /** Entidad/canal de la cuenta: Nequi, Daviplata, banco, otro. */
  cuenta_tipo: string | null;
  /** Número de cuenta, celular, producto o identificador de esa entidad. */
  cuenta_numero: string | null;
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
  /**
   * Cómo se cobra una rifa: `boleta` cobra el valor de un puesto de esa misma
   * rifa; `escalones` usa los precios fijos por tamaño (esquema anterior).
   */
  cobro_rifa_modo: "boleta" | "escalones";
  /** Piso del cobro por rifa (0 = sin mínimo). */
  cobro_rifa_min: number;
  /** Techo del cobro por rifa (0 = sin tope). */
  cobro_rifa_max: number;
  precio_rifa_100: number;
  precio_rifa_500: number;
  precio_rifa_1000: number;
  precio_suscripcion_mes: number;
  free_rifas_por_mes: number;
  free_rifas_total: number;
  free_max_numeros: number;
  /** Torneos: escalones por cupo de equipos (hasta 8 / 16 / 32 / más). */
  precio_torneo_8: number;
  precio_torneo_16: number;
  precio_torneo_32: number;
  precio_torneo_mas: number;
  free_torneos_por_mes: number;
  free_torneos_total: number;
  free_max_equipos: number;
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
  /**
   * Primer número de la rifa: 0 (00–29) o 1 (01–30). Las de lotería siempre
   * arrancan en 0 porque el número cruza con las cifras del resultado.
   */
  numero_inicial: 0 | 1;
  formato_cifras: 2 | 3;
  solo_pagadas_juegan: boolean;
  slug_publico: string;
  /** Preset de tema visual (ver src/lib/temas-rifa). */
  tema: string;
  /** Motivo decorativo (floral, hojas, geométrico, confeti, ninguna). */
  decoracion: string;
  /** Foto del premio: portada de la publicación. */
  imagen_url: string | null;
  /** Imagen de fondo de la publicación (se oscurece para que el texto se lea). */
  imagen_fondo_url: string | null;
  /** Sorteo propio, ronda 1: cuántas balotas salen como finalistas. */
  sorteo_bolas: number;
  /**
   * Sorteo propio, ronda 2: cuántas de las finalistas se sortean como
   * ganadoras. Si es >= `sorteo_bolas` no hay segunda ronda y cada balota que
   * sale ya lleva premio.
   */
  sorteo_ganadores: number;
  /** Mostrar la simulación del sorteo en el enlace público. */
  mostrar_simulacion: boolean;
  /** Sorteo propio: si el premio mayor es la última balota o la primera. */
  sorteo_orden: OrdenSorteo;
  /** Finalistas en el orden real en que salieron (ronda 1). */
  sorteo_secuencia: number[] | null;
  /** Ganadoras en el orden real en que salieron (ronda 2). */
  sorteo_finales: number[] | null;
  /**
   * Cuántas balotas ya cantó el organizador. El público solo puede ver esas:
   * es lo que permite el live sin filtrar el resultado que falta.
   */
  sorteo_reveladas: number;
  /** Cuándo se corrió el sorteo propio. */
  sorteo_at: string | null;
  loteria: string | null;
  /** URL oficial de la lotería (resultados). */
  loteria_url: string | null;
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
  responsable_venta: string | null;
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

/**
 * Una balota del sorteo propio, tal como se muestra (backoffice y público):
 * el orden real de extracción y qué premio se llevó.
 */
export interface BolaSorteo {
  /** Posición de extracción dentro de su ronda: 1 = la primera que salió. */
  orden: number;
  /** Ronda en la que salió: filtro de finalistas o sorteo del ganador. */
  fase: "finalista" | "ganadora";
  numero: number;
  /** Premio que se llevó, o `null` si salió como suplente (sin premio). */
  premio: string | null;
  /** `true` en la balota del premio mayor. */
  mayor: boolean;
  /** Dueño del número (enmascarado en público); `null` si no estaba vendido. */
  nombre: string | null;
}

/** Métricas financieras del dashboard de una rifa. */
export interface DashboardRifa {
  total: number;
  vendidas: number;
  pagadas: number;
  pendientes: number;
  libres: number;
  recaudado: number;
  /** Dinero de boletas apartadas sin pagar (lo que falta por cobrar). */
  porCobrar: number;
  esperadoTotal: number;
  pctCumplimiento: number;
  pctVendido: number;
}

/** Un cobro del ledger (prepago manual). */
export interface Cobro {
  id: string;
  tenant_id: string;
  rifa_id: string | null;
  /** Vertical a la que corresponde el cobro. Los cobros viejos son de rifas. */
  producto: ProductoPlataforma;
  /** Torneo asociado cuando `producto = "torneos"`. */
  torneo_id: string | null;
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
  numero_inicial?: 0 | 1;
  formato_cifras: 2 | 3;
  solo_pagadas_juegan: boolean;
  tema?: string;
  decoracion?: string;
  imagen_url?: string | null;
  imagen_fondo_url?: string | null;
  sorteo_bolas?: number;
  sorteo_ganadores?: number;
  sorteo_orden?: OrdenSorteo;
  mostrar_simulacion?: boolean;
  loteria?: string | null;
  loteria_url?: string | null;
  fecha_loteria?: string | null;
  modo_cifras?: ModoCifras | null;
  fecha_sorteo?: string | null;
}

// ===========================================================================
// Vertical "Torneos deportivos" — campeonatos multi-deporte por organizador.
// Ver docs/plan-torneos.md. Reutiliza tenancy, planes y ledger de cobros.
// ===========================================================================

/** Ciclo de vida de un torneo. */
export type EstadoTorneo =
  | "borrador"
  | "inscripciones"
  | "programado"
  | "en_curso"
  | "finalizado"
  | "cancelado";

/** Cómo se define el campeón. */
export type FormatoTorneo =
  | "todos_contra_todos"
  | "eliminacion_directa"
  | "grupos_eliminacion"
  | "personalizado";

/** Estado de la inscripción de un equipo. */
export type EstadoEquipoTorneo =
  | "pendiente"
  | "confirmado"
  | "rechazado"
  | "retirado";

/** Un campeonato que organiza un tenant. */
export interface Torneo {
  id: string;
  tenant_id: string;
  nombre: string;
  slug_publico: string;
  deporte: string;
  modalidad: string | null;
  categoria: string | null;
  rama: string | null;
  formato: FormatoTorneo;
  estado: EstadoTorneo;
  ciudad: string | null;
  escenario: string | null;
  direccion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  cierre_inscripciones: string | null;
  cupo_equipos: number;
  minimo_equipos: number | null;
  jugadores_por_equipo: number | null;
  duracion_partido_minutos: number | null;
  cantidad_canchas: number;
  valor_inscripcion: number;
  reglamento: string | null;
  /** Nota extra de premiación. Los premios por puesto viven en `premios_torneo`. */
  premiacion_descripcion: string | null;
  tema: string;
  cobro_tipo: PlanTenant | null;
  activado_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Un equipo inscrito. Contiene datos personales: nunca sale tal cual al público. */
export interface EquipoTorneo {
  id: string;
  tenant_id: string;
  torneo_id: string;
  nombre: string;
  escudo_url: string | null;
  responsable_nombre: string | null;
  responsable_telefono: string | null;
  responsable_correo: string | null;
  cantidad_jugadores: number | null;
  estado: EstadoEquipoTorneo;
  /** Lo que debe pagar este equipo (por defecto, el valor de inscripción). */
  monto_inscripcion: number | null;
  monto_pagado: number;
  metodo_pago: MetodoPago | null;
  comprobante_url: string | null;
  consentimiento_datos: boolean;
  confirmado_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Un premio del torneo, atado a un puesto (1° campeón, 2° subcampeón…). Un
 * torneo premia tantos puestos como quiera: solo el primero, los dos primeros,
 * los cuatro primeros…
 */
export interface PremioTorneo {
  id: string;
  tenant_id: string;
  torneo_id: string;
  puesto: number;
  tipo: "valor" | "producto";
  descripcion: string;
  /** Solo si `tipo = "valor"`. Alimenta el costo real de la premiación. */
  valor: number | null;
  created_at: string;
  updated_at: string;
}

/** Un premio tal como lo arma el formulario del backoffice. */
export interface PremioTorneoInput {
  puesto: number;
  tipo: "valor" | "producto";
  descripcion: string;
  valor?: number | null;
}

/** Premio en vistas públicas: el puesto y qué se lleva, sin datos internos. */
export type PremioTorneoPublico = Pick<
  PremioTorneo,
  "puesto" | "tipo" | "descripcion" | "valor"
>;

/** Un gasto del torneo (cancha, arbitraje, premiación…). Solo uso interno. */
export interface GastoTorneo {
  id: string;
  tenant_id: string;
  torneo_id: string;
  categoria: string;
  descripcion: string | null;
  cantidad: number | null;
  valor_unitario: number | null;
  valor_total: number;
  pagado: boolean;
  proveedor: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Corte PÚBLICO del torneo para `/t/[slug]`. Nunca incluye datos internos
 * (gastos, utilidad, contactos de equipos ni estado de pago).
 */
export type TorneoPublico = Pick<
  Torneo,
  | "nombre"
  | "slug_publico"
  | "deporte"
  | "modalidad"
  | "categoria"
  | "rama"
  | "formato"
  | "estado"
  | "ciudad"
  | "escenario"
  | "direccion"
  | "fecha_inicio"
  | "fecha_fin"
  | "cierre_inscripciones"
  | "cupo_equipos"
  | "jugadores_por_equipo"
  | "valor_inscripcion"
  | "reglamento"
  | "premiacion_descripcion"
  | "tema"
>;

/**
 * Equipo en vistas PÚBLICAS: solo identidad deportiva. Jamás responsable,
 * teléfono, correo, comprobante, método de pago ni montos.
 */
export interface EquipoTorneoPublico {
  id: string;
  nombre: string;
  escudo_url: string | null;
  /** Único estado que se revela afuera: si ya tiene el cupo asegurado. */
  confirmado: boolean;
}

/** Métricas del dashboard de un torneo (ingresos, gastos y rentabilidad). */
export interface DashboardTorneo {
  /** Cupo configurado. */
  cupoTotal: number;
  equiposRegistrados: number;
  equiposConfirmados: number;
  equiposPendientes: number;
  cuposDisponibles: number;
  pctOcupacion: number;
  /** Cupo completo × valor de inscripción. */
  ingresosProyectados: number;
  /** Dinero efectivamente recibido. */
  ingresosRecaudados: number;
  /** Lo que falta cobrar a los equipos ya registrados. */
  porCobrar: number;
  pctRecaudado: number;
  gastosProyectados: number;
  gastosPagados: number;
  gastosPendientes: number;
  /** Con el cupo lleno y todos los gastos ejecutados. */
  utilidadProyectada: number;
  /** Con lo recaudado y lo ya pagado, hoy. */
  utilidadActual: number;
  /** Equipos necesarios para cubrir los gastos. `null` si no es calculable. */
  puntoEquilibrioEquipos: number | null;
  /** Cuánto aporta a la utilidad cada equipo confirmado. */
  utilidadPorEquipoConfirmado: number;
}

/** Una alerta de viabilidad del torneo (se pinta en el panel). */
export interface AlertaTorneo {
  /** `error` bloquea el negocio; `alerta` avisa; `info` sugiere. */
  nivel: "error" | "alerta" | "info";
  mensaje: string;
}

/** Datos para crear/editar un torneo desde el backoffice. */
export interface TorneoInput {
  nombre: string;
  deporte: string;
  modalidad?: string | null;
  categoria?: string | null;
  rama?: string | null;
  formato: FormatoTorneo;
  ciudad?: string | null;
  escenario?: string | null;
  direccion?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  cierre_inscripciones?: string | null;
  cupo_equipos: number;
  minimo_equipos?: number | null;
  jugadores_por_equipo?: number | null;
  duracion_partido_minutos?: number | null;
  cantidad_canchas: number;
  valor_inscripcion: number;
  reglamento?: string | null;
  /** Nota extra; los premios por puesto se guardan aparte. */
  premiacion_descripcion?: string | null;
  tema?: string;
  /** Solo superadmin: delegar el torneo a otro organizador. */
  tenant_id?: string | null;
}
