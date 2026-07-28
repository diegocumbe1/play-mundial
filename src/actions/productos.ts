"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { getProductosHabilitados, getProductosTenant } from "@/lib/productos";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult, ProductoPlataforma, TenantProducto } from "@/types";

/**
 * Server Actions de los productos (verticales) habilitados por organizador.
 * Consultar es cosa del miembro; habilitar/deshabilitar, del superadmin.
 */

/** Productos habilitados del tenant del usuario actual. */
export async function getMisProductos(): Promise<
  ActionResult<ProductoPlataforma[]>
> {
  const membership = await getMembership();
  if (!membership) return { success: false, error: "Sin sesión" };
  return { success: true, data: await getProductosHabilitados(membership.tenant_id) };
}

/** Filas de productos de un tenant cualquiera. Solo superadmin. */
export async function getProductosDeTenant(
  tenantId: string,
): Promise<ActionResult<TenantProducto[]>> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "No autorizado" };
  }
  return { success: true, data: await getProductosTenant(tenantId) };
}

/** Todas las filas de productos, para pintar la tabla del superadmin. */
export async function getProductosDeTodos(): Promise<ActionResult<TenantProducto[]>> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "No autorizado" };
  }
  const svc = createServiceRoleClient();
  const { data, error } = await svc.from("tenant_productos").select("*");
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as TenantProducto[]) ?? [] };
}

const toggleSchema = z.object({
  tenantId: z.string().uuid(),
  producto: z.enum(["rifas", "torneos"]),
  habilitado: z.boolean(),
});

/** Habilita o deshabilita una vertical para un organizador. Solo superadmin. */
export async function setProductoTenant(
  input: z.infer<typeof toggleSchema>,
): Promise<ActionResult> {
  if (!(await esSuperadmin())) {
    return { success: false, error: "Solo el superadmin administra los productos" };
  }
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { tenantId, producto, habilitado } = parsed.data;

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("tenant_productos")
    .upsert(
      { tenant_id: tenantId, producto, habilitado },
      { onConflict: "tenant_id,producto" },
    );
  if (error) return { success: false, error: error.message };

  revalidatePath("/superadmin");
  revalidatePath("/admin");
  return { success: true, data: undefined };
}
