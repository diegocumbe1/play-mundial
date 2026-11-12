import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { CuentaCobro } from "@/types";

/**
 * Lectura por enlace secreto: la usa la página pública `/cobro/<clave>`. La clave
 * es larga e imposible de adivinar; sin ella no hay forma de listar cuentas.
 */
export async function getCuentaPorClave(clave: string): Promise<CuentaCobro | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(clave)) return null;
  const { data } = await createServiceRoleClient()
    .from("cuentas_cobro")
    .select("*")
    .eq("clave", clave)
    .maybeSingle();
  return (data as CuentaCobro | null) ?? null;
}
