"use server";

import { z } from "zod";

import { getMembership } from "@/lib/auth";
import { tieneProductoHabilitado } from "@/lib/productos";
import { enviarPushDispositivo } from "@/lib/push";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MINUTOS_RECORDATORIO } from "@/lib/torneo-avisos-reglas";
import type { ActionResult, Membership } from "@/types";

const preferenciasSchema = z.object({
  minutos_antes: z.number().refine((m) => (MINUTOS_RECORDATORIO as readonly number[]).includes(m)),
  partido_nuevo: z.boolean(),
  en_vivo: z.boolean(),
  finalizado: z.boolean(),
  siguiente: z.boolean(),
});

const suscripcionSchema = z.object({
  endpoint: z.string().url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export type PreferenciasAvisos = z.infer<typeof preferenciasSchema>;

async function organizador(): Promise<Membership | null> {
  const membership = await getMembership();
  if (!membership) return null;
  if (membership.rol === "superadmin") return membership;
  return (await tieneProductoHabilitado(membership.tenant_id, "torneos")) ? membership : null;
}

const NO_AUTORIZADO = { success: false as const, error: "No autorizado" };

/** Preferencias de este dispositivo; `null` si aún no está suscrito a torneos. */
export async function getPreferenciasAvisos(
  endpoint: string,
): Promise<ActionResult<PreferenciasAvisos | null>> {
  const m = await organizador();
  if (!m) return NO_AUTORIZADO;
  const { data } = await createServiceRoleClient()
    .from("suscripciones_avisos_torneo")
    .select("minutos_antes, partido_nuevo, en_vivo, finalizado, siguiente")
    .eq("endpoint", endpoint)
    .eq("tenant_id", m.tenant_id)
    .maybeSingle();
  return { success: true, data: (data as PreferenciasAvisos | null) ?? null };
}

/** Activa los avisos en este dispositivo o actualiza sus preferencias. */
export async function guardarAvisos(sub: unknown, preferencias: unknown): Promise<ActionResult> {
  const m = await organizador();
  if (!m) return NO_AUTORIZADO;
  const s = suscripcionSchema.safeParse(sub);
  const p = preferenciasSchema.safeParse(preferencias);
  if (!s.success || !p.success) return { success: false, error: "Datos de notificación inválidos" };

  const { error } = await createServiceRoleClient()
    .from("suscripciones_avisos_torneo")
    .upsert(
      {
        endpoint: s.data.endpoint,
        p256dh: s.data.keys.p256dh,
        auth: s.data.keys.auth,
        tenant_id: m.tenant_id,
        user_id: m.user_id,
        ...p.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  return error ? { success: false, error: error.message } : { success: true, data: undefined };
}

/** Apaga los avisos de torneos en este dispositivo. */
export async function quitarAvisos(endpoint: string): Promise<ActionResult> {
  const m = await organizador();
  if (!m) return NO_AUTORIZADO;
  await createServiceRoleClient()
    .from("suscripciones_avisos_torneo")
    .delete()
    .eq("endpoint", endpoint)
    .eq("tenant_id", m.tenant_id);
  return { success: true, data: undefined };
}

/** Comprueba que este dispositivo recibe avisos. */
export async function probarAvisos(sub: unknown): Promise<ActionResult> {
  const m = await organizador();
  if (!m) return NO_AUTORIZADO;
  const s = suscripcionSchema.safeParse(sub);
  if (!s.success) return { success: false, error: "Suscripción inválida" };
  const r = await enviarPushDispositivo(
    { endpoint: s.data.endpoint, p256dh: s.data.keys.p256dh, auth: s.data.keys.auth },
    {
      title: "Notificaciones activas",
      body: "Así te avisaremos de tus partidos.",
      url: "/admin/torneos",
      tag: "prueba-torneo",
    },
  );
  return r === "ok"
    ? { success: true, data: undefined }
    : { success: false, error: "No se pudo enviar la prueba a este dispositivo" };
}
