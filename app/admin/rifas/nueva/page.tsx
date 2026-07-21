import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { esSuperadmin, getMembership } from "@/lib/auth";
import { getTenants } from "@/actions/tenants";
import { RifaForm } from "@/components/rifa/rifa-form";

export const dynamic = "force-dynamic";

export default async function NuevaRifaPage() {
  const membership = await getMembership();
  if (!membership) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Sin acceso de organizador.</p>
      </div>
    );
  }

  const superadmin = await esSuperadmin();
  const tenantsRes = superadmin ? await getTenants() : null;
  const tenants = tenantsRes?.success
    ? tenantsRes.data.map((t) => ({ id: t.id, nombre: t.nombre }))
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/admin/rifas"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Mis rifas
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Nueva rifa</h1>
      <RifaForm esSuperadmin={superadmin} tenants={tenants} />
    </div>
  );
}
