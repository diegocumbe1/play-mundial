import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request y propaga las cookies
 * actualizadas. Se invoca desde `proxy.ts` (antes "middleware" en Next < 16).
 *
 * Importante: hay que devolver SIEMPRE el `supabaseResponse` para que las
 * cookies de sesión se mantengan sincronizadas.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca el token si hace falta. No metas lógica entre createServerClient
  // y getUser para evitar cierres de sesión difíciles de depurar.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Un fallo de red o un 5xx de Supabase no significa "sin sesión": si se
  // redirige al login en ese caso, el organizador sale aunque su sesión siga
  // viva. Solo un error de auth real (token inválido/ausente) cuenta.
  const authCaido = isAuthRetryableFetchError(error);

  // Toda respuesta que no sea `supabaseResponse` tiene que llevarse las cookies
  // que el refresh acaba de escribir. Si no, Supabase ya rotó el refresh token
  // pero el navegador se queda con el viejo, y al reusarlo Supabase revoca la
  // sesión completa (detección de reuso) -> "me sacó al login".
  const redirigir = (url: URL) => {
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  const { pathname } = request.nextUrl;

  // El Mundial (polla) ya terminó. Con POLLA_ACTIVA != "true" se ocultan sus
  // rutas de juego y se redirige a la portada (la vertical de rifas). No borra datos.
  const pollaActiva = process.env.POLLA_ACTIVA === "true";
  // Todo lo que quedó del Mundial. `/terminos` NO va aquí: son los términos
  // vigentes de la plataforma de rifas y tienen que seguir accesibles.
  const rutasPolla = [
    "/jugar",
    "/resultados",
    "/comunidad",
    "/partidos",
    "/equipos",
  ];
  if (!pollaActiva && rutasPolla.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirigir(url);
  }

  // Protege /admin y /superadmin: sin sesión -> redirige al login. El rol de
  // superadmin se valida en la propia página (el proxy es solo la 1ra barrera).
  const esRutaProtegida =
    (pathname.startsWith("/admin") && pathname !== "/admin/login") ||
    pathname.startsWith("/superadmin");

  if (esRutaProtegida && !user && !authCaido) {
    const url = request.nextUrl.clone();
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/admin/login";
    url.searchParams.set("next", next);
    return redirigir(url);
  }

  return supabaseResponse;
}
