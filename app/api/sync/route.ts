import { upsertPartidos } from "@/actions/partidos";
import { fetchFixtures } from "@/lib/futbol-api";

/**
 * Sincroniza los partidos del Mundial desde API-Football hacia Supabase.
 *
 * Se invoca por cron (ver vercel.json) y puede dispararse manualmente.
 * Protegido por CRON_SECRET: Vercel Cron envía `Authorization: Bearer <secret>`.
 */
export const dynamic = "force-dynamic";
// El fetch al proveedor puede reintentar varias veces; damos margen para que
// la función no muera antes de terminar (Vercel Hobby permite hasta 60s).
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    const partidos = await fetchFixtures();
    const result = await upsertPartidos(partidos);

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 502 });
    }

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
