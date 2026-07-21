import { createServerClient } from "@supabase/ssr";
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
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // El Mundial (polla) ya terminó. Con POLLA_ACTIVA != "true" se ocultan sus
  // rutas de juego y se redirige a la portada (la vertical de rifas). No borra datos.
  const pollaActiva = process.env.POLLA_ACTIVA === "true";
  const rutasPolla = ["/jugar", "/resultados", "/comunidad"];
  if (!pollaActiva && rutasPolla.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Protege /admin y /superadmin: sin sesión -> redirige al login. El rol de
  // superadmin se valida en la propia página (el proxy es solo la 1ra barrera).
  const esRutaProtegida =
    (pathname.startsWith("/admin") && pathname !== "/admin/login") ||
    pathname.startsWith("/superadmin");

  if (esRutaProtegida && !user) {
    const url = request.nextUrl.clone();
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/admin/login";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
