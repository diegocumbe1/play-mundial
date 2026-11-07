import { procesarAvisosTorneo } from "@/lib/torneo-avisos";

/**
 * Avisos programados de torneos (ver supabase/pg_cron_avisos_torneo.sql).
 * Sin CRON_SECRET no corre: envía notificaciones y no debe quedar abierto.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await procesarAvisosTorneo()) });
  } catch (err) {
    console.error("[avisos-torneo]", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
