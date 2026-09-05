import "server-only";

import { IDS_PRODUCTOS } from "@/lib/productos-ui";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ProductoPlataforma, TenantProducto } from "@/types";

/**
 * Productos (verticales) habilitados por organizador.
 *
 * La plataforma es multi-producto: un tenant puede tener rifas, torneos o
 * ambos. El superadmin decide; el owner solo consulta. Estos helpers son la
 * fuente de verdad tanto para pintar el panel como para **bloquear rutas y
 * Server Actions** (ocultar una tarjeta no es seguridad: las Server Functions
 * se pueden invocar por POST directo).
 */

/**
 * Productos que se dan por habilitados cuando el tenant NO tiene fila en
 * `tenant_productos`. Rifas nació antes que esta tabla: ningún organizador
 * puede perder el acceso a lo que ya estaba vendiendo. Las verticales nuevas
 * (torneos) sí exigen una fila explícita.
 */
const PRODUCTOS_POR_DEFECTO: ProductoPlataforma[] = ["rifas"];

/** Filas de productos de un tenant (habilitados y deshabilitados). */
export async function getProductosTenant(
  tenantId: string,
): Promise<TenantProducto[]> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("tenant_productos")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("producto");
  return (data as TenantProducto[]) ?? [];
}

/** Ids de los productos activos del tenant, aplicando el default de compatibilidad. */
export async function getProductosHabilitados(
  tenantId: string,
): Promise<ProductoPlataforma[]> {
  const filas = await getProductosTenant(tenantId);
  return IDS_PRODUCTOS.filter((id) => {
    const fila = filas.find((f) => f.producto === id);
    return fila ? fila.habilitado : PRODUCTOS_POR_DEFECTO.includes(id);
  });
}

/** ¿El tenant tiene habilitada esta vertical? */
export async function tieneProductoHabilitado(
  tenantId: string,
  producto: ProductoPlataforma,
): Promise<boolean> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("tenant_productos")
    .select("habilitado")
    .eq("tenant_id", tenantId)
    .eq("producto", producto)
    .maybeSingle();

  const fila = data as { habilitado: boolean } | null;
  if (!fila) return PRODUCTOS_POR_DEFECTO.includes(producto);
  return fila.habilitado;
}

/**
 * Habilita los productos iniciales de un organizador recién creado. Se llama
 * al registrarse solo o cuando el superadmin le crea la cuenta.
 *
 * Por defecto solo RIFAS: torneos es un módulo por invitación que el superadmin
 * activa desde /superadmin cuando el organizador lo necesita.
 */
export async function habilitarProductosIniciales(
  tenantId: string,
  productos: ProductoPlataforma[] = ["rifas"],
): Promise<void> {
  const svc = createServiceRoleClient();
  await svc.from("tenant_productos").upsert(
    productos.map((producto) => ({ tenant_id: tenantId, producto, habilitado: true })),
    { onConflict: "tenant_id,producto" },
  );
}
