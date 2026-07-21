"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult, Cobro, PlataformaConfig } from "@/types";

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

  if (c.tipo === "pago_rifa" && c.rifa_id) {
    await svc
      .from("rifas")
      .update({ estado: "activa", cobro_tipo: "pago_rifa", activada_at: ahora })
      .eq("id", c.rifa_id);
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
    // Activa la rifa que quedó pendiente por falta de plan, si la hay.
    if (c.rifa_id) {
      await svc
        .from("rifas")
        .update({ estado: "activa", cobro_tipo: "suscripcion", activada_at: ahora })
        .eq("id", c.rifa_id);
    }
  }

  revalidatePath("/superadmin");
  return { success: true, data: undefined };
}

/** El owner solicita una suscripción → crea un cobro pendiente (lo confirma el superadmin). */
export async function solicitarSuscripcion(): Promise<ActionResult> {
  const membership = await getMembership();
  if (!membership) return { success: false, error: "Sin sesión" };

  const svc = createServiceRoleClient();
  const { data: cfg } = await svc
    .from("plataforma_config")
    .select("precio_suscripcion_mes")
    .limit(1)
    .maybeSingle();
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
  return { success: true, data: undefined };
}

const configSchema = z.object({
  moneda: z.string().trim().min(1).default("COP"),
  precio_rifa_100: z.number().int().min(0),
  precio_rifa_500: z.number().int().min(0),
  precio_suscripcion_mes: z.number().int().min(0),
  free_rifas_por_mes: z.number().int().min(0),
  free_rifas_total: z.number().int().min(0),
  free_max_numeros: z.number().int().min(1),
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
