import { upsertPartidos } from "@/actions/partidos";
import { fetchFixtures } from "@/lib/futbol-api";
import { notificarPartidosFinalizados } from "@/lib/push";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Sincroniza los partidos del Mundial desde el proveedor hacia Supabase.
 *
 * Se invoca por cron (ver supabase/pg_cron_sync.sql) y puede dispararse manual.
 * Protegido por CRON_SECRET: el cron envía `Authorization: Bearer <secret>`.
 *
 * Dos cadencias (polling adaptativo, ver pg_cron_sync.sql):
 *   - base:  sin parámetros, cada 15 min, SIEMPRE consulta al proveedor.
 *   - vivo:  `?modo=live`, cada 3 min, solo consulta al proveedor si hay un
 *            partido en ventana activa. Si no, responde sin gastar cuota.
 */
export const dynamic = "force-dynamic";
// El fetch al proveedor puede reintentar varias veces; damos margen para que
// la función no muera antes de terminar (Vercel Hobby permite hasta 60s).
export const maxDuration = 30;

// Ventana en la que un partido se considera "activo" (potencialmente en vivo):
// desde 10 min antes del saque hasta ~2.5h después (duración real con descanso).
const MIN_ANTES_SAQUE = 10;
const MIN_DESPUES_SAQUE = 150;

/**
 * Consulta barata a la BD (sin tocar la API externa): ¿hay algún partido que
 * podría estar en vivo ahora mismo? Sirve para decidir si vale la pena gastar
 * una llamada al proveedor en el modo de polling rápido.
 */
async function hayPartidoActivo(): Promise<boolean> {
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

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  // En modo "vivo" (cron rápido) saltamos el fetch si no hay nada en juego.
  const modo = new URL(request.url).searchParams.get("modo");
  if (modo === "live" && !(await hayPartidoActivo())) {
    return Response.json({ ok: true, omitido: "sin partidos activos" });
  }

  try {
    const partidos = await fetchFixtures();
    const result = await upsertPartidos(partidos);

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 502 });
    }

    // Avisar al admin de partidos recién finalizados con apuestas (idempotente).
    await notificarPartidosFinalizados().catch(() => {});

    return Response.json({
      ok: true,
      sincronizados: result.data.count,
      recibidos: partidos.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return Response.json({ error: message }, { status: 500 });
  }
}
