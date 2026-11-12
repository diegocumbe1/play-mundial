import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { PatrocinadorPublico, Torneo } from "@/types";

/**
 * Qué patrocinadores corresponden hoy en la página pública y en la pantalla del marcador.
 * Vive aquí (y no en las acciones) porque lo usan varias partes: la página pública, la
 * creación de salas y el cambio de partido en la cancha.
 */

/**
 * Patrocinadores que ve el público: solo publicados, con imagen, y solo si el
 * organizador tiene la función habilitada. Lista vacía = no se muestra nada.
 */
export async function patrocinadoresPublicos(torneo: Pick<Torneo, "id" | "tenant_id">): Promise<PatrocinadorPublico[]> {
  const svc = createServiceRoleClient();
  const [{ data: tenant }, { data: fila }] = await Promise.all([
    svc.from("tenants").select("patrocinios_habilitado").eq("id", torneo.tenant_id).maybeSingle(),
    svc.from("torneos").select("mostrar_patrocinadores").eq("id", torneo.id).maybeSingle(),
  ]);
  // Dos interruptores: el superadmin habilita la función para el organizador, y el
  // organizador puede ocultarlos todos en su torneo (sin borrarlos).
  if (!(tenant as { patrocinios_habilitado?: boolean } | null)?.patrocinios_habilitado) return [];
  if ((fila as { mostrar_patrocinadores?: boolean } | null)?.mostrar_patrocinadores === false) return [];
  const { data } = await svc
    .from("patrocinadores_torneo")
    .select("id, nombre, rol, logo_url, enlace")
    .eq("torneo_id", torneo.id)
    .eq("estado", "publicado")
    .not("logo_url", "is", null)
    .order("orden")
    .order("created_at");
  return (data as PatrocinadorPublico[]) ?? [];
}

/** Patrocinadores que hoy corresponden en la pantalla del marcador (ninguno si se ocultaron o deshabilitaron). */
export async function patrociniosParaMarcador(torneo: Pick<Torneo, "id" | "tenant_id">) {
  return (await patrocinadoresPublicos(torneo))
    .filter((x) => !!x.logo_url)
    .slice(0, 8)
    .map((x) => ({ name: x.nombre, logo: x.logo_url as string, role: x.rol }));
}

