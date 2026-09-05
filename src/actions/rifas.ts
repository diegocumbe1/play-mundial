"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { resolverActivacion } from "@/lib/planes";
import {
  boletasElegibles,
  construirBolas,
  construirGrillaPublica,
  numeroEnRango,
  posicionPremioDeBola,
  resolverGanadores,
  sortearBolas,
  tieneRondaFinal,
} from "@/lib/rifa";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Boleta,
  BoletaPublica,
  BolaSorteo,
  Ganador,
  GanadorPublico,
  Membership,
  Premio,
  PlataformaPagoConfig,
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
  cantidad_numeros: z.number().int().min(2).max(1000),
  /** 0 → 00–29; 1 → 01–30. Las de lotería se fuerzan a 0 más abajo. */
  numero_inicial: z.union([z.literal(0), z.literal(1)]).default(0),
  formato_cifras: z.union([z.literal(2), z.literal(3)]),
  solo_pagadas_juegan: z.boolean().default(true),
  tema: z.enum(["rosa", "clasico", "esmeralda", "oceano", "durazno"]).default("rosa"),
  decoracion: z.enum(["ninguna", "floral", "hojas", "geometrico", "confeti"]).default("floral"),
  imagen_url: z.string().trim().url("La imagen debe ser una URL").nullable().optional().or(z.literal("")),
  imagen_fondo_url: z.string().trim().url("La imagen debe ser una URL").nullable().optional().or(z.literal("")),
  sorteo_bolas: z.number().int().min(1).max(10).default(1),
  sorteo_ganadores: z.number().int().min(1).max(10).default(1),
  sorteo_orden: z.enum(["ultimo_mayor", "primero_mayor"]).default("ultimo_mayor"),
  mostrar_simulacion: z.boolean().default(true),
  loteria: z.string().trim().nullable().optional(),
  loteria_url: z.string().trim().nullable().optional(),
  fecha_loteria: z.string().trim().nullable().optional(),
  modo_cifras: z.enum(["primeras_dos", "ultimas_dos", "ambas"]).nullable().optional(),
  fecha_sorteo: z.string().trim().nullable().optional(),
  /** Solo superadmin: delegar la rifa a otro organizador. */
  tenant_id: z.string().uuid().nullable().optional(),
});

/**
 * Columnas que comparten crear y actualizar. Aquí se aplican las reglas que no
 * pueden depender del formulario: en una rifa de lotería el número cruza con
 * las cifras del resultado, así que la numeración arranca siempre en 0 y no hay
 * sorteo propio que configurar.
 */
function camposRifa(d: z.infer<typeof rifaSchema>) {
  const esLoteria = d.tipo === "loteria";
  return {
    nombre: d.nombre,
    descripcion: d.descripcion ?? null,
    tipo: d.tipo,
    precio_boleta: d.precio_boleta,
    cantidad_numeros: d.cantidad_numeros,
    numero_inicial: esLoteria ? 0 : d.numero_inicial,
    formato_cifras: d.formato_cifras,
    solo_pagadas_juegan: d.solo_pagadas_juegan,
    tema: d.tema,
    decoracion: d.decoracion,
    imagen_url: d.imagen_url || null,
    imagen_fondo_url: d.imagen_fondo_url || null,
    sorteo_bolas: esLoteria ? 1 : d.sorteo_bolas,
    // No se puede sortear más ganadoras que finalistas.
    sorteo_ganadores: esLoteria ? 1 : Math.min(d.sorteo_ganadores, d.sorteo_bolas),
    sorteo_orden: d.sorteo_orden,
    mostrar_simulacion: d.mostrar_simulacion,
    loteria: esLoteria ? (d.loteria ?? null) : null,
    loteria_url: esLoteria ? (d.loteria_url || null) : null,
    fecha_loteria: esLoteria ? (d.fecha_loteria ?? null) : null,
    modo_cifras: esLoteria ? (d.modo_cifras ?? null) : null,
    fecha_sorteo: d.fecha_sorteo ?? null,
  };
}

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
      ...camposRifa(d),
      tenant_id: tenantId,
      estado: "borrador",
      slug_publico: slugify(d.nombre),
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
  const campos = camposRifa(d);

  // Cambiar la cantidad o el arranque (0/1) mueve el rango: ningún número ya
  // vendido puede quedar fuera de él.
  const inicio = campos.numero_inicial;
  const ultimo = inicio + campos.cantidad_numeros - 1;
  const { data: fuera } = await supabase
    .from("boletas")
    .select("numero")
    .eq("rifa_id", id)
    .or(`numero.lt.${inicio},numero.gt.${ultimo}`)
    .order("numero");
  const numerosFuera = ((fuera as { numero: number }[]) ?? []).map((b) => b.numero);
  if (numerosFuera.length > 0) {
    return {
      success: false,
      error: `Con ese rango (${inicio}–${ultimo}) quedarían por fuera números ya vendidos: ${numerosFuera
        .slice(0, 8)
        .join(", ")}${numerosFuera.length > 8 ? "…" : ""}.`,
    };
  }

  const { error } = await supabase.from("rifas").update(campos).eq("id", id);

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

/** Bucket público de las imágenes de la publicación. */
const BUCKET_IMAGENES = "rifa-imagenes";

/**
 * Sube una imagen de la publicación (portada o fondo) al bucket público
 * `rifa-imagenes` y devuelve su URL. Va por service role, igual que el QR.
 */
export async function subirImagenRifa(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecciona una imagen" };
  }
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "El archivo debe ser una imagen" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "La imagen no puede superar 5 MB" };
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 5);
  const path = `${membership.tenant_id}/rifa-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const svc = createServiceRoleClient();
  const subir = () =>
    svc.storage.from(BUCKET_IMAGENES).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  let { error } = await subir();
  // El bucket lo crea la migración, pero en Supabase esa parte puede quedarse
  // sin permisos y falla en silencio. Si no existe, se crea aquí y se reintenta.
  if (error && /bucket not found/i.test(error.message)) {
    const { error: errCrear } = await svc.storage.createBucket(BUCKET_IMAGENES, {
      public: true,
      fileSizeLimit: "5MB",
    });
    if (errCrear && !/already exists/i.test(errCrear.message)) {
      return { success: false, error: `No se pudo crear el bucket: ${errCrear.message}` };
    }
    ({ error } = await subir());
  }
  if (error) return { success: false, error: error.message };

  const { data } = svc.storage.from(BUCKET_IMAGENES).getPublicUrl(path);
  return { success: true, data: { url: data.publicUrl } };
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
): Promise<ActionResult<{ activada: boolean; pendiente?: boolean; monto?: number; pago?: PlataformaPagoConfig | null }>> {
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

  // La decisión de plan/cuota/cobro es común a todas las verticales.
  const resolucion = await resolverActivacion({
    tenantId: r.tenant_id,
    producto: "rifas",
    entidadId: r.id,
    tamano: r.cantidad_numeros,
  });

  if (resolucion.activada) {
    await svc
      .from("rifas")
      .update({
        estado: "activa",
        cobro_tipo: resolucion.cobroTipo,
        activada_at: new Date().toISOString(),
      })
      .eq("id", id);
    revalidatePath(`/admin/rifas/${id}`);
    return { success: true, data: { activada: true } };
  }

  revalidatePath(`/admin/rifas/${id}`);
  return {
    success: true,
    data: {
      activada: false,
      pendiente: true,
      monto: resolucion.monto,
      pago: resolucion.pago,
    },
  };
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
  responsable_venta: z.string().trim().nullable().optional(),
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
    responsable_venta: d.responsable_venta ?? null,
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

const registrarLoteSchema = registrarBoletaSchema
  .omit({ numero: true })
  .extend({ numeros: z.array(z.number().int().min(0)).min(1, "Elige al menos un número") });

/**
 * El owner registra VARIOS números para un mismo comprador (lo normal cuando
 * alguien compra "del 5 al 10"). Los números ya tomados no rompen la operación:
 * se informan aparte para que el owner sepa cuáles no entraron.
 */
export async function registrarBoletasLote(
  input: z.infer<typeof registrarLoteSchema>,
): Promise<ActionResult<{ registrados: number[]; ocupados: number[] }>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const parsed = registrarLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: rifa } = await supabase
    .from("rifas")
    .select("cantidad_numeros, numero_inicial")
    .eq("id", d.rifa_id)
    .maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };

  const numeros = [...new Set(d.numeros)]
    .filter((n) => numeroEnRango(rifa as Rifa, n))
    .sort((a, b) => a - b);
  if (numeros.length === 0) return { success: false, error: "Números fuera de rango" };

  const base = {
    rifa_id: d.rifa_id,
    tenant_id: membership.tenant_id,
    estado: d.pagado ? ("pagado" as const) : ("reservado" as const),
    comprador_nombre: d.comprador_nombre,
    comprador_telefono: d.comprador_telefono ?? null,
    responsable_venta: d.responsable_venta ?? null,
    metodo_pago: d.pagado ? (d.metodo_pago ?? null) : null,
    nota: d.nota ?? null,
    pagado_at: d.pagado ? new Date().toISOString() : null,
  };

  // Un insert por número: así un número ya tomado (unique rifa+numero) no tumba
  // el resto de la compra.
  const registrados: number[] = [];
  const ocupados: number[] = [];
  for (const numero of numeros) {
    const { error } = await supabase.from("boletas").insert({ ...base, numero });
    if (error) {
      if (error.code === "23505") ocupados.push(numero);
      else return { success: false, error: error.message };
    } else {
      registrados.push(numero);
    }
  }

  revalidatePath(`/admin/rifas/${d.rifa_id}`);
  if (registrados.length === 0) {
    return { success: false, error: "Todos esos números ya estaban tomados" };
  }
  return { success: true, data: { registrados, ocupados } };
}

const editarBoletaSchema = z.object({
  comprador_nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  comprador_telefono: z
    .string()
    .trim()
    .regex(/^[+()\d\s.-]{7,20}$/, "Teléfono inválido")
    .nullable()
    .optional(),
  responsable_venta: z.string().trim().nullable().optional(),
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
      responsable_venta: parsed.data.responsable_venta || null,
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

/** Aleatoriedad criptográfica: el sorteo no puede depender de `Math.random`. */
function rngSeguro(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/**
 * Corre el sorteo propio: saca `sorteo_bolas` números al azar entre las boletas
 * que juegan y reparte los premios según `sorteo_orden` (por defecto, la última
 * balota se lleva el premio mayor). Guarda la secuencia real de extracción para
 * poder repetir la animación y dejar constancia de cómo se sorteó.
 */
export async function sortearRifaInterna(
  rifaId: string,
): Promise<ActionResult<{ secuencia: number[]; bolas: BolaSorteo[] }>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data: rifaRow } = await supabase
    .from("rifas")
    .select("*")
    .eq("id", rifaId)
    .maybeSingle();
  if (!rifaRow) return { success: false, error: "Rifa no encontrada" };
  const rifa = rifaRow as Rifa;

  if (rifa.tipo !== "interna") {
    return { success: false, error: "Esta rifa se define con el resultado de la lotería" };
  }
  if (rifa.estado === "borrador") {
    return { success: false, error: "Activa la rifa antes de sortear" };
  }
  if (rifa.estado === "cancelada") {
    return { success: false, error: "Esta rifa está cancelada" };
  }

  const [{ data: premiosRow }, { data: boletasRow }, { count: publicados }] =
    await Promise.all([
      supabase.from("premios").select("*").eq("rifa_id", rifaId).order("orden"),
      supabase.from("boletas").select("*").eq("rifa_id", rifaId),
      supabase
        .from("ganadores")
        .select("id", { count: "exact", head: true })
        .eq("rifa_id", rifaId)
        .eq("publicado", true),
    ]);

  if ((publicados ?? 0) > 0) {
    return {
      success: false,
      error: "Ya publicaste los ganadores de esta rifa. Bórralos si necesitas repetir el sorteo.",
    };
  }

  const premios = (premiosRow as Premio[]) ?? [];
  if (premios.length === 0) {
    return { success: false, error: "Agrega al menos un premio antes de sortear" };
  }

  const elegibles = boletasElegibles(rifa, (boletasRow as Boleta[]) ?? []);
  if (elegibles.length === 0) {
    return {
      success: false,
      error: rifa.solo_pagadas_juegan
        ? "Todavía no hay boletas pagadas: nadie juega el sorteo."
        : "Todavía no hay boletas vendidas.",
    };
  }

  const porNumero = new Map(elegibles.map((b) => [b.numero, b]));

  // Ronda 1 (clasificatoria): finalistas de entre todas las que juegan.
  const cuantas = Math.min(rifa.sorteo_bolas || 1, elegibles.length);
  const secuencia = sortearBolas(
    elegibles.map((b) => b.numero),
    cuantas,
    rngSeguro,
  );

  // Ronda 2 (final): se revuelven SOLO las finalistas y salen las ganadoras.
  // Si se pidieron tantas ganadoras como finalistas, no hay segunda ronda.
  const cuantasGanadoras = Math.min(rifa.sorteo_ganadores || 1, cuantas);
  const finales = tieneRondaFinal(cuantas, cuantasGanadoras)
    ? sortearBolas(secuencia, cuantasGanadoras, rngSeguro)
    : [];

  const premiados = finales.length > 0 ? finales : secuencia;
  const bolas = construirBolas({
    finalistas: secuencia,
    finales,
    premios: premios.map((p) => p.descripcion),
    orden: rifa.sorteo_orden,
    nombre: (n) => porNumero.get(n)?.comprador_nombre ?? null,
  });

  // El sorteo se puede repetir mientras no se publique: se reemplaza entero.
  await supabase.from("ganadores").delete().eq("rifa_id", rifaId);
  const filas = premiados
    .map((numero, i) => {
      const pos = posicionPremioDeBola(i, premiados.length, premios.length, rifa.sorteo_orden);
      if (!pos) return null;
      return {
        rifa_id: rifaId,
        premio_id: premios[pos - 1].id,
        boleta_id: porNumero.get(numero)?.id ?? null,
        numero,
        publicado: false,
      };
    })
    .filter((f) => f !== null);

  if (filas.length > 0) {
    const { error } = await supabase.from("ganadores").insert(filas);
    if (error) return { success: false, error: error.message };
  }

  const { error: errRifa } = await supabase
    .from("rifas")
    .update({
      estado: "sorteada",
      sorteo_secuencia: secuencia,
      sorteo_finales: finales.length > 0 ? finales : null,
      sorteo_at: new Date().toISOString(),
      // Arranca sin cantar: el organizador revela balota por balota.
      sorteo_reveladas: 0,
    })
    .eq("id", rifaId);
  if (errRifa) return { success: false, error: errRifa.message };

  revalidatePath(`/admin/rifas/${rifaId}`);
  return { success: true, data: { secuencia, bolas } };
}

/**
 * Canta balotas: sube el contador de reveladas hasta `hasta`. Es lo único que
 * ve el público mientras el sorteo está en curso, así que solo puede AVANZAR
 * (nunca destapa de menos ni se devuelve) y nunca pasa del total sorteado.
 */
export async function revelarBalotas(
  rifaId: string,
  hasta: number,
): Promise<ActionResult<{ reveladas: number }>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data: rifa } = await supabase
    .from("rifas")
    .select("sorteo_secuencia, sorteo_finales, sorteo_reveladas, slug_publico")
    .eq("id", rifaId)
    .maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };

  const r = rifa as Pick<
    Rifa,
    "sorteo_secuencia" | "sorteo_finales" | "sorteo_reveladas" | "slug_publico"
  >;
  const total = (r.sorteo_secuencia?.length ?? 0) + (r.sorteo_finales?.length ?? 0);
  if (total === 0) return { success: false, error: "Todavía no hay sorteo que cantar" };

  const reveladas = Math.min(total, Math.max(r.sorteo_reveladas ?? 0, Math.trunc(hasta)));
  if (reveladas === (r.sorteo_reveladas ?? 0)) {
    return { success: true, data: { reveladas } };
  }

  const { error } = await supabase
    .from("rifas")
    .update({ sorteo_reveladas: reveladas })
    .eq("id", rifaId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/r/${r.slug_publico}`);
  return { success: true, data: { reveladas } };
}

/** Deshace un sorteo propio que aún no se publicó (para volver a correrlo). */
export async function limpiarSorteo(rifaId: string): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { count: publicados } = await supabase
    .from("ganadores")
    .select("id", { count: "exact", head: true })
    .eq("rifa_id", rifaId)
    .eq("publicado", true);
  if ((publicados ?? 0) > 0) {
    return { success: false, error: "Los ganadores ya están publicados" };
  }

  await supabase.from("ganadores").delete().eq("rifa_id", rifaId);
  const { error } = await supabase
    .from("rifas")
    .update({
      estado: "cerrada",
      sorteo_secuencia: null,
      sorteo_finales: null,
      sorteo_at: null,
      sorteo_reveladas: 0,
    })
    .eq("id", rifaId);
  if (error) return { success: false, error: error.message };

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
    | "numero_inicial"
    | "slug_publico"
    | "tema"
    | "decoracion"
    | "imagen_url"
    | "imagen_fondo_url"
    | "sorteo_bolas"
    | "sorteo_ganadores"
    | "sorteo_orden"
    | "sorteo_at"
    | "mostrar_simulacion"
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
  /**
   * Balotas del sorteo propio en el orden en que salieron, RECORTADAS a las que
   * el organizador ya cantó. Las que faltan no viajan al cliente: es lo que
   * permite transmitir el sorteo en vivo sin filtrar el resultado.
   */
  sorteo: BolaSorteo[] | null;
  /** El sorteo está ocurriendo ahora mismo (faltan balotas por cantar). */
  sorteoEnVivo: boolean;
  /** Cuántas balotas tiene el sorteo completo (para pintar los espacios vacíos). */
  sorteoTotal: number;
  /** Cuántas de esas son de la ronda clasificatoria (0 si hubo una sola ronda). */
  sorteoFinalistas: number;
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

  const grilla = construirGrillaPublica(
    r,
    ((boletas as { numero: number; estado: string }[]) ?? []) as Boleta[],
  );

  // Ganadores públicos: número + nombre enmascarado (buscando la boleta del número).
  const premiosMap = new Map(
    ((premios as Premio[]) ?? []).map((p) => [p.id, p]),
  );
  const filasGanadores =
    (gan as { numero: number; premio_id: string; mensaje_felicitacion: string | null }[]) ?? [];

  // Un solo viaje por los nombres de los números implicados (ganadores y balotas).
  const numerosSorteo = Array.isArray(r.sorteo_secuencia) ? r.sorteo_secuencia : [];
  const numerosFinales = Array.isArray(r.sorteo_finales) ? r.sorteo_finales : [];
  const numerosInteres = [
    ...new Set([
      ...filasGanadores.map((g) => g.numero),
      ...numerosSorteo,
      ...numerosFinales,
    ]),
  ];
  const nombrePorNumero = new Map<number, string>();
  if (numerosInteres.length > 0) {
    const { data: duenos } = await svc
      .from("boletas")
      .select("numero, comprador_nombre")
      .eq("rifa_id", r.id)
      .in("numero", numerosInteres);
    for (const b of (duenos as { numero: number; comprador_nombre: string | null }[]) ?? []) {
      if (b.comprador_nombre) {
        nombrePorNumero.set(b.numero, enmascararNombre(b.comprador_nombre));
      }
    }
  }

  const ganadores: GanadorPublico[] = filasGanadores.map((g) => ({
    numero: g.numero,
    nombre_enmascarado: nombrePorNumero.get(g.numero) ?? "—",
    premio: premiosMap.get(g.premio_id)?.descripcion ?? "Premio",
    mensaje_felicitacion: g.mensaje_felicitacion,
  }));

  // Balotas visibles. Mientras el sorteo está en curso solo se envían las ya
  // cantadas; una vez publicados los ganadores se envía el sorteo completo (el
  // replay). Antes de cantar la primera no se envía nada.
  const premiosOrdenados = [...((premios as Premio[]) ?? [])].sort((a, b) => a.orden - b.orden);
  const publicado = ganadores.length > 0;
  const totalBolas = numerosSorteo.length + numerosFinales.length;
  const cantadas = publicado
    ? totalBolas
    : Math.min(r.sorteo_reveladas ?? 0, totalBolas);

  // Se recortan las DOS rondas al punto que ya cantó el organizador: las balotas
  // que faltan no salen de aquí.
  const todas = construirBolas({
    finalistas: numerosSorteo,
    finales: numerosFinales,
    premios: premiosOrdenados.map((p) => p.descripcion),
    orden: r.sorteo_orden,
    nombre: (n) => nombrePorNumero.get(n) ?? null,
  });
  const sorteo: BolaSorteo[] | null = cantadas > 0 ? todas.slice(0, cantadas) : null;
  const sorteoEnVivo = totalBolas > 0 && !publicado && cantadas < totalBolas;

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
        numero_inicial: r.numero_inicial,
        slug_publico: r.slug_publico,
        tema: r.tema,
        decoracion: r.decoracion,
        imagen_url: r.imagen_url,
        imagen_fondo_url: r.imagen_fondo_url,
        sorteo_bolas: r.sorteo_bolas,
        sorteo_ganadores: r.sorteo_ganadores,
        sorteo_orden: r.sorteo_orden,
        sorteo_at: r.sorteo_at,
        mostrar_simulacion: r.mostrar_simulacion,
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
      sorteo,
      sorteoEnVivo,
      sorteoTotal: totalBolas,
      sorteoFinalistas: numerosFinales.length > 0 ? numerosSorteo.length : 0,
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

  const enRango = d.numeros.filter((n) => numeroEnRango(r, n));
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
