import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { getRifa } from "@/actions/rifas";
import { esSuperadmin, getMembership } from "@/lib/auth";
import { getMiPagoConfig, getTenants } from "@/actions/tenants";
import { calcularDashboard, formatCOP } from "@/lib/rifa";
import { formatFechaCO } from "@/lib/fecha-co";
import { buttonVariants } from "@/components/ui/button";
import { EstadoRifaBadge } from "@/components/rifa/estado-rifa-badge";
import { GrillaAdmin } from "@/components/rifa/grilla-admin";
import { PanelFinanciero } from "@/components/rifa/panel-financiero";
import { SorteoPanel } from "@/components/rifa/sorteo-panel";
import { ActivarRifaButton } from "@/components/rifa/activar-rifa-button";
import { ShareRifa } from "@/components/rifa/share-rifa";
import { PagoConfigForm } from "@/components/rifa/pago-config-form";
import { EstadoRifaControl } from "@/components/rifa/estado-rifa-control";
import { ReasignarRifa } from "@/components/rifa/reasignar-rifa";

export const dynamic = "force-dynamic";

export default async function RifaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getMembership();
  if (!membership) {
    return <div className="mx-auto max-w-md p-8 text-center text-muted-foreground">Sin acceso.</div>;
  }

  const res = await getRifa(id);
  if (!res.success) notFound();
  const { rifa, premios, boletas, ganadores } = res.data;
  const dash = calcularDashboard(rifa, boletas);

  const pagoRes = await getMiPagoConfig();
  const pago = pagoRes.success ? pagoRes.data : null;
  const pagoIncompleto = !pago?.nequi_llave && !pago?.qr_url;

  // Solo el superadmin puede transferir la rifa a otro organizador.
  const superadmin = await esSuperadmin();
  const tenantsRes = superadmin ? await getTenants() : null;
  const tenants = tenantsRes?.success
    ? tenantsRes.data.map((t) => ({ id: t.id, nombre: t.nombre }))
    : [];
  const tenantActual = tenants.find((t) => t.id === rifa.tenant_id);

  const puedeSortear = rifa.estado === "activa" || rifa.estado === "cerrada";
  const puedeEditar = !["sorteada", "pagada", "cancelada"].includes(rifa.estado);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin/rifas" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> Mis rifas
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{rifa.nombre}</h1>
            <EstadoRifaBadge estado={rifa.estado} />
          </div>
          <p className="text-muted-foreground text-sm">
            {rifa.cantidad_numeros} números · {formatCOP(rifa.precio_boleta)} c/u
            {rifa.tipo === "loteria" && rifa.loteria ? ` · ${rifa.loteria}` : " · sorteo propio"}
          </p>
          {(() => {
            const f = formatFechaCO(
              rifa.tipo === "loteria" ? (rifa.fecha_loteria ?? rifa.fecha_sorteo) : rifa.fecha_sorteo,
            );
            return f ? <p className="text-muted-foreground text-sm">Juega el {f}</p> : null;
          })()}
        </div>
        <div className="flex items-center gap-2">
          {puedeEditar && (
            <Link href={`/admin/rifas/${rifa.id}/editar`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="size-3.5" /> Editar
            </Link>
          )}
          {rifa.estado === "borrador" && <ActivarRifaButton rifaId={rifa.id} />}
          <EstadoRifaControl rifaId={rifa.id} estado={rifa.estado} />
        </div>
      </header>

      {rifa.estado === "borrador" ? (
        <div className="border-border bg-muted/30 rounded-2xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Esta rifa está en <b>borrador</b>. Actívala para obtener su enlace público y empezar a vender.
          </p>
          {pagoIncompleto && (
            <p className="text-amber-600 dark:text-amber-400 mt-2 text-xs">
              Configura tus datos de cobro (Nequi/QR) más abajo antes de vender.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Enlace público */}
          <section className="border-border mb-6 rounded-2xl border p-4">
            <p className="mb-2 text-sm font-semibold">Enlace público</p>
            <ShareRifa slug={rifa.slug_publico} nombre={rifa.nombre} />
          </section>

          {/* Dashboard financiero + participantes (indicadores accionables) */}
          <PanelFinanciero rifa={rifa} boletas={boletas} dash={dash} />
        </>
      )}

      {/* Grilla */}
      <section className="border-border mb-6 rounded-2xl border p-4">
        <p className="mb-3 text-sm font-semibold">Números</p>
        <GrillaAdmin rifaId={rifa.id} cantidad={rifa.cantidad_numeros} boletas={boletas} />
      </section>


      {/* Sorteo */}
      {(puedeSortear || rifa.estado === "sorteada" || ganadores.length > 0) && (
        <section className="border-border mb-6 rounded-2xl border p-4">
          <p className="mb-3 text-sm font-semibold">Sorteo</p>
          <SorteoPanel rifa={rifa} premios={premios} boletas={boletas} ganadores={ganadores} />
        </section>
      )}

      {/* Responsable de la rifa (solo superadmin) */}
      {superadmin && tenants.length > 0 && (
        <section className="border-border mb-6 rounded-2xl border p-4">
          <p className="mb-3 text-sm font-semibold">Responsable de la rifa</p>
          <ReasignarRifa
            rifaId={rifa.id}
            tenantActualId={rifa.tenant_id}
            tenantActualNombre={tenantActual?.nombre ?? "—"}
            tenants={tenants}
          />
        </section>
      )}

      {/* Config de pago del tenant */}
      <section className="border-border rounded-2xl border p-4">
        <p className="mb-1 text-sm font-semibold">Tus datos de cobro</p>
        <p className="text-muted-foreground mb-3 text-xs">
          Se muestran a los compradores en la página pública y el flyer.
        </p>
        <PagoConfigForm inicial={pago} />
      </section>
    </div>
  );
}
