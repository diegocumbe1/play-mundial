"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { resolverGanadores } from "@/lib/rifa";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Boleta,
  BoletaPublica,
  Ganador,
  GanadorPublico,
  Membership,
  Premio,
  Rifa,
  TenantPagoConfig,
} from "@/types";
import { enmascararNombre } from "@/lib/rifa";

/**
 * Server Actions de la vertical de rifas. Reglas clave:
 * - Mutaciones del owner: validan membresía antes de tocar nada.
 * - Todo lo PÚBLICO (ver rifa, reservar) pasa por service role y devuelve solo
 *   un corte seguro (nunca nombre/teléfono/estado real de otras boletas).
 * - `activarRifa` aplica la cuota/plan (capa gratuita) antes de publicar.
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
  return `${base || "rifa"}-${sufijo}`;
}

async function requireMembership(): Promise<Membership | null> {
  return getMembership();
}

const rifaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  descripcion: z.string().trim().nullable().optional(),
  tipo: z.enum(["interna", "loteria"]),
  precio_boleta: z.number().int().min(0),
  cantidad_numeros: z.number().int().min(2).max(10000),
  formato_cifras: z.union([z.literal(2), z.literal(3)]),
  solo_pagadas_juegan: z.boolean().default(true),
  tema: z.enum(["rosa", "clasico", "esmeralda", "oceano", "durazno"]).default("rosa"),
  decoracion: z.enum(["ninguna", "floral", "hojas", "geometrico", "confeti"]).default("floral"),
  loteria: z.string().trim().nullable().optional(),
  loteria_url: z.string().trim().nullable().optional(),
  fecha_loteria: z.string().trim().nullable().optional(),
  modo_cifras: z.enum(["primeras_dos", "ultimas_dos", "ambas"]).nullable().optional(),
  fecha_sorteo: z.string().trim().nullable().optional(),
  /** Solo superadmin: delegar la rifa a otro organizador. */
  tenant_id: z.string().uuid().nullable().optional(),
});

const premioSchema = z.object({
  tipo: z.enum(["valor", "producto"]),
  descripcion: z.string().trim().min(1, "Describe el premio"),
  valor: z.number().int().min(0).nullable().optional(),
  cantidad_ganadores: z.number().int().min(1).default(1),
  criterio: z.enum(["primeras_2", "ultimas_2"]).nullable().optional(),
  orden: z.number().int().min(1).default(1),
});

// ---------------------------------------------------------------------------
// Lectura (owner)
// ---------------------------------------------------------------------------
/** Rifas del tenant del usuario. */
export async function getRifas(): Promise<ActionResult<Rifa[]>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rifas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as Rifa[]) ?? [] };
}

export interface RifaDetalle {
  rifa: Rifa;
  premios: Premio[];
  boletas: Boleta[];
  ganadores: Ganador[];
}

/** Rifa + premios + boletas + ganadores (con datos sensibles: solo owner). */
export async function getRifa(id: string): Promise<ActionResult<RifaDetalle>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data: rifa, error } = await supabase
    .from("rifas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!rifa) return { success: false, error: "Rifa no encontrada" };

  const [{ data: premios }, { data: boletas }, { data: ganadores }] =
    await Promise.all([
      supabase.from("premios").select("*").eq("rifa_id", id).order("orden"),
      supabase.from("boletas").select("*").eq("rifa_id", id).order("numero"),
      supabase.from("ganadores").select("*").eq("rifa_id", id),
    ]);

  return {
    success: true,
    data: {
      rifa: rifa as Rifa,
      premios: (premios as Premio[]) ?? [],
      boletas: (boletas as Boleta[]) ?? [],
      ganadores: (ganadores as Ganador[]) ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// CRUD (owner)
// ---------------------------------------------------------------------------
/** Crea una rifa en estado borrador para el tenant del usuario. */
export async function crearRifa(
  input: z.infer<typeof rifaSchema>,
): Promise<ActionResult<{ id: string }>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const parsed = rifaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  // Delegación: por defecto la rifa queda en el tenant del creador. El superadmin
  // puede asignarla a otro organizador (para que no quede atada a él).
  let tenantId = membership.tenant_id;
  if (d.tenant_id && d.tenant_id !== membership.tenant_id) {
    if (!(await esSuperadmin())) {
      return { success: false, error: "No puedes asignar la rifa a otro organizador" };
    }
    tenantId = d.tenant_id;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rifas")
    .insert({
      tenant_id: tenantId,
      nombre: d.nombre,
      descripcion: d.descripcion ?? null,
      tipo: d.tipo,
      estado: "borrador",
      precio_boleta: d.precio_boleta,
      cantidad_numeros: d.cantidad_numeros,
      formato_cifras: d.formato_cifras,
      solo_pagadas_juegan: d.solo_pagadas_juegan,
      tema: d.tema,
      decoracion: d.decoracion,
      slug_publico: slugify(d.nombre),
      loteria: d.tipo === "loteria" ? (d.loteria ?? null) : null,
      loteria_url: d.tipo === "loteria" ? (d.loteria_url || null) : null,
      fecha_loteria: d.tipo === "loteria" ? (d.fecha_loteria ?? null) : null,
      modo_cifras: d.tipo === "loteria" ? (d.modo_cifras ?? null) : null,
      fecha_sorteo: d.fecha_sorteo ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/rifas");
  return { success: true, data: { id: (data as { id: string }).id } };
}

/** Actualiza campos editables de una rifa (mientras no esté sorteada). */
export async function actualizarRifa(
  id: string,
  input: z.infer<typeof rifaSchema>,
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const parsed = rifaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();

  // No permitir reducir la cantidad de números por debajo de los ya vendidos.
  const { count } = await supabase
    .from("boletas")
    .select("id", { count: "exact", head: true })
    .eq("rifa_id", id)
    .gte("numero", d.cantidad_numeros);
  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: "No puedes reducir la cantidad: hay números vendidos por encima de ese límite.",
    };
  }

  const { error } = await supabase
    .from("rifas")
    .update({
      nombre: d.nombre,
      descripcion: d.descripcion ?? null,
      tipo: d.tipo,
      precio_boleta: d.precio_boleta,
      cantidad_numeros: d.cantidad_numeros,
      formato_cifras: d.formato_cifras,
      solo_pagadas_juegan: d.solo_pagadas_juegan,
      tema: d.tema,
      decoracion: d.decoracion,
      loteria: d.tipo === "loteria" ? (d.loteria ?? null) : null,
      loteria_url: d.tipo === "loteria" ? (d.loteria_url || null) : null,
      fecha_loteria: d.tipo === "loteria" ? (d.fecha_loteria ?? null) : null,
      modo_cifras: d.tipo === "loteria" ? (d.modo_cifras ?? null) : null,
      fecha_sorteo: d.fecha_sorteo ?? null,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/admin/rifas/${id}`);
  return { success: true, data: undefined };
}

/** Reemplaza los premios de una rifa. */
export async function guardarPremios(
  rifaId: string,
  premios: z.infer<typeof premioSchema>[],
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const parsed = z.array(premioSchema).safeParse(premios);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  await supabase.from("premios").delete().eq("rifa_id", rifaId);

  if (parsed.data.length > 0) {
    const { error } = await supabase.from("premios").insert(
      parsed.data.map((p, i) => ({
        rifa_id: rifaId,
        tipo: p.tipo,
        descripcion: p.descripcion,
        valor: p.tipo === "valor" ? (p.valor ?? 0) : null,
        cantidad_ganadores: p.cantidad_ganadores,
        criterio: p.criterio ?? null,
        orden: p.orden ?? i + 1,
      })),
    );
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/admin/rifas/${rifaId}`);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Activación con cuota/plan (capa gratuita)
// ---------------------------------------------------------------------------
/**
 * Activa una rifa aplicando la monetización:
 * - Si el tenant tiene suscripción vigente → activa como `suscripcion`.
 * - Si califica a la capa gratuita (tamaño ≤ tope y no superó la cuota) → `gratis`.
 * - Si no → crea un cobro pendiente (pago por rifa) y la deja en borrador.
 */
export async function activarRifa(
  id: string,
): Promise<ActionResult<{ activada: boolean; pendiente?: boolean; monto?: number }>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const svc = createServiceRoleClient();

  const { data: rifa } = await svc
    .from("rifas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };
  const r = rifa as Rifa;
  if (r.tenant_id !== membership.tenant_id && membership.rol !== "superadmin") {
    return { success: false, error: "No autorizado" };
  }
  if (r.estado !== "borrador") {
    return { success: false, error: "La rifa ya fue activada" };
  }

  const [{ data: tenant }, { data: cfg }] = await Promise.all([
    svc.from("tenants").select("*").eq("id", r.tenant_id).maybeSingle(),
    svc.from("plataforma_config").select("*").limit(1).maybeSingle(),
  ]);

  const config = cfg as {
    precio_rifa_100: number;
    precio_rifa_500: number;
    free_rifas_por_mes: number;
    free_rifas_total: number;
    free_max_numeros: number;
  } | null;

  // 1) Suscripción vigente
  const venceAt = (tenant as { suscripcion_vence_at: string | null })?.suscripcion_vence_at;
  if (venceAt && new Date(venceAt).getTime() > Date.now()) {
    await svc
      .from("rifas")
      .update({ estado: "activa", cobro_tipo: "suscripcion", activada_at: new Date().toISOString() })
      .eq("id", id);
    revalidatePath(`/admin/rifas/${id}`);
    return { success: true, data: { activada: true } };
  }

  // 2) Capa gratuita (tamaño ≤ tope y dentro de la cuota)
  const maxNum = config?.free_max_numeros ?? 100;
  const freeTotal = config?.free_rifas_total ?? 2;
  const freeMes = config?.free_rifas_por_mes ?? 1;

  if (r.cantidad_numeros <= maxNum) {
    const { data: gratisRifas } = await svc
      .from("rifas")
      .select("activada_at")
      .eq("tenant_id", r.tenant_id)
      .eq("cobro_tipo", "gratis");
    const usadas = gratisRifas ?? [];
    const ahora = new Date();
    const esteMes = usadas.filter((g) => {
      const f = (g as { activada_at: string | null }).activada_at;
      if (!f) return false;
      const d = new Date(f);
      return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
    }).length;

    if (usadas.length < freeTotal && esteMes < freeMes) {
      await svc
        .from("rifas")
        .update({ estado: "activa", cobro_tipo: "gratis", activada_at: new Date().toISOString() })
        .eq("id", id);
      revalidatePath(`/admin/rifas/${id}`);
      return { success: true, data: { activada: true } };
    }
  }

  // 3) Requiere pago: crea cobro pendiente, la rifa sigue en borrador
  const monto =
    r.cantidad_numeros <= 100
      ? (config?.precio_rifa_100 ?? 0)
      : (config?.precio_rifa_500 ?? 0);

  await svc.from("cobros").insert({
    tenant_id: r.tenant_id,
    rifa_id: r.id,
    tipo: "pago_rifa",
    monto,
    estado: "pendiente",
  });

  revalidatePath(`/admin/rifas/${id}`);
  return { success: true, data: { activada: false, pendiente: true, monto } };
}

/**
 * Reasigna una rifa YA creada a otro organizador. Solo superadmin.
 *
 * Mueve también las boletas: llevan su propio `tenant_id` y es el que usa la
 * RLS, así que si no se actualizan el nuevo owner no vería sus ventas.
 */
export async function reasignarRifa(
  rifaId: string,
  tenantId: string,
): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "Solo el superadmin puede reasignar rifas" };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc.from("rifas").update({ tenant_id: tenantId }).eq("id", rifaId);
  if (error) return { success: false, error: error.message };

  const { error: errBoletas } = await svc
    .from("boletas")
    .update({ tenant_id: tenantId })
    .eq("rifa_id", rifaId);
  if (errBoletas) return { success: false, error: errBoletas.message };

  revalidatePath(`/admin/rifas/${rifaId}`);
  revalidatePath("/admin/rifas");
  return { success: true, data: undefined };
}

/** Cambia el estado de una rifa (cerrar ventas, reabrir, marcar pagada). */
export async function cambiarEstadoRifa(
  id: string,
  estado: "activa" | "cerrada" | "pagada" | "cancelada",
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { error } = await supabase.from("rifas").update({ estado }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/admin/rifas/${id}`);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Boletas (owner)
// ---------------------------------------------------------------------------
const registrarBoletaSchema = z.object({
  rifa_id: z.string().uuid(),
  numero: z.number().int().min(0),
  comprador_nombre: z.string().trim().min(1, "Nombre obligatorio"),
  comprador_telefono: z
    .string()
    .trim()
    .regex(/^[+()\d\s.-]{7,20}$/, "Teléfono inválido")
    .nullable()
    .optional(),
  pagado: z.boolean().default(false),
  metodo_pago: z.enum(["efectivo", "transferencia"]).nullable().optional(),
  nota: z.string().trim().nullable().optional(),
});

/** El owner registra manualmente un número (apartado o pagado). */
export async function registrarBoletaAdmin(
  input: z.infer<typeof registrarBoletaSchema>,
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const parsed = registrarBoletaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("boletas").insert({
    rifa_id: d.rifa_id,
    tenant_id: membership.tenant_id,
    numero: d.numero,
    estado: d.pagado ? "pagado" : "reservado",
    comprador_nombre: d.comprador_nombre,
    comprador_telefono: d.comprador_telefono ?? null,
    metodo_pago: d.pagado ? (d.metodo_pago ?? null) : null,
    nota: d.nota ?? null,
    pagado_at: d.pagado ? new Date().toISOString() : null,
  });

  if (error) {
    const msg = error.code === "23505" ? "Ese número ya está tomado" : error.message;
    return { success: false, error: msg };
  }
  revalidatePath(`/admin/rifas/${d.rifa_id}`);
  return { success: true, data: undefined };
}

const editarBoletaSchema = z.object({
  comprador_nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  comprador_telefono: z
    .string()
    .trim()
    .regex(/^[+()\d\s.-]{7,20}$/, "Teléfono inválido")
    .nullable()
    .optional(),
});

/** Corrige los datos del comprador de una boleta (nombre mal escrito, teléfono). */
export async function actualizarBoleta(
  boletaId: string,
  input: z.infer<typeof editarBoletaSchema>,
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const parsed = editarBoletaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boletas")
    .update({
      comprador_nombre: parsed.data.comprador_nombre,
      comprador_telefono: parsed.data.comprador_telefono || null,
    })
    .eq("id", boletaId)
    .select("rifa_id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (data) revalidatePath(`/admin/rifas/${(data as { rifa_id: string }).rifa_id}`);
  return { success: true, data: undefined };
}

/** Marca una boleta como pagada (o revierte a reservada). */
export async function marcarPagoBoleta(
  boletaId: string,
  pagado: boolean,
  metodo: "efectivo" | "transferencia" | null = null,
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boletas")
    .update({
      estado: pagado ? "pagado" : "reservado",
      metodo_pago: pagado ? metodo : null,
      pagado_at: pagado ? new Date().toISOString() : null,
    })
    .eq("id", boletaId)
    .select("rifa_id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (data) revalidatePath(`/admin/rifas/${(data as { rifa_id: string }).rifa_id}`);
  return { success: true, data: undefined };
}

/** Libera un número (borra la boleta → vuelve a estar libre). */
export async function liberarBoleta(boletaId: string): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("boletas")
    .select("rifa_id")
    .eq("id", boletaId)
    .maybeSingle();
  const { error } = await supabase.from("boletas").delete().eq("id", boletaId);
  if (error) return { success: false, error: error.message };
  if (data) revalidatePath(`/admin/rifas/${(data as { rifa_id: string }).rifa_id}`);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Sorteo
// ---------------------------------------------------------------------------
/** Ingresa el resultado de la lotería y resuelve ganadores (auto-match). */
export async function ingresarResultadoLoteria(
  rifaId: string,
  resultado: string,
): Promise<ActionResult<{ ganadores: number; sinVender: number }>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const limpio = resultado.replace(/\D/g, "");
  if (!limpio) return { success: false, error: "Ingresa el número ganador de la lotería" };

  const supabase = await createClient();
  const { data: rifa } = await supabase.from("rifas").select("*").eq("id", rifaId).maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };

  const [{ data: premios }, { data: boletas }] = await Promise.all([
    supabase.from("premios").select("*").eq("rifa_id", rifaId).order("orden"),
    supabase.from("boletas").select("*").eq("rifa_id", rifaId),
  ]);

  const resueltos = resolverGanadores(
    rifa as Rifa,
    (premios as Premio[]) ?? [],
    (boletas as Boleta[]) ?? [],
    limpio,
  );

  await supabase.from("ganadores").delete().eq("rifa_id", rifaId);
  const conBoleta = resueltos.filter((g) => g.boleta_id !== null);
  if (conBoleta.length > 0) {
    await supabase.from("ganadores").insert(
      conBoleta.map((g) => ({
        rifa_id: rifaId,
        premio_id: g.premio_id,
        boleta_id: g.boleta_id,
        numero: g.numero,
        publicado: false,
      })),
    );
  }

  await supabase
    .from("rifas")
    .update({ estado: "sorteada", resultado_loteria: limpio })
    .eq("id", rifaId);

  revalidatePath(`/admin/rifas/${rifaId}`);
  return {
    success: true,
    data: { ganadores: conBoleta.length, sinVender: resueltos.length - conBoleta.length },
  };
}

/** Registra un ganador de rifa interna (sorteo manual del owner). */
export async function registrarGanadorInterna(
  rifaId: string,
  premioId: string,
  numero: number,
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data: boleta } = await supabase
    .from("boletas")
    .select("id")
    .eq("rifa_id", rifaId)
    .eq("numero", numero)
    .maybeSingle();

  const { error } = await supabase.from("ganadores").insert({
    rifa_id: rifaId,
    premio_id: premioId,
    boleta_id: (boleta as { id: string } | null)?.id ?? null,
    numero,
    publicado: false,
  });
  if (error) return { success: false, error: error.message };

  await supabase.from("rifas").update({ estado: "sorteada" }).eq("id", rifaId);
  revalidatePath(`/admin/rifas/${rifaId}`);
  return { success: true, data: undefined };
}

/** Publica los ganadores (los hace visibles en la página pública, enmascarados). */
export async function publicarGanadores(
  rifaId: string,
  mensaje: string | null = null,
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ganadores")
    .update({ publicado: true, mensaje_felicitacion: mensaje })
    .eq("rifa_id", rifaId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/rifas/${rifaId}`);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Público (corte seguro vía service role)
// ---------------------------------------------------------------------------
export interface RifaPublica {
  rifa: Pick<
    Rifa,
    | "nombre"
    | "descripcion"
    | "tipo"
    | "estado"
    | "precio_boleta"
    | "cantidad_numeros"
    | "slug_publico"
    | "tema"
    | "decoracion"
    | "loteria"
    | "loteria_url"
    | "fecha_loteria"
    | "modo_cifras"
    | "formato_cifras"
    | "fecha_sorteo"
  >;
  premios: Pick<Premio, "tipo" | "descripcion" | "valor" | "criterio" | "orden">[];
  grilla: BoletaPublica[];
  disponibles: number;
  pago: TenantPagoConfig | null;
  ganadores: GanadorPublico[];
}

/** Datos públicos de una rifa por slug. NUNCA expone nombre/teléfono/estado real. */
export async function getRifaPublica(
  slug: string,
): Promise<ActionResult<RifaPublica>> {
  const svc = createServiceRoleClient();
  const { data: rifa } = await svc
    .from("rifas")
    .select("*")
    .eq("slug_publico", slug)
    .maybeSingle();

  if (!rifa) return { success: false, error: "Rifa no encontrada" };
  const r = rifa as Rifa;
  if (r.estado === "borrador" || r.estado === "cancelada") {
    return { success: false, error: "Esta rifa no está disponible" };
  }

  const [{ data: premios }, { data: boletas }, { data: pago }, { data: gan }] =
    await Promise.all([
      svc.from("premios").select("*").eq("rifa_id", r.id).order("orden"),
      svc.from("boletas").select("numero, estado").eq("rifa_id", r.id),
      svc.from("tenant_pago_config").select("*").eq("tenant_id", r.tenant_id).maybeSingle(),
      svc
        .from("ganadores")
        .select("numero, premio_id, mensaje_felicitacion")
        .eq("rifa_id", r.id)
        .eq("publicado", true),
    ]);

  const tomados = new Set(
    ((boletas as { numero: number; estado: string }[]) ?? [])
      .filter((b) => b.estado !== "libre")
      .map((b) => b.numero),
  );
  const grilla: BoletaPublica[] = Array.from(
    { length: r.cantidad_numeros },
    (_, numero) => ({ numero, ocupado: tomados.has(numero) }),
  );

  // Ganadores públicos: número + nombre enmascarado (buscando la boleta del número).
  const premiosMap = new Map(
    ((premios as Premio[]) ?? []).map((p) => [p.id, p]),
  );
  const ganadores: GanadorPublico[] = [];
  for (const g of (gan as { numero: number; premio_id: string; mensaje_felicitacion: string | null }[]) ?? []) {
    const { data: b } = await svc
      .from("boletas")
      .select("comprador_nombre")
      .eq("rifa_id", r.id)
      .eq("numero", g.numero)
      .maybeSingle();
    const nombre = (b as { comprador_nombre: string | null } | null)?.comprador_nombre;
    ganadores.push({
      numero: g.numero,
      nombre_enmascarado: nombre ? enmascararNombre(nombre) : "—",
      premio: premiosMap.get(g.premio_id)?.descripcion ?? "Premio",
      mensaje_felicitacion: g.mensaje_felicitacion,
    });
  }

  return {
    success: true,
    data: {
      rifa: {
        nombre: r.nombre,
        descripcion: r.descripcion,
        tipo: r.tipo,
        estado: r.estado,
        precio_boleta: r.precio_boleta,
        cantidad_numeros: r.cantidad_numeros,
        slug_publico: r.slug_publico,
        tema: r.tema,
        decoracion: r.decoracion,
        loteria: r.loteria,
        loteria_url: r.loteria_url,
        fecha_loteria: r.fecha_loteria,
        modo_cifras: r.modo_cifras,
        formato_cifras: r.formato_cifras,
        fecha_sorteo: r.fecha_sorteo,
      },
      premios: ((premios as Premio[]) ?? []).map((p) => ({
        tipo: p.tipo,
        descripcion: p.descripcion,
        valor: p.valor,
        criterio: p.criterio,
        orden: p.orden,
      })),
      grilla,
      disponibles: grilla.filter((c) => !c.ocupado).length,
      pago: (pago as TenantPagoConfig | null) ?? null,
      ganadores,
    },
  };
}

const reservaSchema = z.object({
  slug: z.string().trim().min(1),
  numeros: z.array(z.number().int().min(0)).min(1, "Elige al menos un número"),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z
    .string()
    .trim()
    .regex(/^[+()\d\s.-]{7,20}$/, "Teléfono inválido"),
  cliente_id: z.string().trim().min(6).nullable().optional(),
  consentimiento: z.literal(true, {
    error: "Debes aceptar el tratamiento de datos",
  }),
});

/** El público reserva uno o varios números (sin cuenta). Vía service role. */
export async function reservarNumeros(
  input: z.infer<typeof reservaSchema>,
): Promise<ActionResult<{ reservados: number[]; ocupados: number[] }>> {
  const parsed = reservaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const svc = createServiceRoleClient();
  const { data: rifa } = await svc
    .from("rifas")
    .select("*")
    .eq("slug_publico", d.slug)
    .maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };
  const r = rifa as Rifa;
  if (r.estado !== "activa") {
    return { success: false, error: "Esta rifa no está recibiendo reservas" };
  }

  const enRango = d.numeros.filter((n) => n >= 0 && n < r.cantidad_numeros);
  if (enRango.length === 0) return { success: false, error: "Números fuera de rango" };

  const reservados: number[] = [];
  const ocupados: number[] = [];
  for (const numero of enRango) {
    const { error } = await svc.from("boletas").insert({
      rifa_id: r.id,
      tenant_id: r.tenant_id,
      numero,
      estado: "reservado",
      comprador_nombre: d.nombre,
      comprador_telefono: d.telefono,
      cliente_id: d.cliente_id ?? null,
      consentimiento_datos: true,
    });
    if (error) {
      if (error.code === "23505") ocupados.push(numero);
      else return { success: false, error: error.message };
    } else {
      reservados.push(numero);
    }
  }

  revalidatePath(`/r/${d.slug}`);
  if (reservados.length === 0) {
    return { success: false, error: "Los números elegidos ya están tomados" };
  }
  return { success: true, data: { reservados, ocupados } };
}
