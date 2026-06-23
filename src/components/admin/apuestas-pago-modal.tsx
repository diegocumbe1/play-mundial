"use client";

import { CheckCircle2, ChevronDown, Clock3, TicketX } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type FilaPago = {
  id: string;
  nombre: string;
  telefono: string | null;
  partido: string;
  marcador: string;
  detalle: string;
  tipo: "pagada" | "pendiente" | "cerrada";
};

function SeccionPagos({
  titulo,
  filas,
  vacio,
  icono,
  tono,
}: {
  titulo: string;
  filas: FilaPago[];
  vacio: string;
  icono: React.ReactNode;
  tono: "gold" | "red" | "muted";
}) {
  const color = {
    gold: "text-polla-gold",
    red: "text-polla-red",
    muted: "text-polla-muted",
  }[tono];

  return (
    <details className="group rounded-xl border border-white/5 bg-white/2">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
        <span className={color}>{icono}</span>
        <span className="flex-1">{titulo}</span>
        <span className="text-polla-muted text-xs">{filas.length}</span>
        <ChevronDown className="text-polla-muted size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-polla-line/40 border-t px-3 py-3">
        {filas.length === 0 ? (
          <p className="text-polla-muted rounded-xl bg-white/3 px-3 py-2.5 text-xs">
            {vacio}
          </p>
        ) : (
          <ul className="divide-polla-line/40 rounded-xl border border-white/5 px-3 divide-y">
            {filas.map((fila) => (
              <li key={fila.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{fila.nombre}</div>
                    <div className="text-polla-muted truncate text-xs">
                      {fila.partido} · Marcador {fila.marcador}
                    </div>
                    {fila.telefono && (
                      <div className="text-polla-muted truncate text-xs">{fila.telefono}</div>
                    )}
                  </div>
                  <span className={`shrink-0 text-right text-xs ${color}`}>{fila.detalle}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/** Resumen de cobros: separa lo que aún se puede cobrar de lo ya cerrado. */
export function ApuestasPagoModal({
  total,
  pagadas,
  pendientes,
  cerradas,
}: {
  total: number;
  pagadas: FilaPago[];
  pendientes: FilaPago[];
  cerradas: FilaPago[];
}) {
  return (
    <Dialog>
      <DialogTrigger className="bg-polla-surface ring-polla-line hover:ring-polla-gold/50 block w-full rounded-2xl p-5 text-left ring-1 transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-polla-elevated text-polla-gold flex size-11 shrink-0 items-center justify-center rounded-xl">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-heading truncate text-2xl leading-none text-white tabular-nums">
              {pagadas.length}/{total}
            </div>
            <div className="text-polla-muted mt-1 text-xs font-medium tracking-wide uppercase">
              Apuestas pagadas
            </div>
          </div>
          <span className="text-polla-muted shrink-0 text-[11px] font-medium tracking-wide uppercase">
            Ver
          </span>
        </div>
      </DialogTrigger>

      <DialogContent className="bg-polla-surface ring-polla-line/80 max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estado de los cobros</DialogTitle>
          <DialogDescription>
            Solo se consideran pendientes las apuestas sin pago de partidos que aún no han iniciado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <SeccionPagos
            titulo="Pendientes por cobrar"
            filas={pendientes}
            vacio="No hay cobros pendientes en partidos próximos."
            icono={<Clock3 className="size-4" />}
            tono="red"
          />
          <SeccionPagos
            titulo="Pagadas"
            filas={pagadas}
            vacio="Todavía no hay pagos recibidos."
            icono={<CheckCircle2 className="size-4" />}
            tono="gold"
          />
          <SeccionPagos
            titulo="Cobros cerrados sin pago"
            filas={cerradas}
            vacio="No hay apuestas cerradas sin pago."
            icono={<TicketX className="size-4" />}
            tono="muted"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
