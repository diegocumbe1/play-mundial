"use server";

import { getUser } from "@/lib/auth";
import { enviarPushAdmins } from "@/lib/push";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

type SubInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Guarda (o actualiza) la suscripción push del dispositivo del admin. */
export async function guardarSuscripcion(
  sub: SubInput,
): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { success: false, error: "Suscripción inválida" };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, data: undefined };
}

/** Elimina la suscripción del dispositivo actual. */
export async function eliminarSuscripcion(
  endpoint: string,
): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }
  const supabase = createServiceRoleClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { success: true, data: undefined };
}

/** Envía una notificación de prueba a los dispositivos del admin. */
export async function enviarPruebaPush(): Promise<ActionResult> {
  if (!(await getUser())) {
    return { success: false, error: "No autorizado" };
  }
  await enviarPushAdmins({
    title: "🔔 Notificaciones activas",
    body: "Te avisaré de nuevas apuestas y partidos finalizados.",
    url: "/admin",
  });
  return { success: true, data: undefined };
}
