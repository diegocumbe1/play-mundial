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

  // Protege /admin: sin sesión -> redirige al login.
  const { pathname } = request.nextUrl;
  const esRutaAdmin =
    pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (esRutaAdmin && !user) {
    const url = request.nextUrl.clone();
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/admin/login";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
