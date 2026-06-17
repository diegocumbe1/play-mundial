import "server-only";

import webpush from "web-push";

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Apuesta, Partido } from "@/types";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@polla-mundial.app";

let configurado = false;

/** Configura VAPID una sola vez. Devuelve false si faltan llaves (no-op). */
function configurar(): boolean {
  if (configurado) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configurado = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** Envía una notificación a todos los dispositivos del admin suscritos. */
export async function enviarPushAdmins(payload: PushPayload): Promise<void> {
  if (!configurar()) return;

  const supabase = createServiceRoleClient();
  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  if (!subs || subs.length === 0) return;

  const cuerpo = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          cuerpo,
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404/410 = suscripción muerta: limpiarla.
        if (code === 404 || code === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    }),
  );
}

/**
 * Avisa del último partido finalizado no notificado que todavía tiene pagos
 * pendientes. Se procesa de a uno para no saturar al admin si hay historial
 * atrasado, e idempotente vía `aviso_final_enviado`.
 */
export async function notificarPartidosFinalizados(): Promise<void> {
  if (!configurar()) return;

  const supabase = createServiceRoleClient();
  const { data: partidos } = await supabase
    .from("partidos")
    .select("*")
    .eq("estado", "finalizado")
    .eq("aviso_final_enviado", false)
    .order("fecha", { ascending: false });

  if (!partidos || partidos.length === 0) return;

  const idsProcesados = (partidos as Partido[]).map((p) => p.id);

  for (const p of partidos as Partido[]) {
    try {
      const { data: aps } = await supabase
        .from("apuestas")
        .select("*")
        .eq("partido_id", p.id);
      const apuestas = (aps ?? []) as Apuesta[];
      const pendientes = apuestas.filter((a) => !a.pagado);

      if (pendientes.length > 0) {
        const marcador = `${p.goles_local}–${p.goles_visitante}`;
        const nombres = pendientes
          .map((a) => a.nombre)
          .slice(0, 3)
          .join(", ");
        const body = `${p.equipo_local} ${marcador} ${p.equipo_visitante} · ${pendientes.length} pago(s) pendiente(s): ${nombres}`;

        await enviarPushAdmins({
          title: "⚽ Partido finalizado con pagos pendientes",
          body,
          url: "/admin",
          tag: `final-${p.id}`,
        });

        break;
      }
    } catch {
      // No frenar el resto si uno falla.
    }
  }

  if (idsProcesados.length > 0) {
    await supabase
      .from("partidos")
      .update({ aviso_final_enviado: true })
      .in("id", idsProcesados);
  }
}
