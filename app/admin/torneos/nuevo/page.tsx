import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getTenants } from "@/actions/tenants";
import { esSuperadmin, getMembership } from "@/lib/auth";
import { tieneProductoHabilitado } from "@/lib/productos";
import { TorneoForm } from "@/components/torneo/torneo-form";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NuevoTorneoPage() {
  const membership = await getMembership();
  if (!membership) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Sin acceso de organizador.</p>
      </div>
    );
  }

  const superadmin = await esSuperadmin();
  // La ruta también valida el producto: no basta con ocultar la tarjeta.
  if (!superadmin && !(await tieneProductoHabilitado(membership.tenant_id, "torneos"))) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Tu cuenta no tiene habilitado el módulo de torneos deportivos.
        </p>
        <Link
          href="/admin"
          className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4`}
        >
          Volver al panel
        </Link>
      </div>
    );
  }

  const tenantsRes = superadmin ? await getTenants() : null;
  const tenants = tenantsRes?.success
    ? tenantsRes.data.map((t) => ({ id: t.id, nombre: t.nombre }))
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/admin/torneos"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Mis torneos
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Nuevo torneo</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Se crea en borrador. Podrás publicarlo cuando esté listo.
      </p>
      <TorneoForm esSuperadmin={superadmin} tenants={tenants} />
    </div>
  );
}
