import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Membership, Tenant } from "@/types";

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

/**
 * Membresía del usuario actual (rol + tenant). Asume un tenant por usuario;
 * si tuviera varios, toma el primero. `null` si no hay sesión o membresía.
 */
export async function getMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as Membership | null) ?? null;
}

/** ¿El usuario actual es superadmin de la plataforma? */
export async function esSuperadmin(): Promise<boolean> {
  const membership = await getMembership();
  return membership?.rol === "superadmin";
}

/** Tenant activo del usuario (el de su membresía). `null` si no tiene. */
export async function getTenantActual(): Promise<Tenant | null> {
  const membership = await getMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", membership.tenant_id)
    .maybeSingle();

  return (data as Tenant | null) ?? null;
}
