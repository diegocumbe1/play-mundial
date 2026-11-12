import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getConfigCobro, getTorneosParaCobro } from "@/actions/cuentas-cobro";
import { CuentaCobroForm } from "@/components/superadmin/cuenta-cobro-form";
import { esSuperadmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NuevaCuentaCobroPage() {
  if (!(await esSuperadmin())) redirect("/admin");
  const [torneosRes, configRes] = await Promise.all([getTorneosParaCobro(), getConfigCobro()]);
  if (!configRes.success) redirect("/superadmin/cuentas-cobro");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/superadmin/cuentas-cobro" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Cuentas de cobro
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Nueva cuenta de cobro</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Al crearla recibes un enlace para el cliente. Si no has configurado quién cobra, hazlo primero en la lista.
      </p>
      <CuentaCobroForm torneos={torneosRes.success ? torneosRes.data : []} config={configRes.data} />
    </div>
  );
}
