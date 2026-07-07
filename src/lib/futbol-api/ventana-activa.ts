import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Gate de cuota: ¿hay algún partido que podría estar en vivo AHORA?
 *
 * Es una consulta barata a la BD (no toca ninguna API externa). Sirve para
 * decidir si vale la pena gastar una llamada a flashscore/al proveedor. Fuera
 * de la ventana activa, el consumo de flashscore es CERO.
 */

/** Ventana activa: desde 10 min antes del saque hasta ~2.5h después. */
export const MIN_ANTES_SAQUE = 10;
export const MIN_DESPUES_SAQUE = 150;

export async function hayPartidoActivo(): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const ahora = Date.now();
  const desde = new Date(ahora - MIN_DESPUES_SAQUE * 60_000).toISOString();
  const hasta = new Date(ahora + MIN_ANTES_SAQUE * 60_000).toISOString();

  const { count } = await supabase
    .from("partidos")
    .select("id", { count: "exact", head: true })
    .neq("estado", "finalizado")
    .neq("estado", "cancelado")
    .gte("fecha", desde)
    .lte("fecha", hasta);

  return (count ?? 0) > 0;
}
