"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MetodoPago } from "@/types";

export type NotaPagoPartido = {
  id: string;
  /** "pago" = comentario al recibir la apuesta; "premio" = al pagar el premio. */
  tipo: "pago" | "premio";
  nombre: string;
  telefono: string | null;
  marcador: string;
  metodoPago: MetodoPago | null;
  pagado: boolean;
  nota: string;
};

const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

const TIPO_LABEL: Record<NotaPagoPartido["tipo"], string> = {
  pago: "Pago recibido",
  premio: "Premio entregado",
};

/** Reúne las notas administrativas de un partido finalizado para conciliarlas. */
export function NotasPagoModal({
  partido,
  notas,
}: {
  partido: string;
  notas: NotaPagoPartido[];
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <FileText className="size-3.5" />
            Observaciones ({notas.length})
          </Button>
        }
      />

      <DialogContent className="bg-polla-surface ring-polla-line/80 max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Observaciones</DialogTitle>
          <DialogDescription>{partido}</DialogDescription>
        </DialogHeader>

        <ul className="divide-polla-line/40 rounded-xl border border-white/5 px-3 divide-y">
          {notas.map((nota) => (
            <li key={nota.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={
                      nota.tipo === "premio"
                        ? "bg-polla-gold/15 text-polla-gold rounded-full px-2 py-0.5 text-[0.6rem] font-bold tracking-wide uppercase"
                        : "rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-white/80 uppercase"
                    }
                  >
                    {TIPO_LABEL[nota.tipo]}
                  </span>
                  <span className="min-w-0 font-medium text-white">
                    {nota.nombre}
                  </span>
                </div>
                <span className="text-polla-muted shrink-0 text-xs">
                  Marcador {nota.marcador}
                </span>
              </div>
              <div className="text-polla-muted mt-0.5 text-xs">
                {nota.telefono ? `${nota.telefono} · ` : ""}
                {nota.tipo === "premio"
                  ? "Premio pagado al ganador"
                  : nota.pagado && nota.metodoPago
                    ? METODO_LABEL[nota.metodoPago]
                    : "No pagó"}
              </div>
              <p className="bg-polla-elevated/70 mt-2 rounded-lg px-2.5 py-2 text-sm leading-relaxed text-white/90">
                {nota.nota}
              </p>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
