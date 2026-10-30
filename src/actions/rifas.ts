"use server";

import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { z } from "zod";

import { emailVerificado, esSuperadmin, getMembership } from "@/lib/auth";
import {
  EMAIL_VERIFICATION_REQUIRED,
  ESTADOS_TENANT_BLOQUEADO,
  RIFA_PAUSADA,
  tagRifaPublica,
} from "@/lib/errores";
import { creditoCicloPro, resolverActivacion } from "@/lib/planes";
import {
  boletasElegibles,
  construirBolas,
  codificarOcupados,
  numeroEnRango,
  posicionPremioDeBola,
  cifrasDeResultado,
  elegiblesParaPremio,
  resolverGanadores,
  sortearBolas,
  tieneRondaFinal,
} from "@/lib/rifa";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  AbonoBoleta,
  ActionResult,
  Boleta,
  BolaSorteo,
  Ganador,
  GanadorPublico,
  Membership,
  MovimientoRifa,
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

/**
 * Puerta común de TODO lo que cambia el estado de un número: registrar,
 * apartar, marcar pagado, corregir datos o liberar. Sin correo verificado no
 * se vende, sin importar el plan.
 *
 * Es la primera barrera, no la única: la definitiva es el trigger de `boletas`,
 * porque la RLS del tenant permite escribir directo contra PostgREST.
 */
async function puedeTocarNumeros(): Promise<ActionResult<Membership>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };
  if (membership.rol === "superadmin") return { success: true, data: membership };
  if (!(await emailVerificado())) {
    return { success: false, error: EMAIL_VERIFICATION_REQUIRED };
  }
  return { success: true, data: membership };
}

/**
 * Traduce el error del trigger a nuestro código semántico. Si alguien llega a
 * la base por otra vía, el mensaje que ve el usuario sigue siendo el correcto.
 */
function traducirErrorBoleta(mensaje: string): string {
  return mensaje.includes(EMAIL_VERIFICATION_REQUIRED)
    ? EMAIL_VERIFICATION_REQUIRED
    : mensaje;
}

/**
 * Revalida el enlace público de una rifa. Todo lo que cambia lo que ve el
 * comprador (números vendidos, premios, imágenes, ganadores) tiene que pasar
 * por aquí: si no, quien ya tenía la página abierta sigue viendo lo viejo hasta
 * el siguiente sondeo.
 */
async function revalidarPublica(rifaId: string): Promise<void> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("rifas")
    .select("slug_publico")
    .eq("id", rifaId)
    .maybeSingle();
  const slug = (data as { slug_publico: string } | null)?.slug_publico;
  if (slug) invalidarPublica(slug);
}

/**
 * Invalida la página pública Y la caché de `getRifaPublica`. `updateTag` (no
 * `revalidateTag`) expira al instante: quien acaba de reservar tiene que ver
 * sus números ocupados en el siguiente sondeo, no una copia vieja.
 */
function invalidarPublica(slug: string): void {
  revalidatePath(`/r/${slug}`);
  updateTag(tagRifaPublica(slug));
}

/**
 * ¿El superadmin bloqueó al dueño de la rifa? Entonces sus rifas ya publicadas
 * quedan en pausa: no se ven ni reciben reservas hasta que lo reactive.
 */
async function organizadorBloqueado(
  svc: ReturnType<typeof createServiceRoleClient>,
  tenantId: string,
): Promise<boolean> {
  const { data } = await svc.from("tenants").select("estado").eq("id", tenantId).maybeSingle();
  const estado = (data as { estado: string } | null)?.estado;
  return (ESTADOS_TENANT_BLOQUEADO as readonly string[]).includes(estado ?? "");
}

/**
 * PostgREST corta cada respuesta en `max_rows` (1000) y una rifa puede tener
 * hasta 10.000 números: las boletas se traen por páginas hasta agotarlas. La
 * consulta debe ir ordenada para que las páginas no se pisen.
 */
const PAGINA_BOLETAS = 1000;
async function traerTodas<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: unknown }>,
): Promise<{ data: T[] }> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA_BOLETAS) {
    const { data } = await pagina(desde, desde + PAGINA_BOLETAS - 1);
    const lote = (data as T[] | null) ?? [];
    filas.push(...lote);
    if (lote.length < PAGINA_BOLETAS) break;
  }
  return { data: filas };
}

const rifaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  descripcion: z.string().trim().nullable().optional(),
  tipo: z.enum(["interna", "loteria"]),
  precio_boleta: z.number().int().min(0),
  cantidad_numeros: z.number().int().min(2).max(10000, "El máximo es de 10.000 números"),
  /** 0 → 00–29; 1 → 01–30. Las de lotería se fuerzan a 0 más abajo. */
  numero_inicial: z.union([z.literal(0), z.literal(1)]).default(0),
  formato_cifras: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  /** Cada compra debe llevar al menos estos números (1 = sin mínimo). */
  min_numeros_compra: z.number().int().min(1).max(100).default(1),
  solo_pagadas_juegan: z.boolean().default(true),
  tema: z.enum(["rosa", "clasico", "esmeralda", "oceano", "durazno", "navidad"]).default("rosa"),
  decoracion: z
    .enum(["ninguna", "floral", "hojas", "geometrico", "confeti", "navidad"])
    .default("floral"),
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
  // Pago por cuotas (opcional).
  permite_abonos: z.boolean().default(false),
  abono_minimo: z.number().int().positive().nullable().optional(),
  dias_limite_pago: z.number().int().min(0).max(30).nullable().optional(),
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
    min_numeros_compra: Math.min(d.min_numeros_compra, d.cantidad_numeros),
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
    // Con 4 cifras primeras y últimas son el mismo número: solo vale "últimas".
    modo_cifras: esLoteria
      ? d.formato_cifras === 4
        ? "ultimas_dos"
        : (d.modo_cifras ?? null)
      : null,
    fecha_sorteo: d.fecha_sorteo ?? null,
    // Las cuotas solo tienen sentido si los no pagados no juegan.
    permite_abonos: d.solo_pagadas_juegan && d.permite_abonos,
    abono_minimo: d.solo_pagadas_juegan && d.permite_abonos ? (d.abono_minimo ?? null) : null,
    dias_limite_pago: d.solo_pagadas_juegan ? (d.dias_limite_pago ?? null) : null,
  };
}

const premioSchema = z.object({
  tipo: z.enum(["valor", "producto"]),
  descripcion: z.string().trim().min(1, "Describe el premio"),
  valor: z.number().int().min(0).nullable().optional(),
  cantidad_ganadores: z.number().int().min(1).default(1),
  criterio: z.enum(["primeras_2", "ultimas_2"]).nullable().optional(),
  orden: z.number().int().min(1).default(1),
  imagen_url: z.string().trim().url().nullable().optional(),
  /** Solo si los premios juegan en fechas distintas (`null` = fecha de la rifa). */
  fecha_loteria: z.string().trim().nullable().optional(),
  /** Rifas con abonos: cuánto debe llevar pagado para jugarlo (`null` = completo). */
  minimo_para_jugar: z.number().int().positive().nullable().optional(),
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
  movimientos: MovimientoRifa[];
}

/** Rifa + premios + boletas + ganadores + movimientos de caja (con datos sensibles: solo owner). */
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

  const [{ data: premios }, { data: boletas }, { data: ganadores }, { data: movimientos }] =
    await Promise.all([
      supabase.from("premios").select("*").eq("rifa_id", id).order("orden"),
      traerTodas<Boleta>((desde, hasta) =>
        supabase.from("boletas").select("*").eq("rifa_id", id).order("numero").range(desde, hasta),
      ),
      supabase.from("ganadores").select("*").eq("rifa_id", id),
      supabase
        .from("movimientos_rifa")
        .select("*")
        .eq("rifa_id", id)
        .order("created_at", { ascending: false }),
    ]);

  return {
    success: true,
    data: {
      rifa: rifa as Rifa,
      premios: (premios as Premio[]) ?? [],
      boletas: (boletas as Boleta[]) ?? [],
      ganadores: (ganadores as Ganador[]) ?? [],
      movimientos: (movimientos as MovimientoRifa[]) ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Caja (owner): retiros y gastos sobre lo recaudado
// ---------------------------------------------------------------------------
const movimientoSchema = z.object({
  rifa_id: z.string().uuid(),
  tipo: z.enum(["retiro", "gasto"]).default("retiro"),
  monto: z.number().int().positive("El monto debe ser mayor a 0"),
  metodo: z.enum(["efectivo", "transferencia"]).default("transferencia"),
  detalle: z.string().trim().max(200).nullable().optional(),
});

/** Registra una salida de plata (retiro o gasto) de lo recaudado en la rifa. */
export async function crearMovimientoRifa(
  input: z.input<typeof movimientoSchema>,
): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const parsed = movimientoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();
  // El tenant de la RIFA (el superadmin registra en rifas de otros); la RLS lo exige.
  const { data: rifa } = await supabase
    .from("rifas")
    .select("tenant_id")
    .eq("id", d.rifa_id)
    .maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };

  const { error } = await supabase.from("movimientos_rifa").insert({
    rifa_id: d.rifa_id,
    tenant_id: (rifa as { tenant_id: string }).tenant_id,
    tipo: d.tipo,
    monto: d.monto,
    metodo: d.metodo,
    detalle: d.detalle || null,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/rifas/${d.rifa_id}`);
  return { success: true, data: undefined };
}

/** Borra una salida registrada por error. */
export async function eliminarMovimientoRifa(id: string): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movimientos_rifa")
    .delete()
    .eq("id", id)
    .select("rifa_id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Movimiento no encontrado" };

  revalidatePath(`/admin/rifas/${(data as { rifa_id: string }).rifa_id}`);
  return { success: true, data: undefined };
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
  await revalidarPublica(id);
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

  const filas = parsed.data.map((p, i) => ({
    rifa_id: rifaId,
    tipo: p.tipo,
    descripcion: p.descripcion,
    valor: p.tipo === "valor" ? (p.valor ?? 0) : null,
    cantidad_ganadores: p.cantidad_ganadores,
    criterio: p.criterio ?? null,
    orden: p.orden ?? i + 1,
    imagen_url: p.imagen_url || null,
    fecha_loteria: p.fecha_loteria || null,
    minimo_para_jugar: p.minimo_para_jugar ?? null,
  }));

  const supabase = await createClient();
  const [{ data: actuales }, { data: conGanador }] = await Promise.all([
    supabase.from("premios").select("*").eq("rifa_id", rifaId).order("orden"),
    supabase.from("ganadores").select("premio_id").eq("rifa_id", rifaId),
  ]);
  const previos = (actuales as Premio[]) ?? [];
  const sorteados = new Set(((conGanador as { premio_id: string }[]) ?? []).map((g) => g.premio_id));
  for (const p of previos) if (p.resultado_loteria) sorteados.add(p.id);

  // Con premios ya sorteados (sorteos en fechas distintas) no se puede borrar y
  // reinsertar: se perderían sus ganadores. Se editan en su lugar, y a esos
  // premios no se les cambia cómo ni cuándo se ganan.
  if (sorteados.size > 0) {
    if (previos.length !== filas.length) {
      return {
        success: false,
        error: "Ya hay premios sorteados: no puedes agregar ni quitar premios.",
      };
    }
    for (const [i, previo] of previos.entries()) {
      const nueva = filas[i];
      if (
        sorteados.has(previo.id) &&
        (previo.criterio !== nueva.criterio || (previo.fecha_loteria ?? null) !== nueva.fecha_loteria)
      ) {
        return {
          success: false,
          error: `El premio ${i + 1} ya se sorteó: no puedes cambiar su fecha ni con qué cifras se gana.`,
        };
      }
      const { error } = await supabase.from("premios").update(nueva).eq("id", previo.id);
      if (error) return { success: false, error: error.message };
    }
  } else {
    // Primero los nuevos y SOLO si entran se borran los viejos: al revés, un
    // insert fallido (p. ej. una columna que aún no migró) dejaba la rifa sin
    // premios.
    if (filas.length > 0) {
      const { error } = await supabase.from("premios").insert(filas);
      if (error) return { success: false, error: `No se guardaron los premios: ${error.message}` };
    }
    if (previos.length > 0) {
      const { error } = await supabase
        .from("premios")
        .delete()
        .in(
          "id",
          previos.map((p) => p.id),
        );
      if (error) return { success: false, error: error.message };
    }
  }

  revalidatePath(`/admin/rifas/${rifaId}`);
  await revalidarPublica(rifaId);
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
): Promise<
  ActionResult<{
    activada: boolean;
    requiereAprobacion?: boolean;
    pendiente?: boolean;
    monto?: number;
    pago?: PlataformaPagoConfig | null;
    /** Upsell: cuánto lleva pagado el ciclo y qué falta para PRO. */
    upsell?: { pagado: number; precioPro: number; falta: number } | null;
  }>
> {
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
  // La tarifa (y si cabe en el plan gratis) se calcula con el valor del puesto:
  // sin él se cotizaría una rifa de $0 y se gastaría el cupo gratis en ella.
  if (!r.precio_boleta || r.precio_boleta <= 0) {
    return {
      success: false,
      error: "Ponle el valor del puesto antes de activar: con él se calcula la tarifa.",
    };
  }

  // La decisión de plan/cuota/cobro es común a todas las verticales.
  const resolucion = await resolverActivacion({
    tenantId: r.tenant_id,
    producto: "rifas",
    entidadId: r.id,
    tamano: r.cantidad_numeros,
    // Con el cobro "una boleta", el precio del puesto ES la tarifa.
    precioUnitario: r.precio_boleta,
  });

  if (resolucion.activada) {
    await svc
      .from("rifas")
      .update({
        estado: "activa",
        cobro_tipo: resolucion.cobroTipo,
        // Gratis y PRO no cuestan nada en esta activación: el snapshot es 0.
        cobro_monto: 0,
        activada_at: new Date().toISOString(),
      })
      .eq("id", id);
    revalidatePath(`/admin/rifas/${id}`);
    await revalidarPublica(id);
    return { success: true, data: { activada: true } };
  }

  // Snapshot del precio cotizado: si el superadmin cambia la tarifa después, el
  // cobro de esta rifa no se mueve.
  if (resolucion.pendiente) {
    await svc
      .from("rifas")
      .update({ cobro_monto: resolucion.monto, cobro_id: resolucion.cobroId ?? null })
      .eq("id", id);
  }

  revalidatePath(`/admin/rifas/${id}`);
  return {
    success: true,
    data: {
      activada: false,
      requiereAprobacion: resolucion.requiereAprobacion ?? false,
      pendiente: resolucion.pendiente,
      monto: resolucion.monto,
      pago: resolucion.pago,
      // Solo tiene sentido ofrecer PRO cuando efectivamente hay que pagar.
      upsell: resolucion.pendiente ? await creditoCicloPro(r.tenant_id) : null,
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

/**
 * Archiva o restaura una rifa. Archivada sale de la lista principal y del
 * enlace público, pero conserva todo; al restaurar vuelve tal como estaba.
 */
export async function archivarRifa(rifaId: string, archivar: boolean): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  // Con el cliente del usuario: la RLS garantiza que la rifa sea suya.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rifas")
    .update({ archivada_at: archivar ? new Date().toISOString() : null })
    .eq("id", rifaId)
    .select("slug_publico")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Rifa no encontrada" };

  invalidarPublica((data as { slug_publico: string }).slug_publico);
  revalidatePath("/admin/rifas");
  revalidatePath(`/admin/rifas/${rifaId}`);
  return { success: true, data: undefined };
}

/**
 * Borra una rifa PARA SIEMPRE con sus números, premios y ganadores. Solo desde
 * archivadas y escribiendo el nombre exacto: es irreversible y puede llevarse
 * ventas reales. El cobro que tuviera queda en el historial (sin la rifa); si
 * estaba pendiente se anula para que nadie active una rifa que ya no existe.
 */
export async function eliminarRifa(rifaId: string, confirmacion: string): Promise<ActionResult> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data: rifa } = await supabase
    .from("rifas")
    .select("id, nombre, slug_publico, archivada_at")
    .eq("id", rifaId)
    .maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };
  const r = rifa as { id: string; nombre: string; slug_publico: string; archivada_at: string | null };
  if (!r.archivada_at) {
    return { success: false, error: "Primero archiva la rifa; solo se borran rifas archivadas" };
  }
  if (confirmacion.trim() !== r.nombre.trim()) {
    return { success: false, error: "Escribe el nombre exacto de la rifa para confirmar" };
  }

  // Los cobros solo los toca el superadmin por RLS: se anula con service role,
  // y solo el de ESTA rifa (ya se comprobó arriba que es del usuario).
  await createServiceRoleClient()
    .from("cobros")
    .update({ estado: "anulado" })
    .eq("rifa_id", r.id)
    .eq("estado", "pendiente");

  const { error } = await supabase.from("rifas").delete().eq("id", r.id);
  if (error) return { success: false, error: error.message };

  invalidarPublica(r.slug_publico);
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
  await revalidarPublica(id);
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
  /** Separar con saldo: lo que deja de una vez al apartar (0 = nada). */
  abono: z.number().int().min(0).optional(),
});

/** El owner registra manualmente un número (apartado o pagado). */
export async function registrarBoletaAdmin(
  input: z.infer<typeof registrarBoletaSchema>,
): Promise<ActionResult> {
  const acceso = await puedeTocarNumeros();
  if (!acceso.success) return acceso;

  const parsed = registrarBoletaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();
  // La boleta lleva el tenant de la RIFA, no el de quien la registra: el
  // superadmin vende en rifas de otros organizadores (y el trigger
  // `boletas_coherencia_tenant` rechaza cualquier otro).
  const { data: rifa } = await supabase
    .from("rifas")
    .select("tenant_id")
    .eq("id", d.rifa_id)
    .maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };

  const { data: creada, error } = await supabase
    .from("boletas")
    .insert({
      rifa_id: d.rifa_id,
      tenant_id: (rifa as { tenant_id: string }).tenant_id,
      numero: d.numero,
      estado: d.pagado ? "pagado" : "reservado",
      comprador_nombre: d.comprador_nombre,
      comprador_telefono: d.comprador_telefono ?? null,
      responsable_venta: d.responsable_venta ?? null,
      metodo_pago: d.pagado ? (d.metodo_pago ?? "transferencia") : null,
      nota: d.nota ?? null,
      pagado_at: d.pagado ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    const msg =
      error.code === "23505" ? "Ese número ya está tomado" : traducirErrorBoleta(error.message);
    return { success: false, error: msg };
  }

  // Separó con saldo: el primer abono queda registrado de una vez.
  if (!d.pagado && d.abono && d.abono > 0) {
    const r = await registrarAbono(
      supabase,
      (creada as { id: string }).id,
      d.abono,
      d.metodo_pago ?? "transferencia",
      null,
    );
    if (!r.success) return r;
  }
  revalidatePath(`/admin/rifas/${d.rifa_id}`);
  await revalidarPublica(d.rifa_id);
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
  const acceso = await puedeTocarNumeros();
  if (!acceso.success) return acceso;

  const parsed = registrarLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: rifa } = await supabase
    .from("rifas")
    .select("tenant_id, cantidad_numeros, numero_inicial")
    .eq("id", d.rifa_id)
    .maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };

  const numeros = [...new Set(d.numeros)]
    .filter((n) => numeroEnRango(rifa as Rifa, n))
    .sort((a, b) => a - b);
  if (numeros.length === 0) return { success: false, error: "Números fuera de rango" };

  const base = {
    rifa_id: d.rifa_id,
    // El de la rifa, no el de quien registra (ver registrarBoletaAdmin).
    tenant_id: (rifa as { tenant_id: string }).tenant_id,
    estado: d.pagado ? ("pagado" as const) : ("reservado" as const),
    comprador_nombre: d.comprador_nombre,
    comprador_telefono: d.comprador_telefono ?? null,
    responsable_venta: d.responsable_venta ?? null,
    metodo_pago: d.pagado ? (d.metodo_pago ?? "transferencia") : null,
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
      else return { success: false, error: traducirErrorBoleta(error.message) };
    } else {
      registrados.push(numero);
    }
  }

  revalidatePath(`/admin/rifas/${d.rifa_id}`);
  await revalidarPublica(d.rifa_id);
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
  const acceso = await puedeTocarNumeros();
  if (!acceso.success) return acceso;

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

  if (error) return { success: false, error: traducirErrorBoleta(error.message) };
  if (data) {
    const rifaId = (data as { rifa_id: string }).rifa_id;
    revalidatePath(`/admin/rifas/${rifaId}`);
    await revalidarPublica(rifaId);
  }
  return { success: true, data: undefined };
}

/** Corrige el medio con el que se pagó una boleta, sin tocar fecha ni estado. */
export async function cambiarMetodoPagoBoleta(
  boletaId: string,
  metodo: "efectivo" | "transferencia",
): Promise<ActionResult> {
  const acceso = await puedeTocarNumeros();
  if (!acceso.success) return acceso;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boletas")
    .update({ metodo_pago: metodo })
    .eq("id", boletaId)
    .eq("estado", "pagado")
    .select("rifa_id")
    .maybeSingle();

  if (error) return { success: false, error: traducirErrorBoleta(error.message) };
  if (!data) return { success: false, error: "Ese número no está pagado" };
  revalidatePath(`/admin/rifas/${(data as { rifa_id: string }).rifa_id}`);
  return { success: true, data: undefined };
}

/** Marca una boleta como pagada (o revierte a reservada). */
export async function marcarPagoBoleta(
  boletaId: string,
  pagado: boolean,
  metodo: "efectivo" | "transferencia" = "transferencia",
): Promise<ActionResult> {
  const acceso = await puedeTocarNumeros();
  if (!acceso.success) return acceso;

  const supabase = await createClient();

  // Si venía abonando, "pagado" es abonar lo que falta (así la caja cuadra), y
  // no se puede volver a pendiente sin quitar abonos: se perdería la plata.
  const { data: actual } = await supabase
    .from("boletas")
    .select("monto_abonado, rifa_id, rifas(precio_boleta)")
    .eq("id", boletaId)
    .maybeSingle();
  const abonado = (actual as { monto_abonado: number } | null)?.monto_abonado ?? 0;
  if (actual && abonado > 0) {
    if (!pagado) {
      return {
        success: false,
        error: "Este número se pagó con abonos: para dejarlo pendiente elimina el último abono.",
      };
    }
    const precio =
      (actual as unknown as { rifas: { precio_boleta: number } | null }).rifas?.precio_boleta ?? 0;
    const saldo = Math.max(0, precio - abonado);
    const r =
      saldo > 0
        ? await registrarAbono(supabase, boletaId, saldo, metodo, "Saldo completo")
        : await recalcularAbonos(supabase, boletaId);
    if (!r.success) return r;
    const rifaId = (actual as { rifa_id: string }).rifa_id;
    revalidatePath(`/admin/rifas/${rifaId}`);
    await revalidarPublica(rifaId);
    return { success: true, data: undefined };
  }

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

  if (error) return { success: false, error: traducirErrorBoleta(error.message) };
  if (data) {
    const rifaId = (data as { rifa_id: string }).rifa_id;
    revalidatePath(`/admin/rifas/${rifaId}`);
    await revalidarPublica(rifaId);
  }
  return { success: true, data: undefined };
}

/** Libera un número (borra la boleta → vuelve a estar libre). */
export async function liberarBoleta(boletaId: string): Promise<ActionResult> {
  const acceso = await puedeTocarNumeros();
  if (!acceso.success) return acceso;

  const supabase = await createClient();
  const { data } = await supabase
    .from("boletas")
    .select("rifa_id, monto_abonado")
    .eq("id", boletaId)
    .maybeSingle();
  const abonado = (data as { monto_abonado: number } | null)?.monto_abonado ?? 0;
  if (abonado > 0) {
    return {
      success: false,
      error: `Este número tiene abonos por ${abonado.toLocaleString("es-CO")}: elimínalos antes de liberarlo.`,
    };
  }
  const { error } = await supabase.from("boletas").delete().eq("id", boletaId);
  if (error) return { success: false, error: traducirErrorBoleta(error.message) };
  if (data) {
    const rifaId = (data as { rifa_id: string }).rifa_id;
    revalidatePath(`/admin/rifas/${rifaId}`);
    await revalidarPublica(rifaId);
  }
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Abonos (separar con saldo)
// ---------------------------------------------------------------------------
type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Recalcula lo abonado de una boleta desde sus abonos y su estado: al alcanzar
 * el precio del puesto queda `pagado` (con el medio del abono que la completó);
 * si le falta, vuelve a `reservado`.
 */
async function recalcularAbonos(
  supabase: SupabaseServer,
  boletaId: string,
): Promise<ActionResult> {
  const [{ data: boleta }, { data: abonos }] = await Promise.all([
    supabase
      .from("boletas")
      .select("pagado_at, rifas(precio_boleta)")
      .eq("id", boletaId)
      .maybeSingle(),
    supabase
      .from("abonos_boleta")
      .select("monto, metodo, created_at")
      .eq("boleta_id", boletaId)
      .order("created_at"),
  ]);
  if (!boleta) return { success: false, error: "Número no encontrado" };

  const lista = (abonos as Pick<AbonoBoleta, "monto" | "metodo" | "created_at">[]) ?? [];
  const total = lista.reduce((s, a) => s + a.monto, 0);
  const efectivo = lista.filter((a) => a.metodo === "efectivo").reduce((s, a) => s + a.monto, 0);
  const precio =
    (boleta as unknown as { rifas: { precio_boleta: number } | null }).rifas?.precio_boleta ?? 0;
  const completo = total > 0 && total >= precio;

  const { error } = await supabase
    .from("boletas")
    .update({
      monto_abonado: total,
      abonado_efectivo: efectivo,
      estado: completo ? "pagado" : "reservado",
      metodo_pago: completo ? lista[lista.length - 1].metodo : null,
      pagado_at: completo
        ? ((boleta as { pagado_at: string | null }).pagado_at ?? new Date().toISOString())
        : null,
    })
    .eq("id", boletaId);
  if (error) return { success: false, error: traducirErrorBoleta(error.message) };
  return { success: true, data: undefined };
}

/** Inserta un abono y recalcula la boleta. No revalida: lo hace quien llama. */
async function registrarAbono(
  supabase: SupabaseServer,
  boletaId: string,
  monto: number,
  metodo: "efectivo" | "transferencia",
  nota: string | null,
): Promise<ActionResult> {
  const { data: boleta } = await supabase
    .from("boletas")
    .select("tenant_id, rifa_id, estado")
    .eq("id", boletaId)
    .maybeSingle();
  if (!boleta) return { success: false, error: "Número no encontrado" };
  const b = boleta as { tenant_id: string; rifa_id: string; estado: string };

  const { error } = await supabase.from("abonos_boleta").insert({
    tenant_id: b.tenant_id,
    rifa_id: b.rifa_id,
    boleta_id: boletaId,
    monto,
    metodo,
    nota,
  });
  if (error) return { success: false, error: error.message };
  return recalcularAbonos(supabase, boletaId);
}

const abonoSchema = z.object({
  boleta_id: z.string().uuid(),
  monto: z.number().int().positive("El abono debe ser mayor a 0"),
  metodo: z.enum(["efectivo", "transferencia"]).default("transferencia"),
  nota: z.string().trim().max(200).nullable().optional(),
});

/** Registra un abono a un número apartado. Si completa el precio, queda pagado. */
export async function abonarBoleta(
  input: z.input<typeof abonoSchema>,
): Promise<ActionResult<{ pagado: boolean; saldo: number }>> {
  const acceso = await puedeTocarNumeros();
  if (!acceso.success) return acceso;
  const parsed = abonoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: boleta } = await supabase
    .from("boletas")
    .select("estado, monto_abonado, rifa_id, rifas(precio_boleta, abono_minimo)")
    .eq("id", d.boleta_id)
    .maybeSingle();
  if (!boleta) return { success: false, error: "Número no encontrado" };
  const b = boleta as unknown as {
    estado: string;
    monto_abonado: number;
    rifa_id: string;
    rifas: { precio_boleta: number; abono_minimo: number | null } | null;
  };
  if (b.estado === "pagado") return { success: false, error: "Este número ya está pagado" };
  const saldo = Math.max(0, (b.rifas?.precio_boleta ?? 0) - b.monto_abonado);
  // La cuota mínima aplica salvo cuando lo que falta es menos que ella.
  const minimo = Math.min(b.rifas?.abono_minimo ?? 0, saldo);
  if (d.monto < minimo) {
    return { success: false, error: `La cuota mínima es ${minimo.toLocaleString("es-CO")}.` };
  }
  if (d.monto > saldo) {
    return {
      success: false,
      error: `El abono supera lo que falta (${saldo.toLocaleString("es-CO")}).`,
    };
  }

  const r = await registrarAbono(supabase, d.boleta_id, d.monto, d.metodo, d.nota ?? null);
  if (!r.success) return r;

  revalidatePath(`/admin/rifas/${b.rifa_id}`);
  await revalidarPublica(b.rifa_id);
  return { success: true, data: { pagado: d.monto === saldo, saldo: saldo - d.monto } };
}

/** Abonos de un número, del más viejo al más nuevo (para el modal del número). */
export async function getAbonosBoleta(boletaId: string): Promise<ActionResult<AbonoBoleta[]>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("abonos_boleta")
    .select("*")
    .eq("boleta_id", boletaId)
    .order("created_at");
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as AbonoBoleta[]) ?? [] };
}

/** Borra un abono registrado por error y recalcula el número. */
export async function eliminarAbonoBoleta(abonoId: string): Promise<ActionResult> {
  const acceso = await puedeTocarNumeros();
  if (!acceso.success) return acceso;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("abonos_boleta")
    .delete()
    .eq("id", abonoId)
    .select("boleta_id, rifa_id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Abono no encontrado" };
  const { boleta_id, rifa_id } = data as { boleta_id: string; rifa_id: string };

  const r = await recalcularAbonos(supabase, boleta_id);
  if (!r.success) return r;
  revalidatePath(`/admin/rifas/${rifa_id}`);
  await revalidarPublica(rifa_id);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Sorteo
// ---------------------------------------------------------------------------
/**
 * Ingresa el resultado de la lotería y resuelve ganadores (auto-match).
 *
 * Con `premioId` resuelve SOLO ese premio (rifas con premios en fechas
 * distintas): guarda el resultado en el premio, reemplaza solo sus ganadores y
 * la rifa queda `sorteada` cuando ya no le falta resultado a ningún premio.
 */
export async function ingresarResultadoLoteria(
  rifaId: string,
  resultado: string,
  premioId?: string,
): Promise<ActionResult<{ ganadores: number; sinVender: number }>> {
  const membership = await requireMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const limpio = resultado.replace(/\D/g, "");
  if (!limpio) return { success: false, error: "Ingresa el número ganador de la lotería" };

  const supabase = await createClient();
  const { data: rifa } = await supabase.from("rifas").select("*").eq("id", rifaId).maybeSingle();
  if (!rifa) return { success: false, error: "Rifa no encontrada" };

  const [{ data: premios }, { data: boletas }, { data: abonos }] = await Promise.all([
    supabase.from("premios").select("*").eq("rifa_id", rifaId).order("orden"),
    traerTodas<Boleta>((desde, hasta) =>
      supabase.from("boletas").select("*").eq("rifa_id", rifaId).order("numero").range(desde, hasta),
    ),
    traerTodas<{ boleta_id: string; monto: number; created_at: string }>((desde, hasta) =>
      supabase
        .from("abonos_boleta")
        .select("boleta_id, monto, created_at")
        .eq("rifa_id", rifaId)
        .range(desde, hasta),
    ),
  ]);

  const todos = (premios as Premio[]) ?? [];
  // Quién juega cada premio sale de sus reglas de pago (lo que exige ese
  // premio y la fecha límite) evaluadas a la fecha de SU sorteo.
  const elegiblesDe = (p: Premio) =>
    elegiblesParaPremio(
      rifa as Rifa,
      p,
      (boletas as Boleta[]) ?? [],
      (abonos as { boleta_id: string; monto: number; created_at: string }[]) ?? [],
    );

  if (premioId) {
    const premio = todos.find((p) => p.id === premioId);
    if (!premio) return { success: false, error: "Premio no encontrado" };
    const { count: yaPublicado } = await supabase
      .from("ganadores")
      .select("id", { count: "exact", head: true })
      .eq("premio_id", premioId)
      .eq("publicado", true);
    if ((yaPublicado ?? 0) > 0) {
      return { success: false, error: "El ganador de este premio ya está publicado" };
    }

    const resueltos = resolverGanadores(
      rifa as Rifa,
      [premio],
      (boletas as Boleta[]) ?? [],
      limpio,
      elegiblesDe,
    );
    await supabase.from("ganadores").delete().eq("premio_id", premioId);
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
    const { error: errPremio } = await supabase
      .from("premios")
      .update({ resultado_loteria: limpio })
      .eq("id", premioId);
    if (errPremio) return { success: false, error: errPremio.message };

    // La rifa termina cuando el último premio tiene su resultado.
    const faltan = todos.some((p) => p.id !== premioId && p.criterio !== null && !p.resultado_loteria);
    if (!faltan) {
      await supabase.from("rifas").update({ estado: "sorteada" }).eq("id", rifaId);
    }

    revalidatePath(`/admin/rifas/${rifaId}`);
    await revalidarPublica(rifaId);
    return {
      success: true,
      data: { ganadores: conBoleta.length, sinVender: resueltos.length - conBoleta.length },
    };
  }

  const resueltos = resolverGanadores(
    rifa as Rifa,
    todos,
    (boletas as Boleta[]) ?? [],
    limpio,
    elegiblesDe,
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
  await revalidarPublica(rifaId);
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
  await revalidarPublica(rifaId);
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
      traerTodas<Boleta>((desde, hasta) =>
        supabase.from("boletas").select("*").eq("rifa_id", rifaId).order("numero").range(desde, hasta),
      ),
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
  await revalidarPublica(rifaId);
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

  invalidarPublica(r.slug_publico);
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
  await revalidarPublica(rifaId);
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
  await revalidarPublica(rifaId);
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
    | "min_numeros_compra"
    | "solo_pagadas_juegan"
    | "permite_abonos"
    | "abono_minimo"
    | "dias_limite_pago"
  >;
  premios: (Pick<
    Premio,
    | "tipo"
    | "descripcion"
    | "valor"
    | "criterio"
    | "orden"
    | "imagen_url"
    | "fecha_loteria"
    | "minimo_para_jugar"
  > & {
    /** Ya se conoce el resultado de la lotería de este premio. */
    jugado: boolean;
    /** Número que salió (cifras del resultado según el criterio del premio). */
    numero_ganador: number | null;
  })[];
  /**
   * Números tomados como bitmap en base64 (bit i = número `inicio + i`). Con
   * 10.000 números son ~1,7 KB, contra ~250 KB de la grilla como objetos; el
   * cliente la arma con `decodificarOcupados`.
   */
  ocupados: string;
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
  // Cada visitante sondea cada 8 s (2 s durante el sorteo): con cientos de
  // personas mirando la misma rifa, sin caché serían cientos de lecturas de
  // hasta 10.000 boletas por minuto. Se comparte una sola lectura por rifa
  // durante unos segundos; toda mutación la expira al instante (invalidarPublica).
  return unstable_cache(() => cargarRifaPublica(slug), ["rifa-publica", slug], {
    revalidate: 5,
    tags: [tagRifaPublica(slug)],
  })();
}

async function cargarRifaPublica(slug: string): Promise<ActionResult<RifaPublica>> {
  const svc = createServiceRoleClient();
  const { data: rifa } = await svc
    .from("rifas")
    .select("*")
    .eq("slug_publico", slug)
    .maybeSingle();

  if (!rifa) return { success: false, error: "Rifa no encontrada" };
  const r = rifa as Rifa;
  if (r.estado === "borrador" || r.estado === "cancelada" || r.archivada_at) {
    return { success: false, error: "Esta rifa no está disponible" };
  }
  if (await organizadorBloqueado(svc, r.tenant_id)) {
    return { success: false, error: RIFA_PAUSADA };
  }

  const [{ data: premios }, { data: boletas }, { data: pago }, { data: gan }] =
    await Promise.all([
      svc.from("premios").select("*").eq("rifa_id", r.id).order("orden"),
      // Solo los tomados y solo el número: es lo único que el público necesita.
      traerTodas<{ numero: number }>((desde, hasta) =>
        svc
          .from("boletas")
          .select("numero")
          .eq("rifa_id", r.id)
          .neq("estado", "libre")
          .order("numero")
          .range(desde, hasta),
      ),
      svc.from("tenant_pago_config").select("*").eq("tenant_id", r.tenant_id).maybeSingle(),
      svc
        .from("ganadores")
        .select("numero, premio_id, mensaje_felicitacion")
        .eq("rifa_id", r.id)
        .eq("publicado", true),
    ]);

  const tomados = ((boletas as { numero: number }[]) ?? []).map((b) => b.numero);
  const ocupados = codificarOcupados(r, tomados);

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
        min_numeros_compra: r.min_numeros_compra ?? 1,
        solo_pagadas_juegan: r.solo_pagadas_juegan,
        permite_abonos: r.permite_abonos ?? false,
        abono_minimo: r.abono_minimo ?? null,
        dias_limite_pago: r.dias_limite_pago ?? null,
      },
      premios: ((premios as Premio[]) ?? []).map((p) => {
        // El resultado de la lotería es público: se muestra el número que salió
        // apenas el organizador lo ingresa (por premio, o el de la rifa).
        const resultado = p.resultado_loteria ?? (r.tipo === "loteria" ? r.resultado_loteria : null);
        const cifras = resultado ? cifrasDeResultado(resultado, r.formato_cifras) : null;
        const numeroGanador = cifras
          ? p.criterio === "primeras_2"
            ? cifras.primeras
            : cifras.ultimas
          : (filasGanadores.find((g) => g.premio_id === p.id)?.numero ?? null);
        return {
        jugado: !!resultado || filasGanadores.some((g) => g.premio_id === p.id),
        numero_ganador: numeroGanador,
        tipo: p.tipo,
        descripcion: p.descripcion,
        valor: p.valor,
        criterio: p.criterio,
        orden: p.orden,
        imagen_url: p.imagen_url ?? null,
        fecha_loteria: p.fecha_loteria ?? null,
        minimo_para_jugar: p.minimo_para_jugar ?? null,
        };
      }),
      ocupados,
      disponibles: r.cantidad_numeros - new Set(tomados).size,
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
  if (r.estado !== "activa" || r.archivada_at) {
    return { success: false, error: "Esta rifa no está recibiendo reservas" };
  }
  if (await organizadorBloqueado(svc, r.tenant_id)) {
    return { success: false, error: RIFA_PAUSADA };
  }

  const enRango = [...new Set(d.numeros)].filter((n) => numeroEnRango(r, n));
  if (enRango.length === 0) return { success: false, error: "Números fuera de rango" };

  // Mínimo por compra. Si ya quedan menos libres que el mínimo, basta con
  // llevarse todos los que quedan (si no, la rifa nunca se podría terminar).
  const minimo = Math.max(1, r.min_numeros_compra ?? 1);
  let exigido = minimo;
  if (minimo > 1) {
    const { count: tomados } = await svc
      .from("boletas")
      .select("id", { count: "exact", head: true })
      .eq("rifa_id", r.id);
    exigido = Math.min(minimo, Math.max(1, r.cantidad_numeros - (tomados ?? 0)));
    if (enRango.length < exigido) {
      return { success: false, error: `Cada compra debe llevar mínimo ${exigido} números` };
    }
  }

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

  // Alguien se llevó parte de los elegidos y lo que quedó no llega al mínimo:
  // se sueltan los que sí entraron para no dejar una compra a medias.
  if (reservados.length > 0 && reservados.length < exigido) {
    await svc
      .from("boletas")
      .delete()
      .eq("rifa_id", r.id)
      .eq("estado", "reservado")
      .in("numero", reservados);
    invalidarPublica(d.slug);
    return {
      success: false,
      error: `Algunos números se tomaron mientras elegías (${ocupados.join(", ")}). Elige otros para completar mínimo ${exigido}.`,
    };
  }

  invalidarPublica(d.slug);
  if (reservados.length === 0) {
    return { success: false, error: "Los números elegidos ya están tomados" };
  }
  return { success: true, data: { reservados, ocupados } };
}
