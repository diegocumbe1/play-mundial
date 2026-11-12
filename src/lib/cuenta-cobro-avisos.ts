import "server-only";

import { enviarEmail, plantillaEmail } from "@/lib/email";
import { enviarPushDispositivo } from "@/lib/push";
import { SITE_URL } from "@/lib/site-url";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { numeroCuenta } from "@/lib/cuenta-cobro";
import { estaPausado } from "@/lib/torneo-avisos-reglas";
import { formatCOP } from "@/lib/torneos";
import type { CuentaCobro } from "@/types";

/** Texto del cliente dentro de un correo HTML: nunca se inserta sin escapar. */
const esc = (v: string | null | undefined): string =>
  (v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface SuscripcionAviso {
  endpoint: string;
  p256dh: string;
  auth: string;
  pausado_hasta: string | null;
}

/** Celulares del superadmin que activaron avisos (los mismos de los avisos de torneo). */
async function dispositivosSuperadmin(): Promise<SuscripcionAviso[]> {
  const svc = createServiceRoleClient();
  const { data: supers } = await svc.from("memberships").select("user_id").eq("rol", "superadmin");
  const ids = ((supers as { user_id: string }[]) ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data } = await svc
    .from("suscripciones_avisos_torneo")
    .select("endpoint, p256dh, auth, pausado_hasta")
    .in("user_id", ids);
  const ahora = new Date();
  return ((data as SuscripcionAviso[]) ?? []).filter((s) => !estaPausado(s.pausado_hasta, ahora));
}

async function avisarCelular(c: CuentaCobro): Promise<void> {
  const subs = await dispositivosSuperadmin();
  const svc = createServiceRoleClient();
  await Promise.all(
    subs.map(async (s) => {
      const r = await enviarPushDispositivo(s, {
        title: `Cuenta de cobro N.º ${numeroCuenta(c.numero)} aceptada`,
        body: `${c.recibe_nombre ?? c.cliente_nombre} aceptó y llenó sus datos · ${formatCOP(c.valor)}`,
        url: `/superadmin/cuentas-cobro/${c.id}`,
        tag: `cuenta-cobro-${c.id}`,
      });
      if (r === "muerta") await svc.from("suscripciones_avisos_torneo").delete().eq("endpoint", s.endpoint);
    }),
  );
}

async function avisarCorreo(c: CuentaCobro): Promise<void> {
  const { data } = await createServiceRoleClient()
    .from("cuentas_cobro_config")
    .select("aviso_correo")
    .eq("id", true)
    .maybeSingle();
  const to = (data as { aviso_correo: string | null } | null)?.aviso_correo?.trim();
  if (!to) return;

  const enlace = `${SITE_URL}/superadmin/cuentas-cobro/${c.id}`;
  const filas: [string, string | null][] = [
    ["Cuenta", `N.º ${numeroCuenta(c.numero)} · ${formatCOP(c.valor)}`],
    ["Cliente", c.cliente_nombre],
    ["Recibe", c.recibe_nombre],
    ["NIT o cédula", c.cliente_documento],
    ["Contacto", c.contacto_nombre],
    ["WhatsApp", c.contacto_whatsapp],
  ];
  const cuerpo = filas
    .filter(([, v]) => v)
    .map(([k, v]) => `<b>${k}:</b> ${esc(v)}`)
    .join("<br>");
  const r = await enviarEmail({
    to,
    subject: `Cuenta de cobro N.º ${numeroCuenta(c.numero)} aceptada por ${c.recibe_nombre ?? c.cliente_nombre}`,
    html: plantillaEmail({
      titulo: "El cliente aceptó la cuenta de cobro",
      cuerpo,
      cta: { texto: "Ver la cuenta de cobro", url: enlace },
    }),
    text: `${filas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${enlace}`,
  });
  if (!r.ok) console.error("[cuenta-cobro] correo de aviso:", r.error);
}

/**
 * Avisa al superadmin (celular y correo) que el cliente completó sus datos. Es
 * un extra: si algo falla, el cliente igual ya guardó y no se entera.
 */
export async function avisarDatosCompletos(c: CuentaCobro): Promise<void> {
  const limite = new Promise<void>((resolve) => setTimeout(resolve, 8000));
  const trabajo = Promise.allSettled([avisarCelular(c), avisarCorreo(c)]).then((rs) => {
    for (const r of rs) if (r.status === "rejected") console.error("[cuenta-cobro] aviso:", r.reason);
  });
  await Promise.race([trabajo, limite]);
}
