import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { getConfigCobro, getCuentasCobro } from "@/actions/cuentas-cobro";
import { EmisorCobroForm } from "@/components/superadmin/emisor-cobro-form";
import { buttonVariants } from "@/components/ui/button";
import { esSuperadmin } from "@/lib/auth";
import { conceptoResumen, ETIQUETA_ESTADO, fechaLarga, lineasDe, numeroCuenta } from "@/lib/cuenta-cobro";
import { formatCOP } from "@/lib/torneos";

export const dynamic = "force-dynamic";

export default async function CuentasCobroPage() {
  if (!(await esSuperadmin())) redirect("/admin");
  const [cuentasRes, configRes] = await Promise.all([getCuentasCobro(), getConfigCobro()]);
  const cuentas = cuentasRes.success ? cuentasRes.data : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link href="/superadmin" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Panel
      </Link>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cuentas de cobro</h1>
          <p className="text-muted-foreground text-sm">
            Documentos con enlace único: el cliente completa sus datos y los descarga en PDF.
          </p>
        </div>
        <Link href="/superadmin/cuentas-cobro/nueva" className={buttonVariants({ size: "sm" })}>
          <Plus className="size-3.5" /> Nueva cuenta de cobro
        </Link>
      </header>

      {!cuentasRes.success && <p className="text-destructive mb-4 text-sm">{cuentasRes.error}</p>}

      <section className="border-border mb-8 overflow-hidden rounded-2xl border">
        {cuentas.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">Aún no hay cuentas de cobro.</p>
        ) : (
          <ul className="divide-border divide-y">
            {cuentas.map((c) => (
              <li key={c.id}>
                <Link href={`/superadmin/cuentas-cobro/${c.id}`} className="hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      N.º {numeroCuenta(c.numero)} · {c.cliente_nombre}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {conceptoResumen(lineasDe(c))}
                      {c.torneo_nombre ? ` · torneo «${c.torneo_nombre}»` : ""} · {fechaLarga(c.fecha)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCOP(c.valor)}</p>
                    <p className="text-muted-foreground text-xs">{ETIQUETA_ESTADO[c.estado]}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {configRes.success && (
        <section className="border-border rounded-2xl border p-4">
          <p className="mb-1 text-sm font-semibold">Datos de quien cobra</p>
          <p className="text-muted-foreground mb-4 text-xs">
            Cada cuenta nueva copia estos datos (nombre, cédula, llave Bre-B). Las ya creadas no cambian,
            pero puedes editarlas una por una.
          </p>
          <EmisorCobroForm inicial={configRes.data} />
        </section>
      )}
    </div>
  );
}
