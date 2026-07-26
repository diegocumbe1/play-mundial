import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { esSuperadmin } from "@/lib/auth";
import { getPlataformaConfig, getPlataformaPagoConfig } from "@/lib/tenant-config";
import { PlataformaConfigForm } from "@/components/superadmin/plataforma-config-form";
import { PlataformaPagoConfigForm } from "@/components/superadmin/plataforma-pago-config-form";

export const dynamic = "force-dynamic";

export default async function SuperadminSettingsPage() {
  if (!(await esSuperadmin())) redirect("/admin/rifas");

  const [config, pago] = await Promise.all([
    getPlataformaConfig(),
    getPlataformaPagoConfig(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/superadmin" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Panel
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Precios, pagos y capa gratuita</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Edita planes, reglas del plan gratis y los medios de transferencia para activar clientes.
      </p>
      <section className="mb-8">
        <PlataformaConfigForm inicial={config} />
      </section>
      <section className="border-border rounded-xl border p-4">
        <p className="mb-1 text-sm font-semibold">Medios de pago de la plataforma</p>
        <p className="text-muted-foreground mb-4 text-xs">
          Estos datos se muestran cuando un organizador debe pagar por rifa o suscripción.
        </p>
        <PlataformaPagoConfigForm inicial={pago} />
      </section>
    </div>
  );
}
