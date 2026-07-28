"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMembership } from "@/lib/auth";
import { resolverActivacion } from "@/lib/planes";
import { tieneProductoHabilitado } from "@/lib/productos";
import {
  calcularDashboardTorneo,
  construirEquiposPublicos,
  equiposVigentes,
  ESTADOS_TORNEO_PUBLICOS,
  premiosOrdenados,
  validarViabilidadTorneo,
} from "@/lib/torneos";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  AlertaTorneo,
  DashboardTorneo,
  EquipoTorneo,
  EquipoTorneoPublico,
  GastoTorneo,
  Membership,
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
  monto_pagado: z.number().int().min(0),
  metodo_pago: z.enum(["efectivo", "transferencia"]).nullable().optional(),
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
  const [{ data: equipos }, { data: gastos }, { data: premios }] = await Promise.all([
    svc.from("equipos_torneo").select("*").eq("torneo_id", id).order("created_at"),
    svc.from("gastos_torneo").select("*").eq("torneo_id", id).order("created_at"),
    svc.from("premios_torneo").select("*").eq("torneo_id", id).order("puesto"),
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

  const svc = createServiceRoleClient();
  await svc.from("premios_torneo").delete().eq("torneo_id", torneoId);

  if (parsed.data.length > 0) {
    const ordenados = [...parsed.data].sort((a, b) => a.puesto - b.puesto);
    const { error } = await svc.from("premios_torneo").insert(
      ordenados.map((p, i) => ({
        torneo_id: torneoId,
        tenant_id: torneo.tenant_id,
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
  input: z.infer<typeof equipoSchema>,
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
  if (equiposVigentes((existentes as EquipoTorneo[]) ?? []).length >= torneo.cupo_equipos) {
    return { success: false, error: "El torneo ya llegó a su cupo de equipos" };
  }

  const { data, error } = await svc
    .from("equipos_torneo")
    .insert({
      torneo_id: torneoId,
      tenant_id: torneo.tenant_id,
      nombre: d.nombre,
      escudo_url: d.escudo_url ?? null,
      responsable_nombre: d.responsable_nombre ?? null,
      responsable_telefono: d.responsable_telefono ?? null,
      responsable_correo: d.responsable_correo ?? null,
      cantidad_jugadores: d.cantidad_jugadores ?? null,
      monto_inscripcion: d.monto_inscripcion ?? torneo.valor_inscripcion,
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

  revalidarTorneo(torneo);
  return { success: true, data: { id: (data as { id: string }).id } };
}

/** Edita los datos de un equipo inscrito. */
export async function actualizarEquipoTorneo(
  id: string,
  input: z.infer<typeof equipoSchema>,
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

/** Registra el pago (total o parcial) de la inscripción de un equipo. */
export async function marcarPagoEquipo(
  id: string,
  input: z.infer<typeof pagoEquipoSchema>,
): Promise<ActionResult> {
  const acceso = await accesoTorneos();
  if (!acceso.ok) return { success: false, error: acceso.error };

  const parsed = pagoEquipoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

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

  const { error } = await svc
    .from("equipos_torneo")
    .update({
      monto_pagado: d.monto_pagado,
      metodo_pago: d.metodo_pago ?? null,
      comprobante_url: d.comprobante_url ?? null,
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidarTorneo(torneo);
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
  ] = await Promise.all([
    svc.from("equipos_torneo").select("*").eq("torneo_id", torneo.id).order("created_at"),
    svc
      .from("premios_torneo")
      .select("puesto, tipo, descripcion, valor")
      .eq("torneo_id", torneo.id)
      .order("puesto"),
    svc
      .from("tenant_pago_config")
      .select("*")
      .eq("tenant_id", torneo.tenant_id)
      .maybeSingle(),
    svc.from("tenants").select("nombre").eq("id", torneo.tenant_id).maybeSingle(),
  ]);

  const equipos = (equiposData as EquipoTorneo[]) ?? [];
  const vigentes = equiposVigentes(equipos);

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
      equipos: construirEquiposPublicos(equipos),
      equiposConfirmados: vigentes.filter((e) => e.estado === "confirmado").length,
      cuposDisponibles: Math.max(0, torneo.cupo_equipos - vigentes.length),
      inscripcionesAbiertas: inscripcionesVigentes(torneo, vigentes.length),
      pago: (pagoData as TenantPagoConfig | null) ?? null,
      organizador: (tenantData as { nombre: string } | null)?.nombre ?? "El organizador",
    },
  };
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
  consentimiento: z.literal(true, {
    error: "Debes aceptar el tratamiento de datos",
  }),
});

/**
 * Inscripción pública de un equipo (sin cuenta). Entra SIEMPRE como
 * `pendiente` y sin pago: confirmar el cupo y registrar el dinero son
 * decisiones del organizador.
 */
export async function inscribirEquipoPublico(
  slug: string,
  input: z.infer<typeof inscripcionSchema>,
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

  const { error } = await svc.from("equipos_torneo").insert({
    torneo_id: torneo.id,
    tenant_id: torneo.tenant_id,
    nombre: d.nombre,
    responsable_nombre: d.responsable_nombre,
    responsable_telefono: d.responsable_telefono,
    responsable_correo: d.responsable_correo || null,
    cantidad_jugadores: d.cantidad_jugadores ?? null,
    monto_inscripcion: torneo.valor_inscripcion,
    estado: "pendiente",
    consentimiento_datos: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya hay un equipo inscrito con ese nombre" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath(`/t/${slug}`);
  revalidatePath(`/admin/torneos/${torneo.id}`);
  // La respuesta solo devuelve lo que el propio visitante escribió.
  return { success: true, data: { nombre: d.nombre } };
}
