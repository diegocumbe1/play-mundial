import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Devuelve el usuario autenticado (admin) o `null`.
 *
 * Úsalo tanto en Server Components (para mostrar/ocultar UI) como en
 * Server Actions (para validar permisos antes de mutar). El proxy protege las
 * rutas /admin, pero las Server Actions deben validar por su cuenta.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
