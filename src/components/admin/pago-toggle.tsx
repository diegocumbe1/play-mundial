"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, CreditCard, Ban, StickyNote } from "lucide-react";
import { toast } from "sonner";

import { marcarNoPago, marcarPago } from "@/actions/apuestas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MetodoPago } from "@/types";

const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

// Qué muestra el modal abierto.
type DialogModo =
  | { tipo: "pagar"; metodo: MetodoPago } // confirmar un pago nuevo
  | { tipo: "editarPago" } // ver/editar un pago ya validado
  | { tipo: "noPago" } // cerrar la apuesta como "no pagó"
  | { tipo: "verNoPago" }; // ver/editar/reabrir una apuesta "no pagó"

/** Control que valida si el admin recibió el pago de una apuesta. */
export function PagoToggle({
  id,
  pagado,
  metodoPago,
  notaPago,
  noPago = false,
  cobroCerrado = false,
}: {
  id: string;
  pagado: boolean;
  metodoPago: MetodoPago | null;
  notaPago?: string | null;
  noPago?: boolean;
  /** El partido ya inició: la apuesta no puede seguir pendiente de cobro. */
  cobroCerrado?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [modo, setModo] = useState<DialogModo | null>(null);
  const [nota, setNota] = useState("");

  function abrir(nuevoModo: DialogModo) {
    setModo(nuevoModo);
    // Las acciones que parten de un estado nuevo arrancan sin nota; las de
    // ver/editar precargan la nota guardada.
    setNota(
      nuevoModo.tipo === "editarPago" || nuevoModo.tipo === "verNoPago"
        ? (notaPago ?? "")
        : "",
    );
  }

  function ejecutar(accion: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await accion();
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setModo(null);
      router.refresh();
    });
  }

  return (
    <>
      {pagado ? (
        <button
          type="button"
          onClick={() => abrir({ tipo: "editarPago" })}
          disabled={pending}
          aria-pressed
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition-colors disabled:opacity-50",
            "bg-polla-gold/15 text-polla-gold ring-polla-gold/40",
          )}
          title="Ver detalle del pago"
        >
          <span className="flex size-4 items-center justify-center rounded border border-polla-gold">
            <Check className="size-3" />
          </span>
          {metodoPago ? METODO_LABEL[metodoPago] : "Pago recibido"}
          {notaPago?.trim() && <StickyNote className="size-3.5 opacity-80" />}
        </button>
      ) : noPago || cobroCerrado ? (
        <button
          type="button"
          onClick={() => !cobroCerrado && abrir({ tipo: "verNoPago" })}
          disabled={pending}
          className="text-polla-muted ring-polla-line hover:text-white inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition-colors disabled:opacity-50"
          title={cobroCerrado ? "El partido ya inició" : "Apuesta cerrada sin pago"}
        >
          <Ban className="size-3.5" />
          {cobroCerrado ? "Cobro cerrado" : "No pagó"}
          {!cobroCerrado && notaPago?.trim() && <StickyNote className="size-3.5 opacity-80" />}
        </button>
      ) : (
        <div className="inline-flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-lg ring-1 ring-polla-red/30">
            <button
              type="button"
              onClick={() => abrir({ tipo: "pagar", metodo: "efectivo" })}
              disabled={pending}
              className="bg-polla-red/10 text-polla-red hover:bg-polla-red/15 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Banknote className="size-3.5" />
              Efectivo
            </button>
            <button
              type="button"
              onClick={() => abrir({ tipo: "pagar", metodo: "transferencia" })}
              disabled={pending}
              className="bg-polla-red/10 text-polla-red hover:bg-polla-red/15 border-polla-red/25 inline-flex items-center gap-1.5 border-l px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <CreditCard className="size-3.5" />
              Transfer.
            </button>
          </div>
          <button
            type="button"
            onClick={() => abrir({ tipo: "noPago" })}
            disabled={pending}
            className="text-polla-muted ring-polla-line hover:text-white inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition-colors disabled:opacity-50"
            title="Marcar que nunca pagó"
          >
            <Ban className="size-3.5" />
            No pagó
          </button>
        </div>
      )}

      <Dialog open={modo !== null} onOpenChange={(open) => !open && setModo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modo?.tipo === "pagar"
                ? `Confirmar pago · ${METODO_LABEL[modo.metodo]}`
                : modo?.tipo === "editarPago"
                  ? "Detalle del pago"
                  : modo?.tipo === "noPago"
                    ? "Marcar como no pagó"
                    : "Apuesta sin pago"}
            </DialogTitle>
            <DialogDescription>
              {modo?.tipo === "pagar"
                ? "Agrega una nota opcional sobre cómo se recibió este pago."
                : modo?.tipo === "editarPago"
                  ? `Pago recibido${
                      metodoPago ? ` por ${METODO_LABEL[metodoPago]}` : ""
                    }. Puedes editar la nota o marcarlo como pendiente.`
                  : modo?.tipo === "noPago"
                    ? "Esta apuesta se cierra sin pago: queda registrada pero no cuenta para el pozo ni como pendiente. Agrega el motivo (opcional)."
                    : "Cerrada sin pago. Puedes editar el motivo o reabrirla como pendiente."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={`nota-pago-${id}`}
              className="text-polla-muted text-xs font-medium"
            >
              {modo?.tipo === "noPago" || modo?.tipo === "verNoPago"
                ? "Motivo (opcional)"
                : "Nota (opcional)"}
            </label>
            <textarea
              id={`nota-pago-${id}`}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={
                modo?.tipo === "noPago" || modo?.tipo === "verNoPago"
                  ? "Ej. nunca transfirió · no contestó · se arrepintió"
                  : "Ej. lo recogió mi mamá en efectivo · transfirieron a la otra cuenta · me lo pagan hoy a las 6pm"
              }
              className="border-polla-line bg-polla-elevated focus:ring-polla-gold/40 w-full resize-none rounded-lg border px-3 py-2 text-sm text-white outline-none focus:ring-2"
            />
          </div>

          <DialogFooter>
            {modo?.tipo === "pagar" ? (
              <Button
                type="button"
                onClick={() => ejecutar(() => marcarPago(id, true, modo.metodo, nota))}
                disabled={pending}
              >
                Confirmar pago
              </Button>
            ) : modo?.tipo === "editarPago" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => ejecutar(() => marcarPago(id, false, null, nota))}
                  disabled={pending}
                >
                  Marcar como pendiente
                </Button>
                <Button
                  type="button"
                  onClick={() => ejecutar(() => marcarPago(id, true, metodoPago, nota))}
                  disabled={pending}
                >
                  Guardar nota
                </Button>
              </>
            ) : modo?.tipo === "noPago" ? (
              <Button
                type="button"
                onClick={() => ejecutar(() => marcarNoPago(id, true, nota))}
                disabled={pending}
              >
                Marcar como no pagó
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => ejecutar(() => marcarNoPago(id, false))}
                  disabled={pending}
                >
                  Reabrir (pendiente)
                </Button>
                <Button
                  type="button"
                  onClick={() => ejecutar(() => marcarNoPago(id, true, nota))}
                  disabled={pending}
                >
                  Guardar motivo
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
