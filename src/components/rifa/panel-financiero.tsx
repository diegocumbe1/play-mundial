"use client";

import { useRef, useState } from "react";
import { ChevronDown, Users } from "lucide-react";

import { CajaRifa } from "@/components/rifa/caja-rifa";
import {
  ParticipantesLista,
  type Filtro,
} from "@/components/rifa/participantes-lista";
import { formatCOP } from "@/lib/rifa";
import { cn } from "@/lib/utils";
import type { Boleta, DashboardRifa, MovimientoRifa, Rifa } from "@/types";

/**
 * Dashboard financiero + participantes. Los indicadores de "Pagadas" y
 * "Por cobrar" son accionables: filtran el listado y bajan hasta él, para
 * responder "¿quiénes son?" sin salir de la pantalla.
 */
export function PanelFinanciero({
  rifa,
  boletas,
  dash,
  movimientos,
}: {
  rifa: Rifa;
  boletas: Boleta[];
  dash: DashboardRifa;
  movimientos: MovimientoRifa[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierto, setAbierto] = useState(true);
  const listaRef = useRef<HTMLDivElement>(null);

  function ver(f: Filtro) {
    setFiltro(f);
    setAbierto(true);
    // Espera al render del panel antes de desplazarse.
    setTimeout(
      () => listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60,
    );
  }

  return (
    <>
      {/* Tres grupos: ventas (cantidades), recaudado (pagadas) y por cobrar
          (apartadas). En mobile Ventas va a lo ancho y las otras dos debajo. */}
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-[2fr_1fr_1fr]">
        <VentasCard rifa={rifa} dash={dash} />
        <Stat
          label="Recaudado"
          value={formatCOP(dash.recaudado)}
          valueClassName="text-emerald-600 dark:text-emerald-400"
          sub={`${dash.pagadas} pagada(s) · ${dash.pctCumplimiento}% de ${formatCOP(dash.esperadoTotal)} · efectivo ${formatCOP(dash.recaudadoEfectivo)} · transf. ${formatCOP(dash.recaudadoTransferencia)}`}
          onClick={() => ver("pagadas")}
        />
        <Stat
          label="Por cobrar"
          value={formatCOP(dash.porCobrar)}
          valueClassName="text-amber-600 dark:text-amber-400"
          sub={`${dash.pendientes} apartada(s) sin pagar`}
          onClick={() => ver("deben")}
        />
      </section>

      <CajaRifa rifaId={rifa.id} dash={dash} movimientos={movimientos} />

      <section ref={listaRef} className="border-border mb-6 scroll-mt-4 rounded-2xl border p-4">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4" /> Participantes
            <span className="text-muted-foreground font-normal">({dash.vendidas})</span>
          </span>
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 transition-transform",
              abierto && "rotate-180",
            )}
          />
        </button>

        {abierto && (
          <div className="mt-3">
            <ParticipantesLista
              rifa={rifa}
              boletas={boletas}
              filtro={filtro}
              onFiltro={setFiltro}
            />
          </div>
        )}
      </section>
    </>
  );
}

/**
 * Avance de ventas: cuántas se vendieron, una barra apilada con los mismos
 * colores de la grilla (pagado / apartado / libre) y el valor vendido vs. por vender.
 */
function VentasCard({ rifa, dash }: { rifa: Rifa; dash: DashboardRifa }) {
  const pct = (n: number) => (dash.total > 0 ? (n / dash.total) * 100 : 0);
  const segmentos = [
    { n: dash.pagadas, label: "pagadas", color: "bg-emerald-500" },
    { n: dash.pendientes, label: "apartadas", color: "bg-amber-500" },
    { n: dash.libres, label: "libres", color: "bg-muted-foreground/30" },
  ];
  return (
    <div className="border-border col-span-2 rounded-xl border p-3 lg:col-span-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-muted-foreground text-xs">Ventas</p>
        <p className="text-muted-foreground text-xs tabular-nums">{dash.pctVendido}% vendido</p>
      </div>
      <p className="text-lg font-bold tabular-nums">
        {dash.vendidas}/{dash.total}
      </p>

      <div className="bg-muted mt-2 flex h-2 overflow-hidden rounded-full" aria-hidden>
        {segmentos.map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${pct(s.n)}%` }} />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px]">
        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          {segmentos.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 tabular-nums">
              <i className={cn("size-2 rounded-full", s.color)} /> {s.n} {s.label}
            </span>
          ))}
        </div>
        {/* % por vender como complemento (no redondeado aparte) para que siempre sumen 100. */}
        <p className="text-muted-foreground tabular-nums">
          Vendido <b className="text-foreground">{formatCOP(dash.vendidas * rifa.precio_boleta)}</b>
          {" · "}por vender {100 - dash.pctVendido}%{" "}
          <b className="text-foreground">{formatCOP(dash.libres * rifa.precio_boleta)}</b>
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  valueClassName,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", valueClassName)}>{value}</p>
      {sub && <p className="text-muted-foreground text-[11px]">{sub}</p>}
      {onClick && <p className="text-primary mt-auto pt-2 text-[11px] font-medium">Ver quiénes →</p>}
    </>
  );

  if (!onClick) {
    return <div className="border-border rounded-xl border p-3">{contenido}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border hover:border-primary/60 hover:bg-muted/40 flex flex-col rounded-xl border p-3 text-left transition-colors"
      title="Ver quiénes son"
    >
      {contenido}
    </button>
  );
}
