"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getUser } from "@/lib/auth";
import {
  enviarEmail,
  enviarEmailPrueba,
  estadoCredenciales,
  getEmailConfig,
  plantillaEmail,
  type EstadoCanal,
} from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/**
 * Configuración del correo saliente y verificación de cuentas.
 *
 * La API key de Resend NUNCA vuelve al cliente: la pantalla del superadmin solo
 * recibe una pista enmascarada. Guardar sin tocar ese campo conserva la key que
 * ya estaba (así se puede editar el remitente sin volver a pegarla).
 */

/** Lo que ve el superadmin: la key nunca viaja, solo su pista. */
export interface EmailConfigVista {
  tieneKey: boolean;
  /** Ej. `re_…a1b2`. Suficiente para saber cuál está puesta. */
  pistaKey: string | null;
  from_email: string | null;
  from_nombre: string | null;
  reply_to: string | null;
  activo: boolean;
  estado: EstadoCanal;
}

export async function getEmailConfigVista(): Promise<ActionResult<EmailConfigVista>> {
  if (!(await esSuperadmin())) return { success: false, error: "No autorizado" };

  const c = await getEmailConfig();
  const key = c.resend_api_key ?? "";
  return {
    success: true,
    data: {
      tieneKey: Boolean(key),
      pistaKey: key ? `${key.slice(0, 3)}…${key.slice(-4)}` : null,
      from_email: c.from_email,
      from_nombre: c.from_nombre,
      reply_to: c.reply_to,
      activo: c.activo,
      estado: estadoCredenciales(c),
    },
  };
}

const emailConfigSchema = z.object({
  /** Vacío = conservar la key actual (no se borra por descuido). */
  resend_api_key: z.string().trim().optional(),
  from_email: z.string().trim().email("Correo remitente inválido").or(z.literal("")),
  from_nombre: z.string().trim().max(80).optional(),
  reply_to: z.string().trim().email("Reply-to inválido").or(z.literal("")).optional(),
  activo: z.boolean().default(false),
});

export async function guardarEmailConfig(
  input: z.infer<typeof emailConfigSchema>,
): Promise<ActionResult> {
  if (!(await esSuperadmin())) return { success: false, error: "No autorizado" };

  const parsed = emailConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const campos: Record<string, unknown> = {
    from_email: d.from_email || null,
    from_nombre: d.from_nombre?.trim() || null,
    reply_to: d.reply_to || null,
    activo: d.activo,
  };
  // Solo se pisa la key si el superadmin escribió una nueva.
  if (d.resend_api_key) campos.resend_api_key = d.resend_api_key;

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("plataforma_email_config")
    .update(campos)
    .eq("id", true);
  if (error) return { success: false, error: error.message };

  revalidatePath("/superadmin/settings");
  return { success: true, data: undefined };
}

/** Envío de prueba: valida credenciales sin exigir el canal encendido. */
export async function probarEmail(destino: string): Promise<ActionResult<{ id: string }>> {
  if (!(await esSuperadmin())) return { success: false, error: "No autorizado" };
  const to = destino.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { success: false, error: "Escribe un correo válido para la prueba" };
  }

  const r = await enviarEmailPrueba({
    to,
    subject: "Prueba de correo · Rifas",
    html: plantillaEmail({
      titulo: "El correo quedó funcionando",
      cuerpo:
        "Si estás leyendo esto, la API key de Resend y el remitente están bien configurados.",
    }),
  });
  if (!r.ok) return { success: false, error: r.error };
  return { success: true, data: { id: r.id } };
}

// ---------------------------------------------------------------------------
// Verificación de correo del organizador
// ---------------------------------------------------------------------------

/** ¿El usuario actual ya confirmó su correo? */
export async function estadoVerificacion(): Promise<
  ActionResult<{ verificado: boolean; email: string | null }>
> {
  const user = await getUser();
  if (!user) return { success: false, error: "Sin sesión" };
  return {
    success: true,
    data: {
      verificado: Boolean(user.email_confirmed_at),
      email: user.email ?? null,
    },
  };
}

/**
 * Manda (o vuelve a mandar) el correo de verificación.
 *
 * El enlace lo genera Supabase —es quien valida el token— pero el correo sale
 * por Resend, que es el canal que controlamos. Se usa el flujo de `token_hash`
 * contra nuestra ruta `/auth/confirmar`: el de fragmento `#` no llega al
 * servidor y no sirve en una app con sesión en cookies.
 */
export async function reenviarVerificacion(): Promise<ActionResult> {
  const user = await getUser();
  if (!user?.email) return { success: false, error: "Sin sesión" };
  if (user.email_confirmed_at) {
    return { success: false, error: "Tu correo ya está verificado" };
  }

  const svc = createServiceRoleClient();
  // `magiclink` y no `signup`: signup exige la contraseña (que no tenemos en
  // claro) y aquí lo único que se prueba es que el correo es suyo. Al verificar
  // el token, Supabase marca `email_confirmed_at`.
  const { data, error } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error || !data?.properties?.hashed_token) {
    return {
      success: false,
      error: error?.message ?? "No se pudo generar el enlace de verificación",
    };
  }

  const url = `${SITE_URL}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=email&next=${encodeURIComponent("/admin/rifas")}`;

  const r = await enviarEmail({
    to: user.email,
    subject: "Verifica tu correo para empezar a vender",
    html: plantillaEmail({
      titulo: "Confirma tu correo",
      cuerpo:
        "Ya puedes preparar tu rifa, pero para registrar el primer número necesitamos confirmar que este correo es tuyo. Toca el botón y sigues donde ibas.",
      cta: { texto: "Verificar mi correo", url },
    }),
  });
  if (!r.ok) return { success: false, error: r.error };

  return { success: true, data: undefined };
}
