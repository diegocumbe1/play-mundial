import { timingSafeEqual } from "node:crypto";

import { getCanalPorSala, proximosParaJuez } from "@/lib/canal-marcador";

/**
 * El marcador la llama para mostrarle al juez los próximos partidos de su cancha (máximo 3).
 * Misma autenticación que «siguiente»: el PIN de administración compartido entre los dos servidores.
 */
export const dynamic = "force-dynamic";

function pinValido(recibido: string | null): boolean {
  const esperado = process.env.DC_SPORT_SCORE_ADMIN_PIN;
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!pinValido(request.headers.get("x-admin-pin"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const sala = new URL(request.url).searchParams.get("sala") ?? "";
  const canal = await getCanalPorSala(sala);
  if (!canal) return Response.json({ ok: false, error: "Esta sala no es de una cancha del torneo." }, { status: 404 });
  return Response.json({ ok: true, partidos: await proximosParaJuez(canal) });
}
