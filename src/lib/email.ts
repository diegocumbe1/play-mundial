import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Correo saliente vía Resend (API HTTP).
 *
 * Se usa HTTP y no SMTP a propósito: los PaaS suelen bloquear los puertos SMTP
 * salientes y el fallo aparece recién en producción. Tampoco hace falta
 * dependencia nueva — Node trae `fetch`.
 *
 * La configuración (API key, remitente, reply-to) vive en la base y la edita el
 * superadmin: rotar la key no debe requerir un redeploy. Las variables de
 * entorno quedan solo como respaldo. La tabla tiene RLS sin políticas, así que
 * la key solo se lee con service role desde el servidor.
 *
 * El dominio del remitente debe estar verificado en Resend (SPF + DKIM) o los
 * correos caen en spam.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailConfig {
  resend_api_key: string | null;
  from_email: string | null;
  from_nombre: string | null;
  reply_to: string | null;
  activo: boolean;
  updated_at: string;
}

/** Estado del canal, tal como se le muestra al superadmin. */
export interface EstadoCanal {
  listo: boolean;
  detalle: string;
}

/** Config efectiva: manda la base; el entorno solo cubre lo que falte. */
export async function getEmailConfig(): Promise<EmailConfig> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("plataforma_email_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  const fila = (data as Partial<EmailConfig> | null) ?? {};
  return {
    resend_api_key: fila.resend_api_key ?? process.env.RESEND_API_KEY ?? null,
    from_email: fila.from_email ?? process.env.MAIL_FROM ?? null,
    from_nombre: fila.from_nombre ?? process.env.MAIL_FROM_NAME ?? null,
    reply_to: fila.reply_to ?? process.env.MAIL_REPLY_TO ?? null,
    activo: fila.activo ?? false,
    updated_at: fila.updated_at ?? new Date(0).toISOString(),
  };
}

/** Remitente en el formato que espera Resend: `Nombre <correo>`. */
function remitente(c: EmailConfig): string {
  if (!c.from_email) return "";
  return c.from_nombre ? `${c.from_nombre} <${c.from_email}>` : c.from_email;
}

/**
 * ¿Están completas las credenciales? Ignora `activo` a propósito: el envío de
 * prueba tiene que funcionar ANTES de encender el canal, que es el orden
 * natural (configuro → pruebo → enciendo).
 */
export function estadoCredenciales(c: EmailConfig): EstadoCanal {
  if (!c.resend_api_key) return { listo: false, detalle: "Falta la API key de Resend" };
  if (!c.from_email) return { listo: false, detalle: "Falta el correo remitente" };
  return { listo: true, detalle: remitente(c) };
}

/** Estado del canal para los envíos reales (exige además que esté encendido). */
export async function estadoCanalEmail(): Promise<EstadoCanal> {
  const c = await getEmailConfig();
  const cred = estadoCredenciales(c);
  if (!cred.listo) return cred;
  if (!c.activo) return { listo: false, detalle: `Canal apagado · ${cred.detalle}` };
  return cred;
}

export interface EnvioEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function despachar(
  envio: EnvioEmail,
  c: EmailConfig,
  estado: EstadoCanal,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!estado.listo) {
    return { ok: false, error: `El correo no está configurado: ${estado.detalle}` };
  }

  const payload: Record<string, unknown> = {
    from: remitente(c),
    to: [envio.to],
    subject: envio.subject,
    html: envio.html,
  };
  if (envio.text) payload.text = envio.text;
  if (c.reply_to) payload.reply_to = c.reply_to;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      return { ok: false, error: `Resend respondió ${res.status}: ${detalle.slice(0, 300)}` };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? "sent" };
  } catch (err) {
    return { ok: false, error: `No se pudo contactar a Resend: ${(err as Error).message}` };
  }
}

/** Envío real: exige credenciales y que el canal esté encendido. */
export async function enviarEmail(envio: EnvioEmail) {
  const c = await getEmailConfig();
  return despachar(envio, c, await estadoCanalEmail());
}

/** Envío de prueba: solo exige credenciales, no que el canal esté activo. */
export async function enviarEmailPrueba(envio: EnvioEmail) {
  const c = await getEmailConfig();
  return despachar(envio, c, estadoCredenciales(c));
}

/**
 * Plantilla mínima y sobria. Sin imágenes remotas: muchos clientes de correo
 * las bloquean y el mensaje tiene que entenderse igual.
 */
export function plantillaEmail({
  titulo,
  cuerpo,
  cta,
}: {
  titulo: string;
  cuerpo: string;
  cta?: { texto: string; url: string };
}): string {
  const boton = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#f5c518;color:#0a0a0f;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">${cta.texto}</a></p>
       <p style="color:#6b7280;font-size:12px">Si el botón no abre, copia este enlace:<br>${cta.url}</p>`
    : "";

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:16px;padding:28px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827">${titulo}</h1>
      <div style="color:#374151;font-size:15px;line-height:1.6">${cuerpo}</div>
      ${boton}
    </div>
  </div>
</body></html>`;
}
