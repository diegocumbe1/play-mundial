import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Aterrizaje del enlace de verificación de correo.
 *
 * Se usa el flujo de `token_hash` (no el de fragmento `#access_token`): el
 * fragmento nunca llega al servidor, y aquí la sesión vive en cookies. El token
 * lo emitió Supabase con `generateLink`; el correo lo mandó Resend.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  // Solo rutas internas: un `next` absoluto sería un open redirect.
  const nextParam = searchParams.get("next") ?? "/admin/rifas";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/admin/rifas";

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/admin/rifas?verificacion=invalida`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/admin/rifas?verificacion=expirada`);
  }

  const destino = new URL(next, origin);
  destino.searchParams.set("verificacion", "ok");
  return NextResponse.redirect(destino);
}
