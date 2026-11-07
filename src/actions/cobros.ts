"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { tieneProductoHabilitado } from "@/lib/productos";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Cobro,
  PlanTenant,
  PlataformaConfig,
  PlataformaPagoConfig,
  ProductoPlataforma,
} from "@/types";

/**
 * Server Actions de monetización. Confirmar cobros y fijar precios son acciones
 * del DUEÑO de la plataforma (superadmin); se valida el rol en cada una.
 */

/** Cobros visibles: el miembro ve los suyos; el superadmin ve todos (RLS). */
export async function getCobros(): Promise<ActionResult<Cobro[]>> {
  const membership = await getMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as Cobro[]) ?? [] };
}

const cobroManualSchema = z.object({
  tenantId: z.string().uuid(),
  producto: z.enum(["rifas", "torneos"]),
  monto: z.number().int().min(1, "El monto debe ser mayor a 0"),
  meses: z.number().int().min(1).max(24),
  nota: z.string().trim().max(300).optional(),
});

/**
 * El superadmin registra un cobro acordado por fuera (precio negociado, varios
 * meses, etc.). Queda PENDIENTE: el acceso pago se activa al confirmar el pago.
 *
 * Si es de torneos, además habilita el módulo: el organizador ya acordó pagar
 * por él y necesita entrar a armar su torneo mientras paga.
 */
export async function registrarCobroManual(
  input: z.infer<typeof cobroManualSchema>,
): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "Solo el superadmin puede registrar cobros" };
  }
  const parsed = cobroManualSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { tenantId, producto, monto, meses, nota } = parsed.data;

  const svc = createServiceRoleClient();
  // Periodo en hora de Colombia: a las 8 p. m. del último día UTC ya es otro mes.
  const periodo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);

  const { error } = await svc.from("cobros").insert({
    tenant_id: tenantId,
    producto,
    tipo: "suscripcion",
    monto,
    meses,
    nota: nota || null,
    estado: "pendiente",
    periodo,
  });
  if (error) return { success: false, error: error.message };

  if (producto === "torneos") {
    const { error: errProd } = await svc
      .from("tenant_productos")
      .upsert(
        { tenant_id: tenantId, producto: "torneos", habilitado: true },
        { onConflict: "tenant_id,producto" },
      );
    if (errProd) return { success: false, error: errProd.message };
  }

  revalidatePath("/superadmin");
  revalidatePath("/admin");
  return { success: true, data: undefined };
}

/** Anula un cobro pendiente registrado por error. Solo superadmin. */
export async function anularCobro(cobroId: string): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "Solo el superadmin puede anular cobros" };
  }
  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("cobros")
    .update({ estado: "anulado" })
    .eq("id", cobroId)
    .eq("estado", "pendiente")
    .select("id");
  if (error) return { success: false, error: error.message };
  if (!data?.length) return { success: false, error: "El cobro ya no está pendiente" };

  revalidatePath("/superadmin");
  return { success: true, data: undefined };
}

/**
 * Confirma un cobro (prepago manual vía Nequi). Solo superadmin.
 * - pago_rifa → activa la rifa asociada.
 * - suscripcion de rifas → extiende `suscripcion_vence_at` los `meses` del
 *   cobro (1 por defecto) y marca el plan.
 * - suscripcion de torneos → extiende `suscripcion_torneos_vence_at` igual.
 */
export async function confirmarCobro(
  cobroId: string,
  comprobante: string | null = null,
): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "Solo el superadmin puede confirmar cobros" };
  }

  const svc = createServiceRoleClient();
  const { data: cobro } = await svc
    .from("cobros")
    .select("*")
    .eq("id", cobroId)
    .maybeSingle();
  if (!cobro) return { success: false, error: "Cobro no encontrado" };
  const c = cobro as Cobro;
  if (c.estado === "pagado") return { success: true, data: undefined };

  const ahora = new Date().toISOString();
  await svc
    .from("cobros")
    .update({ estado: "pagado", pagado_at: ahora, comprobante })
    .eq("id", cobroId);

  if (c.tipo === "pago_rifa") {
    await activarEntidadDelCobro(svc, c, "pago_rifa", ahora);
  } else if (c.tipo === "suscripcion") {
    const esTorneos = c.producto === "torneos";
    const columna = esTorneos ? "suscripcion_torneos_vence_at" : "suscripcion_vence_at";
    const { data: tenant } = await svc
      .from("tenants")
      .select("*")
      .eq("id", c.tenant_id)
      .maybeSingle();
    const actual = (tenant as Record<string, string | null> | null)?.[columna];
    const base =
      actual && new Date(actual).getTime() > Date.now()
        ? new Date(actual)
        : new Date();
    base.setMonth(base.getMonth() + (c.meses ?? 1));
    // `plan_actual` describe el plan de rifas: la suscripción de torneos no lo toca.
    await svc
      .from("tenants")
      .update({
        [columna]: base.toISOString(),
        ...(esTorneos ? {} : { plan_actual: "suscripcion" }),
      })
      .eq("id", c.tenant_id);
    // Activa la entidad que quedó pendiente por falta de plan, si la hay.
    await activarEntidadDelCobro(svc, c, "suscripcion", ahora);
  }

  revalidatePath("/superadmin");
  revalidatePath("/admin/rifas");
  revalidatePath("/admin/torneos");
  return { success: true, data: undefined };
}

/**
 * Activa la rifa o el torneo al que apunta un cobro confirmado.
 *
 * El ledger es multi-producto: cada vertical tiene su tabla y su columna de
 * fecha de activación. Los cobros antiguos no traen `producto` (default
 * `rifas`), por eso se decide por el id que venga poblado.
 */
async function activarEntidadDelCobro(
  svc: ReturnType<typeof createServiceRoleClient>,
  cobro: Cobro,
  cobroTipo: PlanTenant,
  ahora: string,
): Promise<void> {
  if (cobro.torneo_id) {
    await svc
      .from("torneos")
      .update({ estado: "inscripciones", cobro_tipo: cobroTipo, activado_at: ahora })
      .eq("id", cobro.torneo_id);
    return;
  }
  if (cobro.rifa_id) {
    await svc
      .from("rifas")
      .update({ estado: "activa", cobro_tipo: cobroTipo, activada_at: ahora })
      .eq("id", cobro.rifa_id);
  }
}

/** El owner solicita una suscripción → crea un cobro pendiente (lo confirma el superadmin). */
export async function solicitarSuscripcion(
  producto: ProductoPlataforma = "rifas",
): Promise<ActionResult<{ pago: PlataformaPagoConfig | null }>> {
  const membership = await getMembership();
  if (!membership) return { success: false, error: "Sin sesión" };
  if (
    producto === "torneos" &&
    membership.rol !== "superadmin" &&
    !(await tieneProductoHabilitado(membership.tenant_id, "torneos"))
  ) {
    return { success: false, error: "Tu cuenta no tiene habilitado el módulo de torneos deportivos" };
  }

  const svc = createServiceRoleClient();
  const [{ data: cfg }, { data: pago }] = await Promise.all([
    svc.from("plataforma_config").select("*").limit(1).maybeSingle(),
    svc.from("plataforma_pago_config").select("*").limit(1).maybeSingle(),
  ]);
  const config = cfg as Partial<PlataformaConfig> | null;
  const monto =
    (producto === "torneos"
      ? config?.precio_suscripcion_torneos_mes
      : config?.precio_suscripcion_mes) ?? 0;
  if (monto <= 0) {
    return { success: false, error: "Esta suscripción todavía no tiene precio" };
  }

  const periodo = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { error } = await svc.from("cobros").insert({
    tenant_id: membership.tenant_id,
    producto,
    tipo: "suscripcion",
    monto,
    estado: "pendiente",
    periodo,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/rifas");
  return { success: true, data: { pago: (pago as PlataformaPagoConfig | null) ?? null } };
}

const configSchema = z.object({
  cobro_rifa_modo: z.enum(["porcentaje", "boleta", "escalones"]).default("porcentaje"),
  cobro_rifa_pct: z.number().min(0).max(100).default(1),
  pro_max_rifas_ciclo: z.number().int().min(1).max(100).default(10),
  cobro_rifa_min: z.number().int().min(0).default(0),
  cobro_rifa_max: z.number().int().min(0).default(0),
  cobro_rifa_max_5000: z.number().int().min(0).default(0),
  cobro_rifa_max_10000: z.number().int().min(0).default(0),
  cobro_rifa_umbral_comercial: z.number().int().min(0).default(0),
  cobro_rifa_comercial: z.number().int().min(0).default(0),
  moneda: z.string().trim().min(1).default("COP"),
  precio_rifa_100: z.number().int().min(0),
  precio_rifa_500: z.number().int().min(0),
  precio_rifa_1000: z.number().int().min(0),
  precio_suscripcion_mes: z.number().int().min(0),
  free_rifas_por_mes: z.number().int().min(0),
  free_rifas_total: z.number().int().min(0),
  free_max_numeros: z.number().int().min(1),
  free_max_precio_numero: z.number().int().min(0).default(0),
  // Torneos: escalones por cupo de equipos y reglas de su capa gratuita.
  precio_torneo_8: z.number().int().min(0),
  precio_torneo_16: z.number().int().min(0),
  precio_torneo_32: z.number().int().min(0),
  precio_torneo_mas: z.number().int().min(0),
  precio_suscripcion_torneos_mes: z.number().int().min(0).default(0),
  free_torneos_por_mes: z.number().int().min(0),
  free_torneos_total: z.number().int().min(0),
  free_max_equipos: z.number().int().min(1),
});

/** Edita los precios y reglas del free. Solo superadmin. */
export async function guardarPlataformaConfig(
  input: z.infer<typeof configSchema>,
): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "Solo el superadmin puede editar precios" };
  }
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("plataforma_config")
    .update(parsed.data satisfies Partial<PlataformaConfig>)
    .eq("id", true);
  if (error) return { success: false, error: error.message };

  revalidatePath("/superadmin/settings");
  revalidatePath("/precios");
  return { success: true, data: undefined };
}

const plataformaPagoSchema = z.object({
  nequi_llave: z.string().trim().nullable().optional(),
  cuenta_tipo: z.string().trim().nullable().optional(),
  cuenta_numero: z.string().trim().nullable().optional(),
  llave: z.string().trim().nullable().optional(),
  titular: z.string().trim().nullable().optional(),
  qr_url: z.string().trim().nullable().optional(),
  whatsapp: z.string().trim().nullable().optional(),
  mensaje_qr: z.string().trim().nullable().optional(),
});

/** Edita los medios de pago de la plataforma para planes/prepagos. Solo superadmin. */
export async function guardarPlataformaPagoConfig(
  input: z.infer<typeof plataformaPagoSchema>,
): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "Solo el superadmin puede editar pagos" };
  }
  const parsed = plataformaPagoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const cuentaNumero = d.cuenta_numero?.trim() || d.nequi_llave?.trim() || "";
  const cuentaTipo = d.cuenta_tipo?.trim() || (cuentaNumero ? "nequi" : "");

  if (!cuentaNumero && !d.llave?.trim()) {
    return { success: false, error: "Indica al menos un medio de pago: cuenta o Llave Bre-B" };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc.from("plataforma_pago_config").upsert({
    id: true,
    nequi_llave: cuentaTipo === "nequi" ? cuentaNumero : null,
    cuenta_tipo: cuentaTipo || null,
    cuenta_numero: cuentaNumero || null,
    llave: d.llave?.trim() || null,
    titular: d.titular?.trim() || null,
    qr_url: d.qr_url?.trim() || null,
    whatsapp: d.whatsapp?.trim() || null,
    mensaje_qr: d.mensaje_qr?.trim() || null,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/superadmin/settings");
  return { success: true, data: undefined };
}

/** Sube el QR de cobro de la plataforma. Solo superadmin. */
export async function subirQrPlataforma(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "Solo el superadmin puede subir el QR" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecciona una imagen" };
  }
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "El archivo debe ser una imagen" };
  }
  if (file.size > 3 * 1024 * 1024) {
    return { success: false, error: "La imagen no puede superar 3 MB" };
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `plataforma/qr-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const svc = createServiceRoleClient();
  const { error } = await svc.storage
    .from("qr-pagos")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (error) return { success: false, error: error.message };

  const { data } = svc.storage.from("qr-pagos").getPublicUrl(path);
  return { success: true, data: { url: data.publicUrl } };
}
