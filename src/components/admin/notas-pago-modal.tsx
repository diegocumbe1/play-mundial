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
            Notas de pago ({notas.length})
          </Button>
        }
      />

      <DialogContent className="bg-polla-surface ring-polla-line/80 max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notas de pago</DialogTitle>
          <DialogDescription>{partido}</DialogDescription>
        </DialogHeader>

        <ul className="divide-polla-line/40 rounded-xl border border-white/5 px-3 divide-y">
          {notas.map((nota) => (
            <li key={nota.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="min-w-0 font-medium text-white">{nota.nombre}</div>
                <span className="text-polla-muted shrink-0 text-xs">
                  Marcador {nota.marcador}
                </span>
              </div>
              <div className="text-polla-muted mt-0.5 text-xs">
                {nota.telefono ? `${nota.telefono} · ` : ""}
                {nota.pagado && nota.metodoPago
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
