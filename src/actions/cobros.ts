"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Cobro,
  PlanTenant,
  PlataformaConfig,
  PlataformaPagoConfig,
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

/**
 * Confirma un cobro (prepago manual vía Nequi). Solo superadmin.
 * - pago_rifa → activa la rifa asociada.
 * - suscripcion → extiende `suscripcion_vence_at` un mes y marca el plan.
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
    const { data: tenant } = await svc
      .from("tenants")
      .select("suscripcion_vence_at")
      .eq("id", c.tenant_id)
      .maybeSingle();
    const actual = (tenant as { suscripcion_vence_at: string | null } | null)
      ?.suscripcion_vence_at;
    const base =
      actual && new Date(actual).getTime() > Date.now()
        ? new Date(actual)
        : new Date();
    base.setMonth(base.getMonth() + 1);
    await svc
      .from("tenants")
      .update({ plan_actual: "suscripcion", suscripcion_vence_at: base.toISOString() })
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
export async function solicitarSuscripcion(): Promise<ActionResult<{ pago: PlataformaPagoConfig | null }>> {
  const membership = await getMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const svc = createServiceRoleClient();
  const [{ data: cfg }, { data: pago }] = await Promise.all([
    svc.from("plataforma_config").select("precio_suscripcion_mes").limit(1).maybeSingle(),
    svc.from("plataforma_pago_config").select("*").limit(1).maybeSingle(),
  ]);
  const monto = (cfg as { precio_suscripcion_mes: number } | null)?.precio_suscripcion_mes ?? 0;

  const periodo = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { error } = await svc.from("cobros").insert({
    tenant_id: membership.tenant_id,
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
  moneda: z.string().trim().min(1).default("COP"),
  precio_rifa_100: z.number().int().min(0),
  precio_rifa_500: z.number().int().min(0),
  precio_rifa_1000: z.number().int().min(0),
  precio_suscripcion_mes: z.number().int().min(0),
  free_rifas_por_mes: z.number().int().min(0),
  free_rifas_total: z.number().int().min(0),
  free_max_numeros: z.number().int().min(1),
  // Torneos: escalones por cupo de equipos y reglas de su capa gratuita.
  precio_torneo_8: z.number().int().min(0),
  precio_torneo_16: z.number().int().min(0),
  precio_torneo_32: z.number().int().min(0),
  precio_torneo_mas: z.number().int().min(0),
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
