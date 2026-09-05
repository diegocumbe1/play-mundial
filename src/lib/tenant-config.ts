import { createClient } from "@/lib/supabase/server";
import type { PlataformaConfig, PlataformaPagoConfig, TenantPagoConfig } from "@/types";

/**
 * Config de cobro POR TENANT (cuenta/Bre-B/QR/WhatsApp). Reemplaza el `POLLA.banco`
 * fijo: cada tenant configura sus propios datos. Devuelve `null` si el tenant
 * aún no la definió. Lectura pública (la usa la página pública y el flyer).
 */
export async function getPagoConfig(
  tenantId: string,
): Promise<TenantPagoConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_pago_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantPagoConfig | null) ?? null;
}

/**
 * Config de plataforma (precios + reglas del free), fila única editable por el
 * superadmin. Devuelve valores por defecto si aún no hay fila.
 */
export async function getPlataformaConfig(): Promise<PlataformaConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plataforma_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  const defaults: PlataformaConfig = {
    moneda: "COP",
    // Por defecto la rifa cuesta una boleta, sin piso ni techo.
    cobro_rifa_modo: "boleta",
    cobro_rifa_min: 0,
    cobro_rifa_max: 0,
    precio_rifa_100: 0,
    precio_rifa_500: 0,
    precio_rifa_1000: 0,
    precio_suscripcion_mes: 0,
    free_rifas_por_mes: 1,
    free_rifas_total: 2,
    free_max_numeros: 100,
    precio_torneo_8: 0,
    precio_torneo_16: 0,
    precio_torneo_32: 0,
    precio_torneo_mas: 0,
    free_torneos_por_mes: 1,
    free_torneos_total: 2,
    free_max_equipos: 8,
    updated_at: new Date(0).toISOString(),
  };
  return { ...defaults, ...((data as Partial<PlataformaConfig> | null) ?? {}) };
}

/** Datos de transferencia de la plataforma para cobros de planes/prepagos. */
export async function getPlataformaPagoConfig(): Promise<PlataformaPagoConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plataforma_pago_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  return (data as PlataformaPagoConfig | null) ?? null;
}
