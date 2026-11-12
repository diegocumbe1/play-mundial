import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccionesCuentaCobro } from "@/components/cobro/acciones-cuenta-cobro";
import { CuentaCobroDocumento } from "@/components/cobro/cuenta-cobro-documento";
import { getCuentaPorClave } from "@/lib/cuentas-cobro-db";
import { numeroCuenta } from "@/lib/cuenta-cobro";

export const dynamic = "force-dynamic";

/** Documento privado con datos del cliente: nunca en buscadores. */
export const metadata: Metadata = {
  title: "Cuenta de cobro",
  robots: { index: false, follow: false, nocache: true },
};

/** Cuenta de cobro que ve el cliente con su enlace secreto. */
export default async function CuentaCobroPublicaPage({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  const cuenta = await getCuentaPorClave(clave);
  if (!cuenta) notFound();

  const datosFaltan = !cuenta.recibe_nombre || !cuenta.cliente_documento || !cuenta.contacto_nombre;

  return (
    <main className="min-h-screen bg-[#e9edf3]">
      <h1 className="sr-only">Cuenta de cobro N.º {numeroCuenta(cuenta.numero)}</h1>
      <AccionesCuentaCobro
        clave={clave}
        estado={cuenta.estado}
        datosFaltan={datosFaltan}
        valor={cuenta.valor}
        inicial={{
          recibe_nombre: cuenta.recibe_nombre ?? "",
          cliente_documento: cuenta.cliente_documento ?? "",
          contacto_nombre: cuenta.contacto_nombre ?? "",
          contacto_whatsapp: cuenta.contacto_whatsapp ?? "",
        }}
      />
      <CuentaCobroDocumento cuenta={cuenta} />
    </main>
  );
}
