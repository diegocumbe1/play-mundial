import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { esSuperadmin } from "@/lib/auth";
import { getPlataformaConfig } from "@/lib/tenant-config";
import { PlataformaConfigForm } from "@/components/superadmin/plataforma-config-form";

export const dynamic = "force-dynamic";

export default async function SuperadminSettingsPage() {
  if (!(await esSuperadmin())) redirect("/admin/rifas");

  const config = await getPlataformaConfig();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/superadmin" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Panel
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Precios y capa gratuita</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Edita cuánto cuesta cada rifa y las reglas del plan gratis. Se aplican a toda la plataforma.
      </p>
      <PlataformaConfigForm inicial={config} />
    </div>
  );
}
