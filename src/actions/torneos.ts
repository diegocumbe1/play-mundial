"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMembership } from "@/lib/auth";
import {
  crearSalaMarcador,
  enlacesMarcador,
  leerMarcador,
  marcadorDisponible,
  salaDePartido,
} from "@/lib/marcador-externo";
import { resolverActivacion } from "@/lib/planes";
import { tieneProductoHabilitado } from "@/lib/productos";
import {
  calcularDashboardTorneo,
  construirEquiposPublicos,
  equiposVigentes,
  ESTADOS_TORNEO_PUBLICOS,
  formatCOP,
  saldoEquipo,
  premiosOrdenados,
  validarViabilidadTorneo,
} from "@/lib/torneos";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  armarGrupos,
  armarLlave,
  asignarHorarios,
  calcularTabla,
  destinoEnLlave,
  validarSets,
  crucesEliminatoria,
  faseEliminatoria,
  rngConSemilla,
  siguienteFase,
  simularEnVivo,
  simularPartido,
  todosContraTodos,
} from "@/lib/torneo-fixture";
import {
  erroresPlantilla,
  jugadorInputSchema,
  normalizarDocumento,
  type JugadorInput,
} from "@/lib/torneo-jugadores";
import {
  generarReglamento,
  leerReglas,
  inscripcionCategoria,
  leerConfigPlantilla,
  PLANTILLA_VOLEIPLAYA,
  reglasSchema,
  type ConfigPlantilla,
} from "@/lib/torneo-reglas";
import type {
  ActionResult,
  AlertaTorneo,
  CategoriaTorneo,
  CategoriaTorneoPublica,
  DashboardTorneo,
  Encuentro,
  EncuentroPublico,
  EstadoEncuentro,
  FaseEncuentro,
  EquipoTorneo,
  EquipoTorneoPublico,
  GastoTorneo,
  JugadorTorneo,
  Membership,
  PagoEquipoTorneo,
  PlataformaPagoConfig,
  PremioTorneo,
  PremioTorneoPublico,
  TenantPagoConfig,
  Torneo,
  TorneoPublico,
} from "@/types";

/**
 * Server Actions de la vertical de torneos. Reglas clave (las mismas de rifas):
 * - Toda mutación valida sesión, membresía y que el tenant tenga habilitado el
 *   producto `torneos`. Ocultar la tarjeta no basta: una Server Function se
 *   puede invocar por POST directo.
 * - Todo lo PÚBLICO (ver torneo, inscribir equipo) pasa por service role y
 *   devuelve solo un corte seguro: nunca responsable, teléfono, correo,
 *   comprobante ni montos de otros equipos.
 * - `activarTorneo` aplica plan/cuota/cobro mediante el servicio común.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos/diacríticos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const sufijo = crypto.randomUUID().slice(0, 6);
  return `${base || "torneo"}-${sufijo}`;
}

type Acceso =
  | { ok: true; membership: Membership }
  | { ok: false; error: string };

/** Sesión + membresía + producto `torneos` habilitado. El superadmin pasa siempre. */
async function accesoTorneos(): Promise<Acceso> {
  const membership = await getMembership();
  if (!membership) return { ok: false, error: "Sin sesión" };
  if (membership.rol === "superadmin") return { ok: true, membership };

  const habilitado = await tieneProductoHabilitado(membership.tenant_id, "torneos");
  if (!habilitado) {
    return {
      ok: false,
      error: "Tu cuenta no tiene habilitado el módulo de torneos deportivos",
    };
  }
  return { ok: true, membership };
}

/** Trae el torneo verificando que el usuario pueda administrarlo. */
async function torneoDelUsuario(
  id: string,
  membership: Membership,
): Promise<Torneo | null> {
  const svc = createServiceRoleClient();
  const { data } = await svc.from("torneos").select("*").eq("id", id).maybeSingle();
  const torneo = (data as Torneo | null) ?? null;
  if (!torneo) return null;
  if (membership.rol !== "superadmin" && torneo.tenant_id !== membership.tenant_id) {
    return null;
  }
  return torneo;
}

function revalidarTorneo(torneo: Pick<Torneo, "id" | "slug_publico">): void {
  revalidatePath("/admin/torneos");
  revalidatePath(`/admin/torneos/${torneo.id}`);
  revalidatePath(`/t/${torneo.slug_publico}`);
}

/** La categoría, solo si pertenece al torneo indicado. */
async function categoriaDelTorneo(
  torneoId: string,
  categoriaId: string,
): Promise<CategoriaTorneo | null> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("categorias_torneo")
    .select("*")
    .eq("id", categoriaId)
    .eq("torneo_id", torneoId)
    .maybeSingle();
  return (data as CategoriaTorneo | null) ?? null;
}

// ---------------------------------------------------------------------------
// Esquemas
// ---------------------------------------------------------------------------
const fechaOpcional = z.string().trim().min(1).nullable().optional();

const torneoSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio"),
    deporte: z.string().trim().min(1, "Indica el deporte"),
    modalidad: z.string().trim().nullable().optional(),
    categoria: z.string().trim().nullable().optional(),
    rama: z.string().trim().nullable().optional(),
    formato: z.enum([
      "todos_contra_todos",
      "eliminacion_directa",
      "grupos_eliminacion",
      "personalizado",
    ]),
    ciudad: z.string().trim().nullable().optional(),
    escenario: z.string().trim().nullable().optional(),
    direccion: z.string().trim().nullable().optional(),
    fecha_inicio: fechaOpcional,
    fecha_fin: fechaOpcional,
    cierre_inscripciones: fechaOpcional,
    cupo_equipos: z
      .number()
      .int()
      .min(2, "El cupo debe ser de al menos 2 equipos")
      .max(256, "El cupo máximo es de 256 equipos"),
    minimo_equipos: z.number().int().min(2).nullable().optional(),
    jugadores_por_equipo: z.number().int().min(1).nullable().optional(),
    duracion_partido_minutos: z.number().int().min(1).nullable().optional(),
    cantidad_canchas: z.number().int().min(1).default(1),
    valor_inscripcion: z.number().int().min(0),
    reglamento: z.string().trim().nullable().optional(),
    premiacion_descripcion: z.string().trim().nullable().optional(),
    tema: z.string().trim().default("clasico"),
    /** Solo superadmin: delegar el torneo a otro organizador. */
    tenant_id: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) => d.minimo_equipos == null || d.minimo_equipos <= d.cupo_equipos,
    { message: "El mínimo de equipos no puede superar el cupo", path: ["minimo_equipos"] },
  )
  .refine(
    (d) => !d.fecha_inicio || !d.fecha_fin || d.fecha_inicio <= d.fecha_fin,
    { message: "La fecha de fin no puede ser anterior al inicio", path: ["fecha_fin"] },
  );

const equipoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del equipo es obligatorio"),
  /** Opcional al registrar desde el panel: la plantilla se puede completar después. */
  jugadores: z.array(jugadorInputSchema).optional(),
  categoria_id: z.string().uuid().nullable().optional(),
  escudo_url: z.string().trim().nullable().optional(),
  responsable_nombre: z.string().trim().nullable().optional(),
  responsable_telefono: z.string().trim().nullable().optional(),
  responsable_correo: z.string().trim().email("Correo inválido").nullable().optional(),
  cantidad_jugadores: z.number().int().min(1).nullable().optional(),
  monto_inscripcion: z.number().int().min(0).nullable().optional(),
  estado: z
    .enum(["pendiente", "confirmado", "rechazado", "retirado"])
    .default("pendiente"),
});

const premioSchema = z.object({
  puesto: z.number().int().min(1, "El puesto empieza en 1"),
  tipo: z.enum(["valor", "producto"]),
  descripcion: z.string().trim().min(1, "Describe qué se lleva ese puesto"),
  valor: z.number().int().min(0).nullable().optional(),
});

const gastoSchema = z.object({
  categoria: z.string().trim().min(1, "Elige una categoría"),
  descripcion: z.string().trim().nullable().optional(),
  cantidad: z.number().min(0).nullable().optional(),
  valor_unitario: z.number().int().min(0).nullable().optional(),
  valor_total: z.number().int().min(0, "El valor no puede ser negativo"),
  pagado: z.boolean().default(false),
  proveedor: z.string().trim().nullable().optional(),
});

const pagoEquipoSchema = z.object({
  /** Parte pagada en efectivo (0 si nada). */
  efectivo: z.number().int().min(0).default(0),
  /** Parte pagada por transferencia (0 si nada). */
  transferencia: z.number().int().min(0).default(0),
  nota: z.string().trim().max(200).nullable().optional(),
  comprobante_url: z.string().trim().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Lectura (owner)
// ---------------------------------------------------------------------------
/** Torneos del tenant del usuario (el superadmin ve todos, vía RLS). */
export async function getTorneos(): Promise<ActionResult<Torneo[]>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("torneos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as Torneo[]) ?? [] };
}

/** Métricas resumidas para pintar la lista sin abrir cada torneo. */
export interface ResumenListaTorneo {
  equipos: number;
  ingresosEsperados: number;
  utilidadProyectada: number;
}

/**
 * Torneos del tenant + sus métricas clave. Trae equipos y gastos de todos los
 * torneos en dos consultas (no una por torneo) y agrupa en memoria.
 */
export async function getTorneosConResumen(): Promise<
  ActionResult<{ torneos: Torneo[]; resumenes: Record<string, ResumenListaTorneo> }>
> {
  const res = await getTorneos();
  if (!res.success) return { success: false, error: res.error };

  const torneos = res.data;
  if (torneos.length === 0) {
    return { success: true, data: { torneos, resumenes: {} } };
  }

  const ids = torneos.map((t) => t.id);
  const svc = createServiceRoleClient();
  const [{ data: equiposData }, { data: gastosData }] = await Promise.all([
    svc.from("equipos_torneo").select("*").in("torneo_id", ids),
    svc.from("gastos_torneo").select("*").in("torneo_id", ids),
  ]);

  const equipos = (equiposData as EquipoTorneo[]) ?? [];
  const gastos = (gastosData as GastoTorneo[]) ?? [];

  const resumenes: Record<string, ResumenListaTorneo> = {};
  for (const torneo of torneos) {
    const dash = calcularDashboardTorneo(
      torneo,
      equipos.filter((e) => e.torneo_id === torneo.id),
      gastos.filter((g) => g.torneo_id === torneo.id),
    );
    resumenes[torneo.id] = {
      equipos: dash.equiposRegistrados,
      ingresosEsperados: dash.ingresosProyectados,
      utilidadProyectada: dash.utilidadProyectada,
    };
  }

  return { success: true, data: { torneos, resumenes } };
}

export interface TorneoDetalle {
  torneo: Torneo;
  equipos: EquipoTorneo[];
  gastos: GastoTorneo[];
  premios: PremioTorneo[];
  categorias: CategoriaTorneo[];
  encuentros: Encuentro[];
  pagos: PagoEquipoTorneo[];
  jugadores: JugadorTorneo[];
  dashboard: DashboardTorneo;
  alertas: AlertaTorneo[];
}

/** Torneo + equipos + gastos + premios + métricas. Solo el organizador. */
export async function getTorneo(id: string): Promise<ActionResult<TorneoDetalle>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(id, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const svc = createServiceRoleClient();
  const [
    { data: equipos },
    { data: gastos },
    { data: premios },
    { data: categorias },
    { data: encuentros },
    { data: pagos },
    { data: jugadores },
  ] = await Promise.all([
    svc.from("equipos_torneo").select("*").eq("torneo_id", id).order("created_at"),
    svc.from("gastos_torneo").select("*").eq("torneo_id", id).order("created_at"),
    svc.from("premios_torneo").select("*").eq("torneo_id", id).order("puesto"),
    svc.from("categorias_torneo").select("*").eq("torneo_id", id).order("orden"),
    svc.from("encuentros").select("*").eq("torneo_id", id).order("programado_at").order("orden"),
    svc.from("pagos_equipo_torneo").select("*").eq("torneo_id", id).order("fecha", { ascending: false }),
    svc.from("jugadores_torneo").select("*").eq("torneo_id", id).order("orden"),
  ]);

  const listaEquipos = (equipos as EquipoTorneo[]) ?? [];
  const listaGastos = (gastos as GastoTorneo[]) ?? [];
  const listaPremios = (premios as PremioTorneo[]) ?? [];

  return {
    success: true,
    data: {
      torneo,
      equipos: listaEquipos,
      gastos: listaGastos,
      premios: listaPremios,
      categorias: (categorias as CategoriaTorneo[]) ?? [],
      encuentros: (encuentros as Encuentro[]) ?? [],
      pagos: (pagos as PagoEquipoTorneo[]) ?? [],
      jugadores: (jugadores as JugadorTorneo[]) ?? [],
      dashboard: calcularDashboardTorneo(torneo, listaEquipos, listaGastos),
      alertas: validarViabilidadTorneo(torneo, listaEquipos, listaGastos, listaPremios),
    },
  };
}

/** Premios por puesto de un torneo. */
export async function getPremiosTorneo(
  torneoId: string,
): Promise<ActionResult<PremioTorneo[]>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("premios_torneo")
    .select("*")
    .eq("torneo_id", torneoId)
    .order("puesto");

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as PremioTorneo[]) ?? [] };
}

/**
 * Reemplaza la premiación completa del torneo. Se envía la lista entera (1°,
 * 2°, 3°…) y esta acción la vuelve a numerar en orden para que nunca queden
 * huecos ni puestos repetidos.
 */
export async function guardarPremiosTorneo(
  torneoId: string,
  premios: z.infer<typeof premioSchema>[],
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const parsed = z.array(premioSchema).safeParse(premios);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Solo la premiación general: la de cada categoría se guarda con sus categorías.
  const svc = createServiceRoleClient();
  await svc.from("premios_torneo").delete().eq("torneo_id", torneoId).is("categoria_id", null);

  if (parsed.data.length > 0) {
    const ordenados = [...parsed.data].sort((a, b) => a.puesto - b.puesto);
    const { error } = await svc.from("premios_torneo").insert(
      ordenados.map((p, i) => ({
        torneo_id: torneoId,
        tenant_id: torneo.tenant_id,
        categoria_id: null,
        puesto: i + 1, // renumera: 1°, 2°, 3°… sin huecos
        tipo: p.tipo,
        descripcion: p.descripcion,
        valor: p.tipo === "valor" ? (p.valor ?? 0) : null,
      })),
    );
    if (error) return { success: false, error: error.message };
  }

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/** Equipos inscritos de un torneo (con datos de contacto: solo organizador). */
export async function getEquiposTorneo(
  torneoId: string,
): Promise<ActionResult<EquipoTorneo[]>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("equipos_torneo")
    .select("*")
    .eq("torneo_id", torneoId)
    .order("created_at");

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as EquipoTorneo[]) ?? [] };
}

/** Gastos de un torneo. Información interna de rentabilidad. */
export async function getGastosTorneo(
  torneoId: string,
): Promise<ActionResult<GastoTorneo[]>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("gastos_torneo")
    .select("*")
    .eq("torneo_id", torneoId)
    .order("created_at");

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as GastoTorneo[]) ?? [] };
}

/** Métricas financieras del torneo (núcleo puro + alertas de viabilidad). */
export async function getDashboardTorneo(
  torneoId: string,
): Promise<ActionResult<{ dashboard: DashboardTorneo; alertas: AlertaTorneo[] }>> {
  const res = await getTorneo(torneoId);
  if (!res.success) return { success: false, error: res.error };
  return {
    success: true,
    data: { dashboard: res.data.dashboard, alertas: res.data.alertas },
  };
}

// ---------------------------------------------------------------------------
// CRUD del torneo (owner)
// ---------------------------------------------------------------------------
/** Crea un torneo en estado borrador para el tenant del usuario. */
export async function crearTorneo(
  input: z.infer<typeof torneoSchema>,
): Promise<ActionResult<{ id: string }>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const parsed = torneoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { tenant_id, ...d } = parsed.data;

  // Solo el superadmin puede crear a nombre de otro organizador.
  const tenantId =
    acceso.membership.rol === "superadmin" && tenant_id
      ? tenant_id
      : acceso.membership.tenant_id;

  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("torneos")
    .insert({
      ...d,
      tenant_id: tenantId,
      slug_publico: slugify(d.nombre),
      estado: "borrador",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/torneos");
  return { success: true, data: { id: (data as { id: string }).id } };
}

/** Actualiza la configuración de un torneo. */
export async function actualizarTorneo(
  id: string,
  input: z.infer<typeof torneoSchema>,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(id, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const parsed = torneoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { tenant_id: _ignorado, ...d } = parsed.data;
  void _ignorado; // reasignar el torneo es otra acción, no un efecto del formulario

  // No se puede reducir el cupo por debajo de los equipos ya inscritos.
  const svc = createServiceRoleClient();
  const { data: equipos } = await svc
    .from("equipos_torneo")
    .select("*")
    .eq("torneo_id", id);
  const ocupados = equiposVigentes((equipos as EquipoTorneo[]) ?? []).length;
  if (d.cupo_equipos < ocupados) {
    return {
      success: false,
      error: `Ya hay ${ocupados} equipos registrados: el cupo no puede ser menor`,
    };
  }

  const { error } = await svc.from("torneos").update(d).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/** Elimina un torneo. Solo si todavía no tiene equipos registrados. */
export async function eliminarTorneo(id: string): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(id, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const svc = createServiceRoleClient();
  const { count } = await svc
    .from("equipos_torneo")
    .select("id", { count: "exact", head: true })
    .eq("torneo_id", id);

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: "El torneo ya tiene equipos inscritos: cancélalo en vez de borrarlo",
    };
  }

  const { error } = await svc.from("torneos").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/torneos");
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Ciclo de vida y monetización
// ---------------------------------------------------------------------------
/**
 * Activa el torneo (borrador → inscripciones) aplicando plan y cuota.
 *
 * Usa el mismo servicio que `activarRifa`: suscripción vigente → capa gratuita
 * → cobro pendiente. Si toca pagar, el torneo sigue en borrador hasta que el
 * superadmin confirme el pago.
 */
export async function activarTorneo(id: string): Promise<
  ActionResult<{
    activado: boolean;
    pendiente?: boolean;
    monto?: number;
    pago?: PlataformaPagoConfig | null;
  }>
> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(id, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };
  if (torneo.estado !== "borrador") {
    return { success: false, error: "El torneo ya fue activado" };
  }

  // El superadmin publica sin pasar por planes ni cobros (demos, torneos de
  // cortesía, acompañar a un cliente). `cobro_tipo` queda en null: no fue
  // gratis ni pagado, así no consume la cuota gratuita del organizador. Si un
  // intento anterior dejó un cobro pendiente, se anula.
  if (acceso.membership.rol === "superadmin") {
    const svc = createServiceRoleClient();
    await svc
      .from("cobros")
      .update({ estado: "anulado" })
      .eq("torneo_id", id)
      .eq("estado", "pendiente");
    await svc
      .from("torneos")
      .update({
        estado: "inscripciones",
        cobro_tipo: null,
        activado_at: new Date().toISOString(),
      })
      .eq("id", id);
    revalidarTorneo(torneo);
    revalidatePath("/superadmin");
    return { success: true, data: { activado: true } };
  }

  const resolucion = await resolverActivacion({
    tenantId: torneo.tenant_id,
    producto: "torneos",
    entidadId: torneo.id,
    tamano: torneo.cupo_equipos,
  });

  const svc = createServiceRoleClient();
  if (resolucion.activada) {
    await svc
      .from("torneos")
      .update({
        estado: "inscripciones",
        cobro_tipo: resolucion.cobroTipo,
        activado_at: new Date().toISOString(),
      })
      .eq("id", id);
    revalidarTorneo(torneo);
    return { success: true, data: { activado: true } };
  }

  revalidarTorneo(torneo);
  return {
    success: true,
    data: {
      activado: false,
      pendiente: true,
      monto: resolucion.monto,
      pago: resolucion.pago,
    },
  };
}

/**
 * Abre (o reabre) las inscripciones. Si el torneo aún está en borrador, delega
 * en `activarTorneo` para que pase por el control de plan y cuota.
 */
export async function abrirInscripciones(id: string): Promise<
  ActionResult<{
    activado: boolean;
    pendiente?: boolean;
    monto?: number;
    pago?: PlataformaPagoConfig | null;
  }>
> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(id, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  if (torneo.estado === "borrador") return activarTorneo(id);

  if (torneo.estado === "finalizado" || torneo.estado === "cancelado") {
    return { success: false, error: "Este torneo ya terminó" };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("torneos")
    .update({ estado: "inscripciones" })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
  return { success: true, data: { activado: true } };
}

const estadoSchema = z.enum([
  "borrador",
  "inscripciones",
  "programado",
  "en_curso",
  "finalizado",
  "cancelado",
]);

/** Mueve el torneo a otro estado del ciclo de vida (sin volver a borrador). */
export async function cambiarEstadoTorneo(
  id: string,
  estado: z.infer<typeof estadoSchema>,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const parsed = estadoSchema.safeParse(estado);
  if (!parsed.success) return { success: false, error: "Estado inválido" };
  if (parsed.data === "borrador") {
    return { success: false, error: "Un torneo activado no vuelve a borrador" };
  }

  const torneo = await torneoDelUsuario(id, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };
  if (torneo.estado === "borrador") {
    return { success: false, error: "Actívalo primero para publicarlo" };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc.from("torneos").update({ estado: parsed.data }).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/** Cierra el torneo: ya no recibe inscripciones ni cambios de resultado. */
export async function finalizarTorneo(id: string): Promise<ActionResult> {
  return cambiarEstadoTorneo(id, "finalizado");
}

// ---------------------------------------------------------------------------
// Equipos (owner)
// ---------------------------------------------------------------------------
/** Registra un equipo manualmente desde el backoffice. */
export async function crearEquipoTorneo(
  torneoId: string,
  input: z.input<typeof equipoSchema>,
): Promise<ActionResult<{ id: string }>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const parsed = equipoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const svc = createServiceRoleClient();
  const { data: existentes } = await svc
    .from("equipos_torneo")
    .select("*")
    .eq("torneo_id", torneoId);
  const vigentes = equiposVigentes((existentes as EquipoTorneo[]) ?? []);
  if (vigentes.length >= torneo.cupo_equipos) {
    return { success: false, error: "El torneo ya llegó a su cupo de equipos" };
  }
  const categoria = d.categoria_id ? await categoriaDelTorneo(torneoId, d.categoria_id) : null;
  if (d.categoria_id && !categoria) {
    return { success: false, error: "La categoría no pertenece a este torneo" };
  }
  if (
    categoria &&
    vigentes.filter((e) => e.categoria_id === categoria.id).length >= categoria.cupo_equipos
  ) {
    return { success: false, error: `La categoría ${categoria.nombre} ya llegó a su cupo` };
  }
  const jugadores = d.jugadores ?? [];
  if (jugadores.length > 0) {
    const errorPlantilla = await validarPlantilla(torneo, null, categoria, jugadores);
    if (errorPlantilla) return { success: false, error: errorPlantilla };
  }

  const { data, error } = await svc
    .from("equipos_torneo")
    .insert({
      torneo_id: torneoId,
      tenant_id: torneo.tenant_id,
      nombre: d.nombre,
      categoria_id: categoria?.id ?? null,
      escudo_url: d.escudo_url ?? null,
      responsable_nombre: d.responsable_nombre ?? null,
      responsable_telefono: d.responsable_telefono ?? null,
      responsable_correo: d.responsable_correo ?? null,
      cantidad_jugadores: jugadores.length || (d.cantidad_jugadores ?? null),
      monto_inscripcion:
        d.monto_inscripcion ??
        (categoria ? inscripcionCategoria(categoria, torneo) : torneo.valor_inscripcion),
      estado: d.estado,
      confirmado_at: d.estado === "confirmado" ? new Date().toISOString() : null,
      // El organizador registra el equipo: el consentimiento lo recoge él.
      consentimiento_datos: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya hay un equipo con ese nombre en el torneo" };
    }
    return { success: false, error: error.message };
  }

  const equipoId = (data as { id: string }).id;
  if (jugadores.length > 0) {
    const errJugadores = await insertarJugadores(torneo, equipoId, jugadores);
    if (errJugadores) {
      await svc.from("equipos_torneo").delete().eq("id", equipoId);
      return { success: false, error: errJugadores };
    }
  }

  revalidarTorneo(torneo);
  return { success: true, data: { id: equipoId } };
}

// ---------------------------------------------------------------------------
// Plantilla de jugadores
// ---------------------------------------------------------------------------
/**
 * Documentos que este equipo NO puede repetir: los de los demás equipos
 * vigentes del torneo, o solo los de su categoría si el reglamento permite
 * jugar en varias categorías.
 */
async function documentosOcupados(
  torneo: Torneo,
  equipoId: string | null,
  categoriaId: string | null,
): Promise<Set<string>> {
  const reglas = leerReglas(torneo.reglas).participacion;
  const svc = createServiceRoleClient();
  const [{ data: jugadoresData }, { data: equiposData }] = await Promise.all([
    svc.from("jugadores_torneo").select("documento, equipo_id").eq("torneo_id", torneo.id),
    svc.from("equipos_torneo").select("*").eq("torneo_id", torneo.id),
  ]);
  const vigentes = new Map(
    equiposVigentes((equiposData as EquipoTorneo[]) ?? []).map((e) => [e.id, e]),
  );
  const ocupados = new Set<string>();
  for (const j of (jugadoresData as Pick<JugadorTorneo, "documento" | "equipo_id">[]) ?? []) {
    if (j.equipo_id === equipoId) continue;
    const equipo = vigentes.get(j.equipo_id);
    if (!equipo) continue;
    if (reglas.jugador_varias_categorias && equipo.categoria_id !== categoriaId) continue;
    ocupados.add(normalizarDocumento(j.documento));
  }
  return ocupados;
}

/** Valida la plantilla contra las reglas del torneo. Devuelve el primer error o null. */
async function validarPlantilla(
  torneo: Torneo,
  equipoId: string | null,
  categoria: CategoriaTorneo | null,
  jugadores: JugadorInput[],
): Promise<string | null> {
  const parsed = z.array(jugadorInputSchema).safeParse(jugadores);
  if (!parsed.success) return parsed.error.issues[0].message;
  const errores = erroresPlantilla(
    parsed.data,
    leerReglas(torneo.reglas).participacion,
    {
      minimo: categoria?.jugadores_en_cancha ?? null,
      maximo: categoria?.max_jugadores ?? null,
    },
    await documentosOcupados(torneo, equipoId, categoria?.id ?? null),
  );
  return errores[0] ?? null;
}

/** Reemplaza la plantilla del equipo (ya validada). */
async function insertarJugadores(
  torneo: Torneo,
  equipoId: string,
  jugadores: JugadorInput[],
): Promise<string | null> {
  const parsed = z.array(jugadorInputSchema).parse(jugadores);
  const svc = createServiceRoleClient();
  await svc.from("jugadores_torneo").delete().eq("equipo_id", equipoId);
  if (parsed.length === 0) return null;
  const { error } = await svc.from("jugadores_torneo").insert(
    parsed.map((j, i) => ({
      tenant_id: torneo.tenant_id,
      torneo_id: torneo.id,
      equipo_id: equipoId,
      nombre: j.nombre,
      documento: j.documento,
      genero: j.genero,
      es_externo: j.es_externo,
      es_referente: j.es_referente,
      referencia_cliente: j.es_externo ? null : (j.referencia_cliente ?? null),
      orden: i,
    })),
  );
  if (error) {
    return error.code === "23505" ? "Hay un documento repetido en el equipo" : error.message;
  }
  await svc
    .from("equipos_torneo")
    .update({ cantidad_jugadores: parsed.length })
    .eq("id", equipoId);
  return null;
}

/** El organizador completa o corrige la plantilla de un equipo. */
export async function guardarJugadoresEquipo(
  equipoId: string,
  jugadores: JugadorInput[],
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const dueno = await equipoDelUsuario(equipoId, acceso.membership);
  if (!dueno) return { success: false, error: "Equipo no encontrado" };
  const { equipo, torneo } = dueno;

  const categoria = equipo.categoria_id
    ? await categoriaDelTorneo(torneo.id, equipo.categoria_id)
    : null;
  const errorPlantilla = await validarPlantilla(torneo, equipo.id, categoria, jugadores);
  if (errorPlantilla) return { success: false, error: errorPlantilla };

  const err = await insertarJugadores(torneo, equipo.id, jugadores);
  if (err) return { success: false, error: err };

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/** Edita los datos de un equipo inscrito. */
export async function actualizarEquipoTorneo(
  id: string,
  input: z.input<typeof equipoSchema>,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const parsed = equipoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const svc = createServiceRoleClient();
  const { data: equipo } = await svc
    .from("equipos_torneo")
    .select("torneo_id")
    .eq("id", id)
    .maybeSingle();
  if (!equipo) return { success: false, error: "Equipo no encontrado" };

  const torneo = await torneoDelUsuario(
    (equipo as { torneo_id: string }).torneo_id,
    acceso.membership,
  );
  if (!torneo) return { success: false, error: "No autorizado" };
  if (d.categoria_id && !(await categoriaDelTorneo(torneo.id, d.categoria_id))) {
    return { success: false, error: "La categoría no pertenece a este torneo" };
  }

  const { error } = await svc
    .from("equipos_torneo")
    .update({
      nombre: d.nombre,
      escudo_url: d.escudo_url ?? null,
      responsable_nombre: d.responsable_nombre ?? null,
      responsable_telefono: d.responsable_telefono ?? null,
      responsable_correo: d.responsable_correo ?? null,
      cantidad_jugadores: d.cantidad_jugadores ?? null,
      monto_inscripcion: d.monto_inscripcion ?? null,
      estado: d.estado,
      // Solo se toca si el formulario la envía (los que no la conocen no la borran).
      ...(d.categoria_id !== undefined ? { categoria_id: d.categoria_id } : {}),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya hay un equipo con ese nombre en el torneo" };
    }
    return { success: false, error: error.message };
  }

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/** Cambia el estado de un equipo verificando pertenencia y cupo. */
async function cambiarEstadoEquipo(
  id: string,
  estado: EquipoTorneo["estado"],
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const svc = createServiceRoleClient();
  const { data: equipoData } = await svc
    .from("equipos_torneo")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const equipo = (equipoData as EquipoTorneo | null) ?? null;
  if (!equipo) return { success: false, error: "Equipo no encontrado" };

  const torneo = await torneoDelUsuario(equipo.torneo_id, acceso.membership);
  if (!torneo) return { success: false, error: "No autorizado" };

  // Confirmar un equipo consume cupo: verificamos que quede lugar.
  if (estado === "confirmado" && equipo.estado !== "confirmado") {
    const { data: todos } = await svc
      .from("equipos_torneo")
      .select("*")
      .eq("torneo_id", torneo.id);
    const vigentes = equiposVigentes((todos as EquipoTorneo[]) ?? []).filter(
      (e) => e.id !== equipo.id,
    );
    if (vigentes.length >= torneo.cupo_equipos) {
      return { success: false, error: "El torneo ya llegó a su cupo de equipos" };
    }
  }

  const { error } = await svc
    .from("equipos_torneo")
    .update({
      estado,
      confirmado_at: estado === "confirmado" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/** Confirma el cupo de un equipo. */
export async function confirmarEquipoTorneo(id: string): Promise<ActionResult> {
  return cambiarEstadoEquipo(id, "confirmado");
}

/** Rechaza la solicitud de un equipo (libera el cupo). */
export async function rechazarEquipoTorneo(id: string): Promise<ActionResult> {
  return cambiarEstadoEquipo(id, "rechazado");
}

/** Marca un equipo como retirado del torneo (libera el cupo). */
export async function retirarEquipoTorneo(id: string): Promise<ActionResult> {
  return cambiarEstadoEquipo(id, "retirado");
}

/** Recalcula el total pagado del equipo a partir de sus abonos. */
async function sincronizarPagado(equipoId: string): Promise<void> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("pagos_equipo_torneo")
    .select("monto, metodo")
    .eq("equipo_id", equipoId);
  const pagos = (data as Pick<PagoEquipoTorneo, "monto" | "metodo">[]) ?? [];
  const metodos = [...new Set(pagos.map((p) => p.metodo))];
  await svc
    .from("equipos_torneo")
    .update({
      monto_pagado: pagos.reduce((s, p) => s + p.monto, 0),
      // Un solo medio → ese; mezclado o sin pagos → null (el detalle está en los abonos).
      metodo_pago: metodos.length === 1 ? metodos[0] : null,
    })
    .eq("id", equipoId);
}

/** Equipo + torneo, verificando que el usuario pueda administrarlo. */
async function equipoDelUsuario(
  equipoId: string,
  membership: Membership,
): Promise<{ equipo: EquipoTorneo; torneo: Torneo } | null> {
  const svc = createServiceRoleClient();
  const { data } = await svc.from("equipos_torneo").select("*").eq("id", equipoId).maybeSingle();
  const equipo = (data as EquipoTorneo | null) ?? null;
  if (!equipo) return null;
  const torneo = await torneoDelUsuario(equipo.torneo_id, membership);
  return torneo ? { equipo, torneo } : null;
}

/**
 * Registra un abono a la inscripción. Admite pago dividido: una parte en
 * efectivo y otra por transferencia en el mismo registro (quedan dos abonos).
 * No deja pagar más del saldo pendiente.
 */
export async function registrarPagoEquipo(
  equipoId: string,
  input: z.infer<typeof pagoEquipoSchema>,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const parsed = pagoEquipoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const dueno = await equipoDelUsuario(equipoId, acceso.membership);
  if (!dueno) return { success: false, error: "Equipo no encontrado" };
  const { equipo, torneo } = dueno;

  const total = d.efectivo + d.transferencia;
  if (total <= 0) return { success: false, error: "Escribe cuánto pagó" };
  const saldo = saldoEquipo(torneo, equipo);
  if (total > saldo) {
    return {
      success: false,
      error: `El abono supera lo que debe (${formatCOP(saldo)})`,
    };
  }

  const base = {
    tenant_id: torneo.tenant_id,
    torneo_id: torneo.id,
    equipo_id: equipo.id,
    nota: d.nota || null,
    comprobante_url: d.comprobante_url || null,
  };
  const filas = (
    [
      { ...base, monto: d.efectivo, metodo: "efectivo" },
      { ...base, monto: d.transferencia, metodo: "transferencia" },
    ] as const
  ).filter((f) => f.monto > 0);

  const svc = createServiceRoleClient();
  const { error } = await svc.from("pagos_equipo_torneo").insert(filas);
  if (error) return { success: false, error: error.message };

  await sincronizarPagado(equipo.id);
  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/** Borra un abono registrado por error. El saldo del equipo se recalcula. */
export async function eliminarPagoEquipo(pagoId: string): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("pagos_equipo_torneo")
    .select("equipo_id")
    .eq("id", pagoId)
    .maybeSingle();
  const pago = data as { equipo_id: string } | null;
  if (!pago) return { success: false, error: "Pago no encontrado" };

  const dueno = await equipoDelUsuario(pago.equipo_id, acceso.membership);
  if (!dueno) return { success: false, error: "No autorizado" };

  const { error } = await svc.from("pagos_equipo_torneo").delete().eq("id", pagoId);
  if (error) return { success: false, error: error.message };

  await sincronizarPagado(pago.equipo_id);
  revalidarTorneo(dueno.torneo);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Gastos (owner)
// ---------------------------------------------------------------------------
/** Registra un gasto del torneo. */
export async function crearGastoTorneo(
  torneoId: string,
  input: z.infer<typeof gastoSchema>,
): Promise<ActionResult<{ id: string }>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const parsed = gastoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("gastos_torneo")
    .insert({
      torneo_id: torneoId,
      tenant_id: torneo.tenant_id,
      categoria: d.categoria,
      descripcion: d.descripcion ?? null,
      cantidad: d.cantidad ?? null,
      valor_unitario: d.valor_unitario ?? null,
      valor_total: d.valor_total,
      pagado: d.pagado,
      proveedor: d.proveedor ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
  return { success: true, data: { id: (data as { id: string }).id } };
}

/** Edita un gasto ya registrado. */
export async function actualizarGastoTorneo(
  id: string,
  input: z.infer<typeof gastoSchema>,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const parsed = gastoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const svc = createServiceRoleClient();
  const { data: gasto } = await svc
    .from("gastos_torneo")
    .select("torneo_id")
    .eq("id", id)
    .maybeSingle();
  if (!gasto) return { success: false, error: "Gasto no encontrado" };

  const torneo = await torneoDelUsuario(
    (gasto as { torneo_id: string }).torneo_id,
    acceso.membership,
  );
  if (!torneo) return { success: false, error: "No autorizado" };

  const { error } = await svc
    .from("gastos_torneo")
    .update({
      categoria: d.categoria,
      descripcion: d.descripcion ?? null,
      cantidad: d.cantidad ?? null,
      valor_unitario: d.valor_unitario ?? null,
      valor_total: d.valor_total,
      pagado: d.pagado,
      proveedor: d.proveedor ?? null,
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/** Elimina un gasto. */
export async function eliminarGastoTorneo(id: string): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const svc = createServiceRoleClient();
  const { data: gasto } = await svc
    .from("gastos_torneo")
    .select("torneo_id")
    .eq("id", id)
    .maybeSingle();
  if (!gasto) return { success: false, error: "Gasto no encontrado" };

  const torneo = await torneoDelUsuario(
    (gasto as { torneo_id: string }).torneo_id,
    acceso.membership,
  );
  if (!torneo) return { success: false, error: "No autorizado" };

  const { error } = await svc.from("gastos_torneo").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Público (anon) — corte seguro vía service role
// ---------------------------------------------------------------------------
export interface TorneoPublicoDetalle {
  torneo: TorneoPublico;
  /** Premiación por puesto: es lo que decide inscribirse. */
  premios: PremioTorneoPublico[];
  /** Categorías con sus cupos libres (vacío si el torneo no tiene categorías). */
  categorias: CategoriaTorneoPublica[];
  /** Fixture y resultados (sin ids de tenant). */
  encuentros: EncuentroPublico[];
  /** Reglas de la tabla de posiciones, para calcularla igual que el panel. */
  tablaReglas: ReturnType<typeof leerReglas>["tabla"];
  /** Reglas de quién puede jugar: el formulario valida la plantilla con ellas. */
  participacion: ReturnType<typeof leerReglas>["participacion"];
  equipos: EquipoTorneoPublico[];
  equiposConfirmados: number;
  cuposDisponibles: number;
  /** Si en este momento se pueden enviar solicitudes de inscripción. */
  inscripcionesAbiertas: boolean;
  /** Datos de contacto/cobro del organizador (ya son públicos por diseño). */
  pago: TenantPagoConfig | null;
  organizador: string;
}

/** Datos públicos de un torneo por slug. Nunca expone contactos ni finanzas. */
export async function getTorneoPublico(
  slug: string,
): Promise<ActionResult<TorneoPublicoDetalle>> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("torneos")
    .select("*")
    .eq("slug_publico", slug)
    .maybeSingle();

  const torneo = (data as Torneo | null) ?? null;
  if (!torneo) return { success: false, error: "Torneo no encontrado" };
  if (!ESTADOS_TORNEO_PUBLICOS.includes(torneo.estado)) {
    return { success: false, error: "Este torneo no está disponible" };
  }

  const [
    { data: equiposData },
    { data: premiosData },
    { data: pagoData },
    { data: tenantData },
    { data: categoriasData },
    { data: encuentrosData },
  ] = await Promise.all([
    svc.from("equipos_torneo").select("*").eq("torneo_id", torneo.id).order("created_at"),
    svc
      .from("premios_torneo")
      .select("puesto, tipo, descripcion, valor, categoria_id")
      .eq("torneo_id", torneo.id)
      .order("puesto"),
    svc
      .from("tenant_pago_config")
      .select("*")
      .eq("tenant_id", torneo.tenant_id)
      .maybeSingle(),
    svc.from("tenants").select("nombre").eq("id", torneo.tenant_id).maybeSingle(),
    svc.from("categorias_torneo").select("*").eq("torneo_id", torneo.id).order("orden"),
    svc
      .from("encuentros")
      .select(
        "id, torneo_id, categoria_id, fase, grupo, ronda, orden, equipo_a_id, equipo_b_id, cancha, programado_at, estado, sets, ganador_id, sala_marcador",
      )
      .eq("torneo_id", torneo.id)
      .order("programado_at")
      .order("orden"),
  ]);

  const equipos = (equiposData as EquipoTorneo[]) ?? [];
  const vigentes = equiposVigentes(equipos);
  const categorias = ((categoriasData as CategoriaTorneo[]) ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    jugadores_en_cancha: c.jugadores_en_cancha,
    max_jugadores: c.max_jugadores,
    cupo_equipos: c.cupo_equipos,
    valor_inscripcion: inscripcionCategoria(c, torneo),
    cuposDisponibles: Math.max(
      0,
      c.cupo_equipos - vigentes.filter((e) => e.categoria_id === c.id).length,
    ),
  }));

  return {
    success: true,
    data: {
      torneo: {
        nombre: torneo.nombre,
        slug_publico: torneo.slug_publico,
        deporte: torneo.deporte,
        modalidad: torneo.modalidad,
        categoria: torneo.categoria,
        rama: torneo.rama,
        formato: torneo.formato,
        estado: torneo.estado,
        ciudad: torneo.ciudad,
        escenario: torneo.escenario,
        direccion: torneo.direccion,
        fecha_inicio: torneo.fecha_inicio,
        fecha_fin: torneo.fecha_fin,
        cierre_inscripciones: torneo.cierre_inscripciones,
        cupo_equipos: torneo.cupo_equipos,
        jugadores_por_equipo: torneo.jugadores_por_equipo,
        valor_inscripcion: torneo.valor_inscripcion,
        reglamento: torneo.reglamento,
        premiacion_descripcion: torneo.premiacion_descripcion,
        tema: torneo.tema,
      },
      premios: premiosOrdenados((premiosData as PremioTorneoPublico[]) ?? []),
      categorias,
      encuentros: await conMarcadorEnVivo((encuentrosData as EncuentroPublico[]) ?? []),
      tablaReglas: leerReglas(torneo.reglas).tabla,
      participacion: leerReglas(torneo.reglas).participacion,
      equipos: construirEquiposPublicos(equipos),
      equiposConfirmados: vigentes.filter((e) => e.estado === "confirmado").length,
      cuposDisponibles: Math.max(0, torneo.cupo_equipos - vigentes.length),
      inscripcionesAbiertas: inscripcionesVigentes(torneo, vigentes.length),
      pago: (pagoData as TenantPagoConfig | null) ?? null,
      organizador: (tenantData as { nombre: string } | null)?.nombre ?? "El organizador",
    },
  };
}

/**
 * Para los partidos en vivo con marcador abierto, toma los puntos que lleva el
 * juez en ese momento (sin guardarlos). Si el marcador no responde, se queda
 * con lo último guardado: la página nunca se rompe por eso.
 */
async function conMarcadorEnVivo(encuentros: EncuentroPublico[]): Promise<EncuentroPublico[]> {
  return Promise.all(
    encuentros.map(async (e) => {
      if (e.estado !== "en_vivo" || !e.sala_marcador) return e;
      const leido = await leerMarcador(e.sala_marcador, 1500);
      return leido && leido.sets.length > 0 ? { ...e, sets: leido.sets } : e;
    }),
  );
}

/** ¿El torneo admite inscripciones ahora mismo? */
function inscripcionesVigentes(torneo: Torneo, ocupados: number): boolean {
  if (torneo.estado !== "inscripciones") return false;
  if (ocupados >= torneo.cupo_equipos) return false;
  if (
    torneo.cierre_inscripciones &&
    new Date(torneo.cierre_inscripciones).getTime() < Date.now()
  ) {
    return false;
  }
  return true;
}

const inscripcionSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre del equipo es obligatorio"),
  responsable_nombre: z.string().trim().min(2, "Indica quién responde por el equipo"),
  responsable_telefono: z
    .string()
    .trim()
    .regex(/^[+()\d\s.-]{7,20}$/, "WhatsApp inválido"),
  responsable_correo: z
    .string()
    .trim()
    .email("Correo inválido")
    .nullable()
    .optional()
    .or(z.literal("")),
  cantidad_jugadores: z.number().int().min(1).nullable().optional(),
  categoria_id: z.string().uuid().nullable().optional(),
  jugadores: z.array(jugadorInputSchema).min(1, "Inscribe a los jugadores del equipo"),
  consentimiento: z.literal(true, {
    error: "Debes aceptar el reglamento y el tratamiento de datos",
  }),
});

/**
 * Inscripción pública de un equipo (sin cuenta). Entra SIEMPRE como
 * `pendiente` y sin pago: confirmar el cupo y registrar el dinero son
 * decisiones del organizador.
 */
export async function inscribirEquipoPublico(
  slug: string,
  input: z.input<typeof inscripcionSchema>,
): Promise<ActionResult<{ nombre: string }>> {
  const parsed = inscripcionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("torneos")
    .select("*")
    .eq("slug_publico", slug)
    .maybeSingle();

  const torneo = (data as Torneo | null) ?? null;
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const { data: equiposData } = await svc
    .from("equipos_torneo")
    .select("*")
    .eq("torneo_id", torneo.id);
  const vigentes = equiposVigentes((equiposData as EquipoTorneo[]) ?? []);

  if (torneo.estado !== "inscripciones") {
    return { success: false, error: "Este torneo no está recibiendo inscripciones" };
  }
  if (
    torneo.cierre_inscripciones &&
    new Date(torneo.cierre_inscripciones).getTime() < Date.now()
  ) {
    return { success: false, error: "El plazo de inscripciones ya cerró" };
  }
  if (vigentes.length >= torneo.cupo_equipos) {
    return { success: false, error: "El torneo ya completó su cupo de equipos" };
  }

  // Con categorías, el equipo elige una y el cupo se cuenta por categoría.
  const { count: totalCategorias } = await svc
    .from("categorias_torneo")
    .select("id", { count: "exact", head: true })
    .eq("torneo_id", torneo.id);
  const categoria = d.categoria_id ? await categoriaDelTorneo(torneo.id, d.categoria_id) : null;
  if ((totalCategorias ?? 0) > 0 && !categoria) {
    return { success: false, error: "Elige la categoría en la que va a jugar el equipo" };
  }
  if (
    categoria &&
    vigentes.filter((e) => e.categoria_id === categoria.id).length >= categoria.cupo_equipos
  ) {
    return { success: false, error: `La categoría ${categoria.nombre} ya completó su cupo` };
  }

  // La plantilla se valida ANTES de crear el equipo: no queda una solicitud a medias.
  const errorPlantilla = await validarPlantilla(torneo, null, categoria, d.jugadores);
  if (errorPlantilla) return { success: false, error: errorPlantilla };

  const { data: equipoData, error } = await svc
    .from("equipos_torneo")
    .insert({
      torneo_id: torneo.id,
      tenant_id: torneo.tenant_id,
      categoria_id: categoria?.id ?? null,
      nombre: d.nombre,
      responsable_nombre: d.responsable_nombre,
      responsable_telefono: d.responsable_telefono,
      responsable_correo: d.responsable_correo || null,
      cantidad_jugadores: d.jugadores.length,
      monto_inscripcion: categoria
        ? inscripcionCategoria(categoria, torneo)
        : torneo.valor_inscripcion,
      estado: "pendiente",
      consentimiento_datos: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya hay un equipo inscrito con ese nombre" };
    }
    return { success: false, error: error.message };
  }

  const equipoId = (equipoData as { id: string }).id;
  const errJugadores = await insertarJugadores(torneo, equipoId, d.jugadores);
  if (errJugadores) {
    await svc.from("equipos_torneo").delete().eq("id", equipoId);
    return { success: false, error: errJugadores };
  }

  revalidatePath(`/t/${slug}`);
  revalidatePath(`/admin/torneos/${torneo.id}`);
  // La respuesta solo devuelve lo que el propio visitante escribió.
  return { success: true, data: { nombre: d.nombre } };
}

// ---------------------------------------------------------------------------
// Categorías, reglas y plantillas (owner)
// ---------------------------------------------------------------------------
const categoriaInputSchema = z.object({
  /** Presente si la categoría ya existe (se actualiza en vez de recrearse). */
  id: z.string().uuid().nullable().optional(),
  nombre: z.string().trim().min(1, "Cada categoría necesita un nombre"),
  jugadores_en_cancha: z.number().int().min(1).nullable().optional(),
  max_jugadores: z.number().int().min(1).nullable().optional(),
  cupo_equipos: z.number().int().min(2, "El cupo de cada categoría es de al menos 2 equipos"),
  valor_inscripcion: z.number().int().min(0).nullable().optional(),
  /** Premios en dinero por puesto: [1°, 2°, 3°…]. */
  premios: z.array(z.number().int().min(0)).default([]),
});

export type CategoriaInput = z.input<typeof categoriaInputSchema>;

/**
 * Guarda las categorías del torneo con su premiación. Se envía la lista
 * completa: las que no vienen se borran (solo si no tienen equipos), las que
 * traen `id` se actualizan y las nuevas se crean. El cupo del torneo pasa a ser
 * la suma de los cupos (define el escalón del plan).
 */
export async function guardarCategoriasTorneo(
  torneoId: string,
  input: CategoriaInput[],
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const parsed = z.array(categoriaInputSchema).safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const categorias = parsed.data;

  const nombres = categorias.map((c) => c.nombre.toLowerCase());
  if (new Set(nombres).size !== nombres.length) {
    return { success: false, error: "Hay dos categorías con el mismo nombre" };
  }

  const svc = createServiceRoleClient();
  const [{ data: actualesData }, { data: equiposData }] = await Promise.all([
    svc.from("categorias_torneo").select("*").eq("torneo_id", torneoId),
    svc.from("equipos_torneo").select("*").eq("torneo_id", torneoId),
  ]);
  const actuales = (actualesData as CategoriaTorneo[]) ?? [];
  const vigentes = equiposVigentes((equiposData as EquipoTorneo[]) ?? []);

  // Una categoría con equipos no se puede borrar ni quedar con menos cupo.
  const idsEnviados = new Set(categorias.map((c) => c.id).filter(Boolean));
  for (const c of actuales) {
    const ocupados = vigentes.filter((e) => e.categoria_id === c.id).length;
    const enviada = categorias.find((x) => x.id === c.id);
    if (!idsEnviados.has(c.id) && ocupados > 0) {
      return {
        success: false,
        error: `${c.nombre} ya tiene ${ocupados} equipo(s): no se puede quitar`,
      };
    }
    if (enviada && enviada.cupo_equipos < ocupados) {
      return {
        success: false,
        error: `${c.nombre} ya tiene ${ocupados} equipos: el cupo no puede ser menor`,
      };
    }
  }

  const borrar = actuales.filter((c) => !idsEnviados.has(c.id)).map((c) => c.id);
  if (borrar.length > 0) {
    const { error } = await svc.from("categorias_torneo").delete().in("id", borrar);
    if (error) return { success: false, error: error.message };
  }

  for (const [orden, c] of categorias.entries()) {
    const fila = {
      tenant_id: torneo.tenant_id,
      torneo_id: torneoId,
      nombre: c.nombre,
      jugadores_en_cancha: c.jugadores_en_cancha ?? null,
      max_jugadores: c.max_jugadores ?? null,
      cupo_equipos: c.cupo_equipos,
      valor_inscripcion: c.valor_inscripcion ?? null,
      orden,
    };
    const existe = c.id && actuales.some((a) => a.id === c.id);
    const { data, error } = existe
      ? await svc.from("categorias_torneo").update(fila).eq("id", c.id!).select("id").single()
      : await svc.from("categorias_torneo").insert(fila).select("id").single();
    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "Hay dos categorías con el mismo nombre" };
      }
      return { success: false, error: error.message };
    }
    const categoriaId = (data as { id: string }).id;

    await svc.from("premios_torneo").delete().eq("categoria_id", categoriaId);
    const premios = c.premios.filter((v) => v > 0);
    if (premios.length > 0) {
      const { error: errPremios } = await svc.from("premios_torneo").insert(
        premios.map((valor, i) => ({
          tenant_id: torneo.tenant_id,
          torneo_id: torneoId,
          categoria_id: categoriaId,
          puesto: i + 1,
          tipo: "valor",
          descripcion: formatCOP(valor),
          valor,
        })),
      );
      if (errPremios) return { success: false, error: errPremios.message };
    }
  }

  if (categorias.length > 0) {
    const cupoTotal = categorias.reduce((s, c) => s + c.cupo_equipos, 0);
    await svc.from("torneos").update({ cupo_equipos: cupoTotal }).eq("id", torneoId);
  }

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

/**
 * Guarda las reglas del torneo y, si se pide, vuelve a redactar el reglamento
 * con ellas. Así el reglamento nunca queda desalineado con lo configurado.
 */
export async function guardarReglasTorneo(
  torneoId: string,
  reglas: unknown,
  opciones: { regenerarReglamento: boolean },
): Promise<ActionResult<{ reglamento: string | null }>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const parsed = reglasSchema.safeParse(reglas);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const reglamento = opciones.regenerarReglamento
    ? await redactarReglamento(torneo, parsed.data)
    : torneo.reglamento;

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("torneos")
    .update({ reglas: parsed.data, reglamento })
    .eq("id", torneoId);
  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
  return { success: true, data: { reglamento } };
}

async function redactarReglamento(
  torneo: Torneo,
  reglas: z.infer<typeof reglasSchema>,
): Promise<string> {
  const svc = createServiceRoleClient();
  const [{ data: categorias }, { data: premios }, { data: tenant }] = await Promise.all([
    svc.from("categorias_torneo").select("*").eq("torneo_id", torneo.id).order("orden"),
    svc.from("premios_torneo").select("*").eq("torneo_id", torneo.id),
    svc.from("tenants").select("nombre").eq("id", torneo.tenant_id).maybeSingle(),
  ]);
  return generarReglamento(
    torneo,
    (categorias as CategoriaTorneo[]) ?? [],
    (premios as PremioTorneo[]) ?? [],
    (tenant as { nombre: string } | null)?.nombre ?? "el organizador",
    reglas,
  );
}

/** Plantilla editable de la base; si no existe, la de respaldo en código. */
async function getPlantilla(slug: string): Promise<ConfigPlantilla> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("plantillas_torneo")
    .select("config")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  return data ? leerConfigPlantilla((data as { config: unknown }).config) : PLANTILLA_VOLEIPLAYA;
}

const NOMBRES_M = ["Andrés", "Camilo", "Juan", "Sebastián", "Diego", "Felipe", "Mateo", "Santiago", "Julián", "Carlos"];
const NOMBRES_F = ["Laura", "Valentina", "Daniela", "Camila", "Sofía", "Paula", "María", "Natalia", "Juliana", "Ana"];
const APELLIDOS = ["Pérez", "Gómez", "Rodríguez", "Cuéllar", "Trujillo", "Perdomo", "Vargas", "Rojas", "Polanía", "Medina"];

/**
 * Plantillas de ejemplo que CUMPLEN las reglas de la demo: los de cancha más
 * un suplente, mujeres suficientes, a veces un externo y un referente.
 * Documentos ficticios y únicos.
 */
async function sembrarJugadoresDemo(
  torneo: Torneo,
  equipos: { id: string; categoria_id: string | null }[],
  categorias: CategoriaTorneo[],
  rng: () => number,
): Promise<void> {
  const reglas = leerReglas(torneo.reglas).participacion;
  const pick = (lista: string[]) => lista[Math.floor(rng() * lista.length)];
  let doc = 1_000_000_000 + Math.floor(rng() * 1_000_000);
  const filas = equipos.flatMap((e) => {
    const c = categorias.find((x) => x.id === e.categoria_id);
    const enCancha = c?.jugadores_en_cancha ?? 3;
    const cuantos = Math.min(c?.max_jugadores ?? enCancha + 1, enCancha + 1);
    const mujeres = Math.max(reglas.min_mujeres_cancha, 1) + (rng() < 0.4 ? 1 : 0);
    const externo = reglas.solo_clientes && (reglas.max_externos ?? 1) > 0 && rng() < 0.5;
    const referente = reglas.max_referentes !== 0 && rng() < 0.3;
    return Array.from({ length: cuantos }, (_, i) => {
      const esMujer = i < mujeres;
      const esExterno = externo && i === cuantos - 1;
      return {
        tenant_id: torneo.tenant_id,
        torneo_id: torneo.id,
        equipo_id: e.id,
        nombre: `${pick(esMujer ? NOMBRES_F : NOMBRES_M)} ${pick(APELLIDOS)}`,
        documento: String(doc++),
        genero: esMujer ? "femenino" : "masculino",
        es_externo: esExterno,
        es_referente: referente && i === 0,
        referencia_cliente:
          reglas.solo_clientes && !esExterno ? `FAC-${10000 + Math.floor(rng() * 89999)}` : null,
        orden: i,
      };
    });
  });
  const svc = createServiceRoleClient();
  if (filas.length > 0) await svc.from("jugadores_torneo").insert(filas);
  for (const e of equipos) {
    await svc
      .from("equipos_torneo")
      .update({ cantidad_jugadores: filas.filter((f) => f.equipo_id === e.id).length })
      .eq("id", e.id);
  }
}

/**
 * Abonos de ejemplo para la demo: reparte lo pagado de cada equipo entre
 * efectivo, transferencia o ambos (pago dividido) y deja `metodo_pago`
 * coherente con `sincronizarPagado`.
 */
async function sembrarPagosDemo(
  equipos: { id: string; tenant_id: string; torneo_id: string; monto_pagado: number }[],
  rng: () => number,
): Promise<void> {
  const svc = createServiceRoleClient();
  const filas: Omit<PagoEquipoTorneo, "id" | "created_at" | "fecha" | "comprobante_url">[] = [];
  for (const e of equipos) {
    if (e.monto_pagado <= 0) continue;
    const base = { tenant_id: e.tenant_id, torneo_id: e.torneo_id, equipo_id: e.id };
    const r = rng();
    if (r < 0.3 && e.monto_pagado >= 2) {
      const mitad = Math.round(e.monto_pagado / 2);
      filas.push({ ...base, monto: mitad, metodo: "efectivo", nota: "Primer abono en la cancha" });
      filas.push({ ...base, monto: e.monto_pagado - mitad, metodo: "transferencia", nota: "Saldo por Nequi" });
    } else {
      filas.push({ ...base, monto: e.monto_pagado, metodo: r < 0.6 ? "efectivo" : "transferencia", nota: null });
    }
  }
  if (filas.length > 0) await svc.from("pagos_equipo_torneo").insert(filas);
  for (const e of equipos) {
    const metodos = [...new Set(filas.filter((f) => f.equipo_id === e.id).map((f) => f.metodo))];
    if (metodos.length > 0) {
      await svc
        .from("equipos_torneo")
        .update({ metodo_pago: metodos.length === 1 ? metodos[0] : null })
        .eq("id", e.id);
    }
  }
}

/**
 * Crea en borrador una DEMO completa del Torneo Familia Fase 4: categorías,
 * premios, reglas, reglamento redactado, equipos de ejemplo con pagos y
 * gastos. Sirve para mostrarle al cliente cómo funciona y como base para
 * configurar el torneo real con él en minutos.
 */
export type VarianteDemo = "configuracion" | "en_juego" | "finalizado";

const NOMBRE_DEMO: Record<VarianteDemo, string> = {
  configuracion: "DEMO · Torneo Familia Fase 4",
  en_juego: "DEMO · Fase 4 en juego",
  finalizado: "DEMO · Fase 4 finalizado",
};

/**
 * Demos separadas, cada una fija en su etapa:
 * - `configuracion`: en borrador, lista para configurar (categorías, reglas…).
 * - `en_juego`: 30 equipos inscritos con plantilla y pagos, fase de grupos con
 *   partidos en vivo y página pública activa.
 * - `finalizado`: campeonato terminado, con llaves y podio.
 * Crear de nuevo una variante reemplaza la anterior (no se acumulan).
 */
export async function crearTorneoDemo(
  variante: VarianteDemo = "configuracion",
): Promise<ActionResult<{ id: string }>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };
  const tenantId = acceso.membership.tenant_id;

  // Reemplaza la demo anterior de esta misma variante.
  const svcPrevio = createServiceRoleClient();
  await svcPrevio
    .from("torneos")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("es_demo", true)
    .eq("nombre", NOMBRE_DEMO[variante]);

  const plantilla = await getPlantilla("voleiplaya");
  const reglas = reglasSchema.parse({
    ...plantilla.reglas,
    participacion: {
      ...plantilla.reglas.participacion,
      solo_clientes: true,
      como_verificar_cliente: "número de factura o membresía del parque",
      max_externos: 1,
      max_referentes: 1,
      que_es_referente: "jugador reconocido de liga o selección departamental",
      min_mujeres_cancha: 1,
    },
    premiacion: {
      ...plantilla.reglas.premiacion,
      politica: "minimo_equipos",
      minimo_equipos: 8,
    },
  });

  const svc = createServiceRoleClient();
  const nombre = NOMBRE_DEMO[variante];
  const { data: torneoData, error } = await svc
    .from("torneos")
    .insert({
      tenant_id: tenantId,
      nombre,
      slug_publico: slugify(nombre),
      deporte: "Voleiplaya",
      modalidad: "Arena",
      rama: "mixta",
      formato: plantilla.formato,
      estado: "borrador",
      ciudad: "Garzón, Huila",
      escenario: "Xtreme Park Fase 4",
      fecha_inicio: "2026-11-04",
      fecha_fin: "2026-11-27",
      cierre_inscripciones: "2026-11-03T23:59:00-05:00",
      cupo_equipos: 28,
      minimo_equipos: 8,
      duracion_partido_minutos: 45,
      cantidad_canchas: 2,
      valor_inscripcion: 200_000,
      premiacion_descripcion: "Exclusivo para clientes, más un externo por equipo.",
      plantilla: "voleiplaya",
      es_demo: true,
      reglas,
    })
    .select("*")
    .single();
  if (error) return { success: false, error: error.message };
  const torneo = torneoData as Torneo;

  const categorias: CategoriaInput[] = [
    { nombre: "3 vs 3", jugadores_en_cancha: 3, max_jugadores: 5, cupo_equipos: 12, premios: [900_000, 400_000, 250_000] },
    { nombre: "5 vs 5", jugadores_en_cancha: 5, max_jugadores: 8, cupo_equipos: 16, premios: [1_200_000, 800_000, 500_000] },
  ];
  const rc = await guardarCategoriasTorneo(torneo.id, categorias);
  if (!rc.success) return { success: false, error: rc.error };

  const { data: catsData } = await svc
    .from("categorias_torneo")
    .select("*")
    .eq("torneo_id", torneo.id)
    .order("orden");
  const [tres, cinco] = (catsData as CategoriaTorneo[]) ?? [];

  // Equipos ficticios en distintos estados para mostrar el flujo completo.
  const equipos = [
    { nombre: "Los Arenosos", cat: tres, estado: "confirmado", pagado: 200_000 },
    { nombre: "Saque Fuerte", cat: tres, estado: "confirmado", pagado: 100_000 },
    { nombre: "Red Caliente", cat: tres, estado: "pendiente", pagado: 0 },
    { nombre: "Titanes del Huila", cat: cinco, estado: "confirmado", pagado: 200_000 },
    { nombre: "Bloqueo Total", cat: cinco, estado: "confirmado", pagado: 200_000 },
    { nombre: "Familia Pérez", cat: cinco, estado: "pendiente", pagado: 0 },
  ] as const;
  const { data: equiposCreados } = await svc.from("equipos_torneo").insert(
    equipos.map((e, i) => ({
      tenant_id: tenantId,
      torneo_id: torneo.id,
      categoria_id: e.cat?.id ?? null,
      nombre: e.nombre,
      responsable_nombre: `Capitán de ejemplo ${i + 1}`,
      responsable_telefono: "3000000000",
      estado: e.estado,
      monto_inscripcion: 200_000,
      monto_pagado: e.pagado,
      metodo_pago: null,
      consentimiento_datos: true,
      confirmado_at: e.estado === "confirmado" ? new Date().toISOString() : null,
    })),
  ).select("id, tenant_id, torneo_id, monto_pagado, categoria_id");
  await sembrarJugadoresDemo(
    torneo,
    (equiposCreados as { id: string; categoria_id: string | null }[]) ?? [],
    [tres, cinco].filter(Boolean),
    rngConSemilla(`${torneo.id}-jugadores`),
  );
  await sembrarPagosDemo(
    (equiposCreados as { id: string; tenant_id: string; torneo_id: string; monto_pagado: number }[]) ?? [],
    rngConSemilla(torneo.id),
  );

  await svc.from("gastos_torneo").insert(
    [
      { categoria: "premiacion", descripcion: "Premiación 3 vs 3", valor_total: 1_550_000 },
      { categoria: "premiacion", descripcion: "Premiación 5 vs 5", valor_total: 2_500_000 },
      { categoria: "arbitraje", descripcion: "Árbitros (estimado)", valor_total: 600_000 },
      { categoria: "hidratacion", descripcion: "Agua y frutas", valor_total: 250_000 },
    ].map((g) => ({ ...g, tenant_id: tenantId, torneo_id: torneo.id, pagado: false })),
  );

  const reglamento = await redactarReglamento(torneo, reglas);
  await svc.from("torneos").update({ reglamento }).eq("id", torneo.id);

  // Las variantes avanzadas parten de la misma base y se llevan a su etapa.
  if (variante !== "configuracion") {
    const r = await simularEtapaDemo(torneo.id, variante === "en_juego" ? "grupos" : "finalizado");
    if (!r.success) return { success: false, error: r.error };
  }

  revalidatePath("/admin/torneos");
  return { success: true, data: { id: torneo.id } };
}


// ---------------------------------------------------------------------------
// Simulador de la demo
// ---------------------------------------------------------------------------
export type EtapaDemo = "inscripciones" | "grupos" | "eliminatorias" | "finalizado";

const NOMBRES_DEMO = [
  "Los Arenosos", "Saque Fuerte", "Red Caliente", "Bloqueo Total", "Titanes del Huila",
  "Familia Pérez", "Los Remates", "Playa Garzón", "Sol y Arena", "Club del Saque",
  "Los Tiburones", "Punto de Set", "Mate Final", "Las Águilas", "Furia Opita",
  "Los del Parque", "Arena Roja", "Rally Point", "Doble Toque", "Los Halcones",
  "Volea Brava", "Team Fase 4", "Los Bravos", "Ataque Rápido", "Los Primos",
  "Las Panteras", "Muro de Arena", "Saque y Punto", "Los Recios", "Huila Beach",
];

/**
 * Llena la demo con 30 equipos y la deja en la etapa pedida, con resultados
 * simulados que respetan las reglas (sets, puntos, diferencia de 2):
 * - `inscripciones`: equipos inscribiéndose, unos pagaron y otros deben.
 * - `grupos`: fase de grupos en curso, con partidos en vivo.
 * - `eliminatorias`: grupos cerrados, cuartos jugados y una semifinal en vivo.
 * - `finalizado`: torneo terminado con campeón, subcampeón y tercer puesto.
 * Solo funciona en torneos marcados como demo: borra sus equipos y partidos.
 */
export async function simularEtapaDemo(
  torneoId: string,
  etapa: EtapaDemo,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };
  if (!torneo.es_demo) {
    return { success: false, error: "El simulador solo funciona en torneos de demostración" };
  }

  const svc = createServiceRoleClient();
  const { data: catsData } = await svc
    .from("categorias_torneo")
    .select("*")
    .eq("torneo_id", torneoId)
    .order("orden");
  const categorias = (catsData as CategoriaTorneo[]) ?? [];
  if (categorias.length === 0) {
    return { success: false, error: "Guarda primero las categorías del torneo" };
  }

  // 30 equipos: 14 en la primera categoría y 16 en la segunda (o repartidos).
  const cupos =
    categorias.length === 2
      ? [14, 16]
      : categorias.map((_, i) =>
          Math.floor(30 / categorias.length) + (i < 30 % categorias.length ? 1 : 0),
        );
  for (const [i, c] of categorias.entries()) {
    c.cupo_equipos = cupos[i];
    await svc.from("categorias_torneo").update({ cupo_equipos: cupos[i] }).eq("id", c.id);
  }

  await svc.from("encuentros").delete().eq("torneo_id", torneoId);
  await svc.from("equipos_torneo").delete().eq("torneo_id", torneoId);

  const rng = rngConSemilla(`${torneoId}-${etapa}`);
  const reglas = leerReglas(torneo.reglas);
  const enInscripciones = etapa === "inscripciones";

  // --- Equipos ---
  let n = 0;
  const filasEquipos = categorias.flatMap((c) => {
    const cuantos = enInscripciones ? Math.round(c.cupo_equipos * 0.75) : c.cupo_equipos;
    const valor = inscripcionCategoria(c, torneo);
    return Array.from({ length: cuantos }, () => {
      const i = n++;
      const r = rng();
      // En inscripciones: unos confirmados al día, otros con abono, otros pendientes.
      const estado = enInscripciones && r < 0.25 ? "pendiente" : "confirmado";
      const pagado =
        estado === "pendiente" ? 0 : r < 0.4 ? Math.round(valor / 2) : r < 0.5 && enInscripciones ? 0 : valor;
      return {
        tenant_id: torneo.tenant_id,
        torneo_id: torneoId,
        categoria_id: c.id,
        nombre: NOMBRES_DEMO[i % NOMBRES_DEMO.length],
        responsable_nombre: `Capitán de ejemplo ${i + 1}`,
        responsable_telefono: "3000000000",
        estado,
        monto_inscripcion: valor,
        monto_pagado: pagado,
        metodo_pago: null,
        consentimiento_datos: true,
        confirmado_at: estado === "confirmado" ? new Date().toISOString() : null,
      };
    });
  });
  const { data: equiposData, error: errEquipos } = await svc
    .from("equipos_torneo")
    .insert(filasEquipos)
    .select("id, categoria_id, tenant_id, torneo_id, monto_pagado");
  if (errEquipos) return { success: false, error: errEquipos.message };
  const equipos =
    (equiposData as {
      id: string;
      categoria_id: string;
      tenant_id: string;
      torneo_id: string;
      monto_pagado: number;
    }[]) ?? [];
  await sembrarPagosDemo(equipos, rng);
  await sembrarJugadoresDemo(torneo, equipos, categorias, rng);

  // --- Partidos ---
  const encuentros: Omit<Encuentro, "id" | "created_at" | "updated_at">[] = [];
  if (!enInscripciones) {
    const inicio = new Date(`${torneo.fecha_inicio ?? new Date().toISOString().slice(0, 10)}T17:00:00-05:00`);
    const canchas = Math.max(1, torneo.cantidad_canchas);
    // Franjas por día: cada partido toma la siguiente cancha libre y, cuando se
    // llenan todas, pasa a la hora siguiente. Nunca dos partidos en la misma
    // cancha a la misma hora.
    const franjas = new Map<number, number>();
    const horario = (dia: number) => {
      const franja = franjas.get(dia) ?? 0;
      franjas.set(dia, franja + 1);
      const d = new Date(inicio);
      d.setDate(d.getDate() + dia);
      d.setHours(d.getHours() + Math.floor(franja / canchas));
      return { programado_at: d.toISOString(), cancha: (franja % canchas) + 1 };
    };
    const partido = (
      c: CategoriaTorneo,
      fase: FaseEncuentro,
      a: string | null,
      b: string | null,
      estado: EstadoEncuentro,
      extra: { grupo?: string; ronda?: number; orden: number; dia: number },
    ) => {
      const sets =
        estado === "finalizado"
          ? simularPartido(reglas.juego, rng)
          : estado === "en_vivo"
            ? simularEnVivo(reglas.juego, rng)
            : [];
      const ganaA = sets.filter(([x, y]) => x > y).length > sets.filter(([x, y]) => y > x).length;
      const fila = {
        tenant_id: torneo.tenant_id,
        torneo_id: torneoId,
        categoria_id: c.id,
        fase,
        grupo: extra.grupo ?? null,
        ronda: extra.ronda ?? 1,
        orden: extra.orden,
        equipo_a_id: a,
        equipo_b_id: b,
        ...horario(extra.dia),
        estado,
        sets,
        ganador_id: estado === "finalizado" ? (ganaA ? a : b) : null,
        sala_marcador: null,
      };
      encuentros.push(fila);
      return fila;
    };

    for (const [ci, c] of categorias.entries()) {
      const ids = equipos.filter((e) => e.categoria_id === c.id).map((e) => e.id);
      const grupos = armarGrupos(ids, 4);
      const delGrupo: typeof encuentros = [];
      let enVivo = 0;

      for (const g of grupos) {
        const jornadas = todosContraTodos(g.equipos);
        jornadas.forEach((cruces, r) => {
          cruces.forEach(([a, b], i) => {
            const ultima = r === jornadas.length - 1;
            let estado: EstadoEncuentro = "finalizado";
            if (etapa === "grupos" && ultima) {
              estado = enVivo < canchas ? "en_vivo" : "programado";
              if (estado === "en_vivo") enVivo += 1;
            }
            delGrupo.push(
              partido(c, "grupos", a, b, estado, {
                grupo: g.nombre,
                ronda: r + 1,
                orden: i,
                dia: r * 7 + ci,
              }),
            );
          });
        });
      }
      if (etapa === "grupos") continue;

      // Clasifican los dos primeros de cada grupo.
      const tablas = grupos.map((g) =>
        calcularTabla(
          g.equipos,
          delGrupo.filter((e) => e.grupo === g.nombre),
          reglas.tabla,
        ),
      );
      let ronda: [string | null, string | null][] = crucesEliminatoria(
        tablas.map((t) => t[0]?.equipoId ?? null),
        tablas.map((t) => t[1]?.equipoId ?? null),
      );
      let fase: FaseEncuentro | null = faseEliminatoria(ronda.length * 2);
      const dia = 21 + ci;

      while (fase) {
        const ganadores: (string | null)[] = [];
        const perdedores: (string | null)[] = [];
        for (const [i, [a, b]] of ronda.entries()) {
          let estado: EstadoEncuentro = "finalizado";
          if (etapa === "eliminatorias") {
            if (fase === "final") estado = "programado";
            else if (fase === "semifinal" && i === 1) estado = "en_vivo";
          }
          if (!a || !b) estado = "programado";
          const fila = partido(c, fase, a, b, estado, {
            orden: i,
            dia: fase === "final" ? dia + 2 : dia,
          });
          const ganador = fila.ganador_id;
          ganadores.push(ganador);
          perdedores.push(ganador ? (ganador === a ? b : a) : null);
        }
        if (fase === "semifinal") {
          const finalista = etapa === "eliminatorias" ? "programado" : "finalizado";
          partido(
            c,
            "tercer_puesto",
            perdedores[0],
            perdedores[1],
            perdedores[0] && perdedores[1] ? finalista : "programado",
            { orden: 0, dia: dia + 2 },
          );
          ronda = [[ganadores[0], ganadores[1]]];
          fase = "final";
          continue;
        }
        if (fase === "final") break;
        ronda = Array.from({ length: Math.ceil(ganadores.length / 2) }, (_, i) => [
          ganadores[i * 2] ?? null,
          ganadores[i * 2 + 1] ?? null,
        ]);
        fase = siguienteFase(fase);
      }
    }

    if (encuentros.length > 0) {
      const { error } = await svc.from("encuentros").insert(encuentros);
      if (error) return { success: false, error: error.message };
    }
  }

  const estadoTorneo =
    etapa === "inscripciones" ? "inscripciones" : etapa === "finalizado" ? "finalizado" : "en_curso";
  await svc
    .from("torneos")
    .update({
      estado: estadoTorneo,
      cupo_equipos: cupos.reduce((s, v) => s + v, 0),
      activado_at: torneo.activado_at ?? new Date().toISOString(),
    })
    .eq("id", torneoId);

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Fixture y resultados (torneos reales)
// ---------------------------------------------------------------------------
const opcionesFixtureSchema = z.object({
  /** grupos → luego eliminatorias · liga → todos contra todos · eliminacion → llave directa. */
  modo: z.enum(["grupos", "liga", "eliminacion"]),
  por_grupo: z.number().int().min(3).max(8).default(4),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha del primer partido"),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, "Elige la hora del primer partido"),
  dias_entre_jornadas: z.number().int().min(0).max(30).default(7),
});

export type OpcionesFixture = z.input<typeof opcionesFixtureSchema>;

type FilaEncuentro = Omit<Encuentro, "id" | "created_at" | "updated_at">;

async function encuentrosDeCategoria(
  torneoId: string,
  categoriaId: string | null,
): Promise<Encuentro[]> {
  const svc = createServiceRoleClient();
  let q = svc.from("encuentros").select("*").eq("torneo_id", torneoId);
  q = categoriaId ? q.eq("categoria_id", categoriaId) : q.is("categoria_id", null);
  const { data } = await q;
  return (data as Encuentro[]) ?? [];
}

/** Filas de la llave (con horarios) a partir de los sembrados. */
function filasLlave(
  torneo: Torneo,
  categoriaId: string | null,
  sembrados: string[],
  diaBase: number,
  horario: { fechaInicio: string; horaInicio: string; diasEntreJornadas: number },
): FilaEncuentro[] {
  const llave = armarLlave(sembrados);
  const fases = [...new Set(llave.map((p) => p.fase))];
  // Una jornada por ronda; tercer puesto y final el mismo día.
  const diaDe = (fase: FaseEncuentro) => {
    const ronda = fases.filter((f) => f !== "tercer_puesto").indexOf(fase === "tercer_puesto" ? "final" : fase);
    return diaBase + Math.max(0, ronda) * Math.max(1, horario.diasEntreJornadas);
  };
  const horarios = asignarHorarios(llave.map((p) => diaDe(p.fase)), {
    fechaInicio: horario.fechaInicio,
    horaInicio: horario.horaInicio,
    canchas: torneo.cantidad_canchas,
    duracionMin: torneo.duracion_partido_minutos ?? 45,
  });
  return llave.map((p, i) => {
    // Pase directo: un solo equipo en la primera ronda → gana sin jugar.
    const directo = (p.a && !p.b) || (!p.a && p.b);
    const esPrimera = p.fase === llave[0].fase;
    return {
      tenant_id: torneo.tenant_id,
      torneo_id: torneo.id,
      categoria_id: categoriaId,
      fase: p.fase,
      grupo: null,
      ronda: 1,
      orden: p.orden,
      equipo_a_id: p.a,
      equipo_b_id: p.b,
      ...horarios[i],
      estado: directo && esPrimera ? "wo" : "programado",
      sets: [],
      ganador_id: directo && esPrimera ? (p.a ?? p.b) : null,
      sala_marcador: null,
    };
  });
}

/** Pone al ganador (y al perdedor de semifinal) en el partido que sigue. */
async function avanzarLlave(e: Encuentro): Promise<string | null> {
  if (e.fase === "grupos" || !e.ganador_id) return null;
  const perdedorId = e.ganador_id === e.equipo_a_id ? e.equipo_b_id : e.equipo_a_id;
  const destino = destinoEnLlave(e.fase, e.orden);
  const todos = await encuentrosDeCategoria(e.torneo_id, e.categoria_id);
  const svc = createServiceRoleClient();
  for (const [quien, d] of [
    [e.ganador_id, destino.ganador],
    [perdedorId, destino.perdedor],
  ] as const) {
    if (!d) continue;
    const siguiente = todos.find((m) => m.fase === d.fase && m.orden === d.orden);
    if (!siguiente) continue;
    const columna = d.lado === "a" ? "equipo_a_id" : "equipo_b_id";
    if (siguiente[columna] === quien) continue;
    if (siguiente.estado !== "programado") {
      return "El partido siguiente de la llave ya empezó: corrige primero ese resultado.";
    }
    await svc.from("encuentros").update({ [columna]: quien }).eq("id", siguiente.id);
  }
  return null;
}

/**
 * Genera el fixture de una categoría con los equipos CONFIRMADOS: grupos
 * (luego eliminatorias), liga o eliminación directa, con fecha, hora y cancha.
 * Se puede rehacer mientras no haya resultados.
 */
export async function generarFixture(
  torneoId: string,
  categoriaId: string | null,
  input: OpcionesFixture,
): Promise<ActionResult<{ partidos: number }>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };
  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const parsed = opcionesFixtureSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const o = parsed.data;

  const existentes = await encuentrosDeCategoria(torneoId, categoriaId);
  if (existentes.some((e) => e.estado === "en_vivo" || (e.estado === "finalizado" && e.sets.length > 0))) {
    return { success: false, error: "Ya hay partidos jugados: el fixture no se puede rehacer." };
  }

  const svc = createServiceRoleClient();
  let q = svc.from("equipos_torneo").select("id").eq("torneo_id", torneoId).eq("estado", "confirmado");
  q = categoriaId ? q.eq("categoria_id", categoriaId) : q;
  const { data: equiposData } = await q.order("confirmado_at");
  const ids = ((equiposData as { id: string }[]) ?? []).map((e) => e.id);
  if (ids.length < 2) {
    return { success: false, error: "Se necesitan al menos 2 equipos confirmados para armar el fixture." };
  }

  const horario = {
    fechaInicio: o.fecha_inicio,
    horaInicio: o.hora_inicio,
    diasEntreJornadas: o.dias_entre_jornadas,
  };
  let filas: FilaEncuentro[] = [];

  if (o.modo === "eliminacion") {
    filas = filasLlave(torneo, categoriaId, ids, 0, horario);
  } else {
    const grupos = o.modo === "liga" ? [{ nombre: "A", equipos: ids }] : armarGrupos(ids, o.por_grupo);
    const base: Omit<FilaEncuentro, "programado_at" | "cancha">[] = [];
    const dias: number[] = [];
    for (const g of grupos) {
      todosContraTodos(g.equipos).forEach((cruces, r) => {
        cruces.forEach(([a, b], i) => {
          base.push({
            tenant_id: torneo.tenant_id,
            torneo_id: torneo.id,
            categoria_id: categoriaId,
            fase: "grupos",
            grupo: o.modo === "liga" ? null : g.nombre,
            ronda: r + 1,
            orden: i,
            equipo_a_id: a,
            equipo_b_id: b,
            estado: "programado",
            sets: [],
            ganador_id: null,
            sala_marcador: null,
          });
          dias.push(r * o.dias_entre_jornadas);
        });
      });
    }
    const horarios = asignarHorarios(dias, {
      fechaInicio: o.fecha_inicio,
      horaInicio: o.hora_inicio,
      canchas: torneo.cantidad_canchas,
      duracionMin: torneo.duracion_partido_minutos ?? 45,
    });
    filas = base.map((f, i) => ({ ...f, ...horarios[i] }));
  }

  let del = svc.from("encuentros").delete().eq("torneo_id", torneoId);
  del = categoriaId ? del.eq("categoria_id", categoriaId) : del.is("categoria_id", null);
  await del;
  const { data: creados, error } = await svc.from("encuentros").insert(filas).select("*");
  if (error) return { success: false, error: error.message };

  // Los pases directos avanzan solos a la ronda siguiente.
  for (const e of ((creados as Encuentro[]) ?? []).filter((m) => m.estado === "wo")) {
    await avanzarLlave(e);
  }
  if (torneo.estado === "inscripciones") {
    await svc.from("torneos").update({ estado: "programado" }).eq("id", torneoId);
  }

  revalidarTorneo(torneo);
  return { success: true, data: { partidos: filas.length } };
}

/**
 * Cuando terminan los grupos: arma la llave con los mejores de cada grupo
 * (primeros, luego segundos…) según la tabla calculada con las reglas.
 */
export async function generarEliminatorias(
  torneoId: string,
  categoriaId: string | null,
  clasificanPorGrupo: number,
  fechaInicio: string,
  horaInicio: string,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };
  const torneo = await torneoDelUsuario(torneoId, acceso.membership);
  if (!torneo) return { success: false, error: "Torneo no encontrado" };

  const todos = await encuentrosDeCategoria(torneoId, categoriaId);
  const deGrupos = todos.filter((e) => e.fase === "grupos");
  if (deGrupos.length === 0) return { success: false, error: "Primero genera la fase de grupos." };
  if (todos.some((e) => e.fase !== "grupos")) {
    return { success: false, error: "Las eliminatorias ya fueron generadas." };
  }
  const pendientes = deGrupos.filter((e) => e.estado !== "finalizado" && e.estado !== "wo").length;
  if (pendientes > 0) {
    return { success: false, error: `Faltan ${pendientes} partido(s) de grupos por terminar.` };
  }

  const reglas = leerReglas(torneo.reglas);
  const grupos = [...new Set(deGrupos.map((e) => e.grupo ?? ""))].sort();
  const tablas = grupos.map((g) => {
    const partidos = deGrupos.filter((e) => (e.grupo ?? "") === g);
    const ids = [...new Set(partidos.flatMap((e) => [e.equipo_a_id, e.equipo_b_id]).filter(Boolean))] as string[];
    return calcularTabla(ids, partidos, reglas.tabla);
  });
  const sembrados: string[] = [];
  for (let puesto = 0; puesto < Math.max(1, clasificanPorGrupo); puesto++) {
    for (const t of tablas) if (t[puesto]) sembrados.push(t[puesto].equipoId);
  }
  if (sembrados.length < 2) return { success: false, error: "No hay suficientes clasificados." };

  const filas = filasLlave(torneo, categoriaId, sembrados, 0, {
    fechaInicio,
    horaInicio,
    diasEntreJornadas: 1,
  });
  const svc = createServiceRoleClient();
  const { data: creados, error } = await svc.from("encuentros").insert(filas).select("*");
  if (error) return { success: false, error: error.message };
  for (const e of ((creados as Encuentro[]) ?? []).filter((m) => m.estado === "wo")) {
    await avanzarLlave(e);
  }

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

const resultadoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("sets"),
    sets: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])).max(5),
    /** `en_vivo` guarda el parcial; `finalizado` cierra el partido. */
    estado: z.enum(["en_vivo", "finalizado"]),
  }),
  /** El equipo `ganador` gana porque el otro no se presentó. */
  z.object({ tipo: z.literal("wo"), ganador: z.enum(["a", "b"]) }),
  /** Vuelve el partido a "programado" (borra el marcador). */
  z.object({ tipo: z.literal("reiniciar") }),
]);

export type ResultadoInput = z.input<typeof resultadoSchema>;

/**
 * Guarda el marcador de un partido validándolo con las reglas del torneo.
 * Al finalizar un partido de la llave, el ganador pasa solo al siguiente (y
 * el perdedor de semifinal, al tercer puesto).
 */
export async function guardarResultado(
  encuentroId: string,
  input: ResultadoInput,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const parsed = resultadoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const svc = createServiceRoleClient();
  const { data } = await svc.from("encuentros").select("*").eq("id", encuentroId).maybeSingle();
  const e = (data as Encuentro | null) ?? null;
  if (!e) return { success: false, error: "Partido no encontrado" };
  const torneo = await torneoDelUsuario(e.torneo_id, acceso.membership);
  if (!torneo) return { success: false, error: "No autorizado" };
  if (!e.equipo_a_id || !e.equipo_b_id) {
    return { success: false, error: "El cruce todavía no está definido." };
  }

  let cambios: Partial<Encuentro>;
  if (d.tipo === "reiniciar") {
    cambios = { estado: "programado", sets: [], ganador_id: null };
  } else if (d.tipo === "wo") {
    cambios = {
      estado: "wo",
      sets: [],
      ganador_id: d.ganador === "a" ? e.equipo_a_id : e.equipo_b_id,
    };
  } else {
    const sets = d.sets.filter(([a, b]) => a > 0 || b > 0) as [number, number][];
    const problema = validarSets(sets, leerReglas(torneo.reglas).juego, d.estado === "finalizado");
    if (problema) return { success: false, error: problema };
    const ganaA = sets.filter(([a, b]) => a > b).length > sets.filter(([a, b]) => b > a).length;
    cambios = {
      estado: d.estado,
      sets,
      ganador_id: d.estado === "finalizado" ? (ganaA ? e.equipo_a_id : e.equipo_b_id) : null,
    };
  }

  // En la llave no se puede cambiar un ganador si el siguiente partido ya empezó.
  const actualizado = { ...e, ...cambios } as Encuentro;
  if (e.fase !== "grupos" && e.ganador_id && e.ganador_id !== actualizado.ganador_id) {
    const destino = destinoEnLlave(e.fase, e.orden).ganador;
    const todos = await encuentrosDeCategoria(e.torneo_id, e.categoria_id);
    const sig = destino && todos.find((m) => m.fase === destino.fase && m.orden === destino.orden);
    if (sig && sig.estado !== "programado") {
      return { success: false, error: "El partido siguiente de la llave ya empezó: corrige primero ese resultado." };
    }
  }

  const { error } = await svc.from("encuentros").update(cambios).eq("id", encuentroId);
  if (error) return { success: false, error: error.message };

  // Si el partido de la llave quedó sin ganador, se libera su lugar en el siguiente.
  if (e.fase !== "grupos" && e.ganador_id && !actualizado.ganador_id) {
    const perdedorAntes = e.ganador_id === e.equipo_a_id ? e.equipo_b_id : e.equipo_a_id;
    const destino = destinoEnLlave(e.fase, e.orden);
    const todos = await encuentrosDeCategoria(e.torneo_id, e.categoria_id);
    for (const [quien, d] of [
      [e.ganador_id, destino.ganador],
      [perdedorAntes, destino.perdedor],
    ] as const) {
      const sig = d && todos.find((m) => m.fase === d.fase && m.orden === d.orden);
      if (!d || !sig) continue;
      const columna = d.lado === "a" ? "equipo_a_id" : "equipo_b_id";
      if (sig[columna] === quien) await svc.from("encuentros").update({ [columna]: null }).eq("id", sig.id);
    }
  }

  const errAvance = await avanzarLlave(actualizado);
  if (errAvance) return { success: false, error: errAvance };

  // El torneo pasa a "en curso" con el primer partido jugado.
  if (torneo.estado === "inscripciones" || torneo.estado === "programado") {
    await svc.from("torneos").update({ estado: "en_curso" }).eq("id", torneo.id);
  }

  revalidarTorneo(torneo);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Marcador en vivo (dc-sport-score)
// ---------------------------------------------------------------------------
/** Partido + torneo verificando acceso, con los nombres de los dos equipos. */
async function partidoDelUsuario(encuentroId: string, membership: Membership) {
  const svc = createServiceRoleClient();
  const { data } = await svc.from("encuentros").select("*").eq("id", encuentroId).maybeSingle();
  const e = (data as Encuentro | null) ?? null;
  if (!e || !e.equipo_a_id || !e.equipo_b_id) return null;
  const torneo = await torneoDelUsuario(e.torneo_id, membership);
  if (!torneo) return null;
  const { data: eqs } = await svc
    .from("equipos_torneo")
    .select("id, nombre")
    .in("id", [e.equipo_a_id, e.equipo_b_id]);
  const nombre = (id: string) =>
    ((eqs as { id: string; nombre: string }[]) ?? []).find((x) => x.id === id)?.nombre ?? "Equipo";
  return { e, torneo, nombreA: nombre(e.equipo_a_id), nombreB: nombre(e.equipo_b_id) };
}

/**
 * Prepara el marcador del partido para el juez: crea la sala en
 * dc-sport-score con los equipos y las reglas del torneo, deja el partido "en
 * vivo" y devuelve los enlaces del juez y de la pantalla.
 */
export async function abrirMarcador(
  encuentroId: string,
): Promise<ActionResult<ReturnType<typeof enlacesMarcador>>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };
  if (!marcadorDisponible()) {
    return { success: false, error: "El marcador en vivo no está configurado (DC_SPORT_SCORE_URL)." };
  }
  const p = await partidoDelUsuario(encuentroId, acceso.membership);
  if (!p) return { success: false, error: "Partido no encontrado o sin equipos definidos" };
  if (p.e.estado === "finalizado" || p.e.estado === "wo") {
    return { success: false, error: "Este partido ya terminó." };
  }

  const sala = p.e.sala_marcador ?? salaDePartido(p.e.id);
  const err = await crearSalaMarcador(sala, p.nombreA, p.nombreB, leerReglas(p.torneo.reglas).juego);
  if (err) return { success: false, error: err };

  const svc = createServiceRoleClient();
  await svc
    .from("encuentros")
    .update({ sala_marcador: sala, estado: "en_vivo" })
    .eq("id", p.e.id);
  if (p.torneo.estado === "inscripciones" || p.torneo.estado === "programado") {
    await svc.from("torneos").update({ estado: "en_curso" }).eq("id", p.torneo.id);
  }

  revalidarTorneo(p.torneo);
  return { success: true, data: enlacesMarcador(sala) };
}

/**
 * Trae lo que lleva el juez en el marcador para que el organizador lo revise.
 * NO guarda nada: el resultado oficial se confirma (o se corrige) en el panel.
 */
export async function traerMarcador(
  encuentroId: string,
): Promise<ActionResult<{ sets: [number, number][]; terminado: boolean; enlaces: ReturnType<typeof enlacesMarcador> }>> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };
  const p = await partidoDelUsuario(encuentroId, acceso.membership);
  if (!p) return { success: false, error: "Partido no encontrado" };
  if (!p.e.sala_marcador) {
    return { success: false, error: "Este partido no tiene marcador abierto." };
  }
  const leido = await leerMarcador(p.e.sala_marcador, 5000);
  if (!leido) return { success: false, error: "No se pudo leer el marcador. ¿Está encendido?" };
  return { success: true, data: { ...leido, enlaces: enlacesMarcador(p.e.sala_marcador) } };
}
