import { redirect } from "next/navigation";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { tieneProductoHabilitado } from "@/lib/productos";

/**
 * Rifas es una vertical por organizador: quien no la tenga habilitada (por
 * ejemplo, alguien que solo usa torneos) vuelve al panel en vez de ver «Mis
 * rifas». El bloqueo de las acciones vive en las Server Actions; esto evita
 * mostrar pantallas que no le corresponden.
 */
export default async function RifasLayout({ children }: { children: React.ReactNode }) {
  const membership = await getMembership();
  // Sin membresía, cada página ya muestra su propio aviso.
  if (membership && !(await esSuperadmin())) {
    if (!(await tieneProductoHabilitado(membership.tenant_id, "rifas"))) redirect("/admin");
  }
  return children;
}
