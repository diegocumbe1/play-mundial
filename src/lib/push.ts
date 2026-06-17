import "server-only";

import webpush from "web-push";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { calcularResultadoPartido } from "@/lib/polla";
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
 * Avisa de partidos que finalizaron y tienen apuestas, una sola vez cada uno.
 * Pensado para llamarse después de cada sincronización. Idempotente vía el
 * flag `aviso_final_enviado`. Nunca lanza (envuelve sus errores).
 */
export async function notificarPartidosFinalizados(): Promise<void> {
  if (!configurar()) return;

  const supabase = createServiceRoleClient();
  const { data: partidos } = await supabase
    .from("partidos")
    .select("*")
    .eq("estado", "finalizado")
    .eq("aviso_final_enviado", false);

  if (!partidos || partidos.length === 0) return;

  for (const p of partidos as Partido[]) {
    try {
      const { data: aps } = await supabase
        .from("apuestas")
        .select("*")
        .eq("partido_id", p.id);
      const apuestas = (aps ?? []) as Apuesta[];

      if (apuestas.length > 0) {
        const r = calcularResultadoPartido(p, apuestas);
        const marcador = `${p.goles_local}–${p.goles_visitante}`;
        const nombres = r.ganadores
          .map((g) => g.nombre)
          .slice(0, 3)
          .join(", ");
        const body =
          r.ganadores.length > 0
            ? `${p.equipo_local} ${marcador} ${p.equipo_visitante} · ${r.ganadores.length} ganador(es): ${nombres}`
            : `${p.equipo_local} ${marcador} ${p.equipo_visitante} · nadie acertó, queda en casa`;

        await enviarPushAdmins({
          title: "⚽ Partido finalizado",
          body,
          url: `/partidos/${p.id}`,
          tag: `final-${p.id}`,
        });
      }

      await supabase
        .from("partidos")
        .update({ aviso_final_enviado: true })
        .eq("id", p.id);
    } catch {
      // No frenar el resto si uno falla.
    }
  }
}
