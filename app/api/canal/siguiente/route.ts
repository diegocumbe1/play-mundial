import { timingSafeEqual } from "node:crypto";

import { cargarPartidoEnCanal, getCanalPorSala } from "@/lib/canal-marcador";

/**
 * El marcador (dc-sport-score) la llama cuando el juez toca «Siguiente partido →».
 * Se autentica con el mismo PIN de administración que ya comparten los dos
 * servidores (DC_SPORT_SCORE_ADMIN_PIN); sin él responde 401. El código de sala viaja
 * en el cuerpo: solo existe para canales de cancha.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function pinValido(recibido: string | null): boolean {
  const esperado = process.env.DC_SPORT_SCORE_ADMIN_PIN;
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!pinValido(request.headers.get("x-admin-pin"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const { sala } = (await request.json().catch(() => ({}))) as { sala?: string };
  const canal = sala ? await getCanalPorSala(sala) : null;
  if (!canal) return Response.json({ ok: false, error: "Esta sala no es de una cancha del torneo." }, { status: 404 });

  const r = await cargarPartidoEnCanal(canal, { por: "juez" });
  return r.ok
    ? Response.json({ ok: true, partido: r.partido })
    : Response.json({ ok: false, error: r.error }, { status: 409 });
}
