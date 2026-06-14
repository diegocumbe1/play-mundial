import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * En Next.js 16 `cookies()` es asíncrono, por eso esta función es `async`.
 * Respeta la sesión del usuario (RLS) leyendo/escribiendo cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: ignorar.
            // El middleware se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}

/**
 * Cliente con SERVICE ROLE: ignora RLS y tiene permisos de administrador.
 *
 * ⚠️ Usar SOLO en el servidor (Server Actions / Route Handlers) y nunca
 * exponer la service role key al cliente.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
