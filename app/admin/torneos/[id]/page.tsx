import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { getTorneo } from "@/actions/torneos";
import { getMiPagoConfig } from "@/actions/tenants";
import { getMembership } from "@/lib/auth";
import { formatFechaCO } from "@/lib/fecha-co";
import {
  formatCOP,
  labelFormatoTorneo,
  labelPuesto,
  valorPremiacion,
} from "@/lib/torneos";
import { buttonVariants } from "@/components/ui/button";
import { PagoConfigForm } from "@/components/rifa/pago-config-form";
import { ActivarTorneoButton } from "@/components/torneo/activar-torneo-button";
import { EstadoTorneoBadge } from "@/components/torneo/estado-torneo-badge";
import { EstadoTorneoControl } from "@/components/torneo/estado-torneo-control";
import { ShareTorneo } from "@/components/torneo/share-torneo";
import { TorneoTabs } from "@/components/torneo/torneo-tabs";

export const dynamic = "force-dynamic";

export default async function TorneoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await getMembership();
  if (!membership) {
    return (
      <div className="text-muted-foreground mx-auto max-w-md p-8 text-center">
        Sin acceso.
      </div>
    );
  }

  const res = await getTorneo(id);
  if (!res.success) notFound();
  const { torneo, equipos, gastos, premios, dashboard, alertas } = res.data;

  const pagoRes = await getMiPagoConfig();
  const pago = pagoRes.success ? pagoRes.data : null;
  const pagoIncompleto =
    !(pago?.cuenta_numero ?? pago?.nequi_llave) && !pago?.llave && !pago?.qr_url;

  const fechaInicio = formatFechaCO(torneo.fecha_inicio, { conAnio: false });
  const primerPremio = premios.find((p) => p.puesto === 1);
  const resumenParaCompartir = [
    `${torneo.deporte}${torneo.modalidad ? ` ${torneo.modalidad}` : ""}`,
    primerPremio ? `Campeón: ${primerPremio.descripcion}` : null,
    fechaInicio ? `Arranca el ${fechaInicio}` : null,
    torneo.valor_inscripcion > 0
      ? `Inscripción ${formatCOP(torneo.valor_inscripcion)} por equipo`
      : "Inscripción gratuita",
    `Quedan ${dashboard.cuposDisponibles} de ${torneo.cupo_equipos} cupos`,
  ]
    .filter(Boolean)
    .join(" · ");

  const puedeEditar = torneo.estado !== "finalizado" && torneo.estado !== "cancelado";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/admin/torneos"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Mis torneos
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{torneo.nombre}</h1>
            <EstadoTorneoBadge estado={torneo.estado} />
          </div>
          <p className="text-muted-foreground text-sm">
            {torneo.deporte}
            {torneo.modalidad ? ` · ${torneo.modalidad}` : ""}
            {torneo.rama ? ` · ${torneo.rama}` : ""} · {labelFormatoTorneo(torneo.formato)}
          </p>
          <p className="text-muted-foreground text-sm">
            {torneo.cupo_equipos} equipos ·{" "}
            {torneo.valor_inscripcion > 0
              ? `${formatCOP(torneo.valor_inscripcion)} por inscripción`
              : "inscripción gratuita"}
            {torneo.escenario ? ` · ${torneo.escenario}` : ""}
            {fechaInicio ? ` · desde el ${fechaInicio}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {puedeEditar && (
            <Link
              href={`/admin/torneos/${torneo.id}/editar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-3.5" /> Editar
            </Link>
          )}
          {torneo.estado === "borrador" && <ActivarTorneoButton torneoId={torneo.id} />}
          <EstadoTorneoControl torneoId={torneo.id} estado={torneo.estado} />
        </div>
      </header>

      {torneo.estado === "borrador" ? (
        <div className="border-border bg-muted/30 mb-6 rounded-2xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Este torneo está en <b>borrador</b>. Publícalo para obtener su enlace y empezar
            a recibir inscripciones.
          </p>
          {pagoIncompleto && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Configura tus datos de cobro (cuenta, Bre-B o QR) antes de cobrar
              inscripciones.
            </p>
          )}
        </div>
      ) : (
        <section className="border-border mb-6 rounded-2xl border p-4">
          <p className="mb-2 text-sm font-semibold">Enlace público</p>
          <ShareTorneo
            slug={torneo.slug_publico}
            nombre={torneo.nombre}
            detalle={resumenParaCompartir}
          />
        </section>
      )}

      <TorneoTabs
        torneo={torneo}
        equipos={equipos}
        gastos={gastos}
        dashboard={dashboard}
        alertas={alertas}
        configuracion={
          <div className="flex flex-col gap-6">
            <section className="border-border rounded-2xl border p-4">
              <p className="mb-1 text-sm font-semibold">Datos del torneo</p>
              <p className="text-muted-foreground mb-3 text-xs">
                Sede, fechas, cupos, reglamento y premiación.
              </p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <Dato label="Ciudad" valor={torneo.ciudad} />
                <Dato label="Escenario" valor={torneo.escenario} />
                <Dato label="Dirección" valor={torneo.direccion} />
                <Dato
                  label="Fechas"
                  valor={[
                    formatFechaCO(torneo.fecha_inicio, { conAnio: false }),
                    formatFechaCO(torneo.fecha_fin, { conAnio: false }),
                  ]
                    .filter(Boolean)
                    .join(" – ")}
                />
                <Dato
                  label="Cierre de inscripciones"
                  valor={formatFechaCO(torneo.cierre_inscripciones)}
                />
                <Dato
                  label="Mínimo de equipos"
                  valor={torneo.minimo_equipos ? String(torneo.minimo_equipos) : null}
                />
                <Dato
                  label="Jugadores por equipo"
                  valor={
                    torneo.jugadores_por_equipo ? String(torneo.jugadores_por_equipo) : null
                  }
                />
                <Dato
                  label="Duración del partido"
                  valor={
                    torneo.duracion_partido_minutos
                      ? `${torneo.duracion_partido_minutos} min`
                      : null
                  }
                />
                <Dato label="Canchas" valor={String(torneo.cantidad_canchas)} />
                <Dato label="Nota de premiación" valor={torneo.premiacion_descripcion} />
              </dl>

              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold">Premiación</p>
                {premios.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Sin premios definidos. Es lo primero que pregunta un equipo.
                  </p>
                ) : (
                  <>
                    <ul className="flex flex-col gap-1.5">
                      {premios.map((p) => (
                        <li
                          key={p.id}
                          className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                        >
                          <span>
                            <b>{labelPuesto(p.puesto)}</b>
                            <span className="text-muted-foreground"> · {p.descripcion}</span>
                          </span>
                          {p.tipo === "valor" && p.valor != null && (
                            <span className="shrink-0 font-semibold">
                              {formatCOP(p.valor)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {valorPremiacion(premios) > 0 && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Total en dinero:{" "}
                        <b className="text-foreground">
                          {formatCOP(valorPremiacion(premios))}
                        </b>
                      </p>
                    )}
                  </>
                )}
              </div>
              {puedeEditar && (
                <Link
                  href={`/admin/torneos/${torneo.id}/editar`}
                  className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4`}
                >
                  <Pencil className="size-3.5" /> Editar configuración
                </Link>
              )}
            </section>

            <section className="border-border rounded-2xl border p-4">
              <p className="mb-1 text-sm font-semibold">Tus datos de cobro</p>
              <p className="text-muted-foreground mb-3 text-xs">
                Se muestran en la página pública del torneo para que los equipos paguen su
                inscripción. Son los mismos de tus rifas.
              </p>
              <PagoConfigForm inicial={pago} />
            </section>
          </div>
        }
      />
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{valor?.trim() ? valor : "—"}</dd>
    </div>
  );
}
