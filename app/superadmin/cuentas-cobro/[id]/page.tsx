import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getConfigCobro, getCuentaCobro, getTorneosParaCobro } from "@/actions/cuentas-cobro";
import { CuentaCobroDocumento } from "@/components/cobro/cuenta-cobro-documento";
import { CuentaCobroAcciones } from "@/components/superadmin/cuenta-cobro-acciones";
import { CuentaCobroForm } from "@/components/superadmin/cuenta-cobro-form";
import { esSuperadmin } from "@/lib/auth";
import { ETIQUETA_ESTADO, fechaHoraLarga, numeroCuenta } from "@/lib/cuenta-cobro";
import { formatCOP } from "@/lib/torneos";
import { urlCuentaCobro } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function CuentaCobroDetallePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await esSuperadmin())) redirect("/admin");
  const { id } = await params;
  const [cuentaRes, torneosRes, configRes] = await Promise.all([
    getCuentaCobro(id),
    getTorneosParaCobro(),
    getConfigCobro(),
  ]);
  if (!cuentaRes.success) notFound();
  if (!configRes.success) redirect("/superadmin/cuentas-cobro");
  const cuenta = cuentaRes.data;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/superadmin/cuentas-cobro" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Cuentas de cobro
      </Link>
      <h1 className="mb-1 text-2xl font-bold">
        Cuenta de cobro N.º {numeroCuenta(cuenta.numero)} · {cuenta.cliente_nombre}
      </h1>
      <p className="text-muted-foreground mb-1 text-sm">{ETIQUETA_ESTADO[cuenta.estado]}</p>
      {cuenta.aceptada_at ? (
        <p className="mb-5 text-sm text-emerald-600 dark:text-emerald-400">
          Aceptada por {cuenta.recibe_nombre ?? "el cliente"} el {fechaHoraLarga(cuenta.aceptada_at)} por{" "}
          {formatCOP(cuenta.aceptada_valor ?? cuenta.valor)}.
          {cuenta.aceptada_valor !== null && cuenta.aceptada_valor !== cuenta.valor && (
            <b className="ml-1 text-amber-600 dark:text-amber-400">
              Ojo: el valor actual ({formatCOP(cuenta.valor)}) cambió después de la aceptación.
            </b>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground mb-5 text-sm">Sin aceptación del cliente todavía.</p>
      )}

      <section className="border-border mb-6 rounded-xl border p-4">
        <CuentaCobroAcciones
          id={cuenta.id}
          clave={cuenta.clave}
          numero={cuenta.numero}
          cliente={cuenta.cliente_nombre}
          estado={cuenta.estado}
          enlace={urlCuentaCobro(cuenta.clave)}
        />
      </section>

      <CuentaCobroForm torneos={torneosRes.success ? torneosRes.data : []} config={configRes.data} inicial={cuenta} />

      <h2 className="mt-10 mb-2 text-sm font-semibold">Vista previa</h2>
      <div className="-mx-4 overflow-x-auto bg-[#e9edf3] sm:mx-0 sm:rounded-xl">
        <CuentaCobroDocumento cuenta={cuenta} />
      </div>
    </div>
  );
}
