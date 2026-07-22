"use client";

import { useRef, useState } from "react";
import { ChevronDown, Users } from "lucide-react";

import {
  ParticipantesLista,
  type Filtro,
} from "@/components/rifa/participantes-lista";
import { formatCOP } from "@/lib/rifa";
import { cn } from "@/lib/utils";
import type { Boleta, DashboardRifa, Rifa } from "@/types";

/**
 * Dashboard financiero + participantes. Los indicadores de "Pagadas" y
 * "Por cobrar" son accionables: filtran el listado y bajan hasta él, para
 * responder "¿quiénes son?" sin salir de la pantalla.
 */
export function PanelFinanciero({
  rifa,
  boletas,
  dash,
}: {
  rifa: Rifa;
  boletas: Boleta[];
  dash: DashboardRifa;
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
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Vendidas" value={`${dash.vendidas}/${dash.total}`} sub={`${dash.pctVendido}%`} />
        <Stat
          label="Pagadas"
          value={String(dash.pagadas)}
          sub={`Faltan ${dash.pendientes} por cobrar`}
          onClick={() => ver("pagadas")}
        />
        <Stat label="Recaudado" value={formatCOP(dash.recaudado)} sub={`de ${formatCOP(dash.esperadoTotal)}`} />
        <Stat
          label="Por cobrar"
          value={formatCOP(dash.porCobrar)}
          sub={`${dash.pendientes} apartadas · ${dash.libres} libres`}
          onClick={() => ver("deben")}
        />
      </section>

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

function Stat({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground text-[11px]">{sub}</p>}
    </>
  );

  if (!onClick) {
    return <div className="border-border rounded-xl border p-3">{contenido}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border hover:border-primary/60 hover:bg-muted/40 rounded-xl border p-3 text-left transition-colors"
      title="Ver quiénes son"
    >
      {contenido}
    </button>
  );
}
