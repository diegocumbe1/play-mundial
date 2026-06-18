"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, CreditCard, StickyNote } from "lucide-react";
import { toast } from "sonner";

import { marcarPago } from "@/actions/apuestas";
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

/** Control que valida si el admin recibió el pago de una apuesta. */
export function PagoToggle({
  id,
  pagado,
  metodoPago,
  notaPago,
}: {
  id: string;
  pagado: boolean;
  metodoPago: MetodoPago | null;
  notaPago?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Cuando hay un modal abierto: qué método se va a confirmar (null = ver/editar
  // un pago ya validado).
  const [dialogMetodo, setDialogMetodo] = useState<MetodoPago | null>(null);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [nota, setNota] = useState("");

  function abrirParaPagar(metodo: MetodoPago) {
    setDialogMetodo(metodo);
    setNota("");
    setDialogAbierto(true);
  }

  function abrirParaEditar() {
    setDialogMetodo(null);
    setNota(notaPago ?? "");
    setDialogAbierto(true);
  }

  function guardar(nuevoPagado: boolean, metodo: MetodoPago | null) {
    startTransition(async () => {
      const r = await marcarPago(id, nuevoPagado, metodo, nota);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setDialogAbierto(false);
      router.refresh();
    });
  }

  // Método activo dentro del modal: el que se va a confirmar (pago nuevo) o el
  // ya guardado (editar).
  const metodoActivo = dialogMetodo ?? metodoPago;

  return (
    <>
      {!pagado ? (
        <div className="inline-flex items-center overflow-hidden rounded-lg ring-1 ring-polla-red/30">
          <button
            type="button"
            onClick={() => abrirParaPagar("efectivo")}
            disabled={pending}
            className="bg-polla-red/10 text-polla-red hover:bg-polla-red/15 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Banknote className="size-3.5" />
            Efectivo
          </button>
          <button
            type="button"
            onClick={() => abrirParaPagar("transferencia")}
            disabled={pending}
            className="bg-polla-red/10 text-polla-red hover:bg-polla-red/15 border-polla-red/25 inline-flex items-center gap-1.5 border-l px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <CreditCard className="size-3.5" />
            Transfer.
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirParaEditar}
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
      )}

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMetodo
                ? `Confirmar pago · ${METODO_LABEL[dialogMetodo]}`
                : "Detalle del pago"}
            </DialogTitle>
            <DialogDescription>
              {dialogMetodo
                ? "Agrega una nota opcional sobre cómo se recibió este pago."
                : `Pago recibido${
                    metodoActivo ? ` por ${METODO_LABEL[metodoActivo]}` : ""
                  }. Puedes editar la nota o marcarlo como pendiente.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={`nota-pago-${id}`}
              className="text-polla-muted text-xs font-medium"
            >
              Nota (opcional)
            </label>
            <textarea
              id={`nota-pago-${id}`}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ej. lo recogió mi mamá en efectivo · transfirieron a la otra cuenta · me lo pagan hoy a las 6pm"
              className="border-polla-line bg-polla-elevated focus:ring-polla-gold/40 w-full resize-none rounded-lg border px-3 py-2 text-sm text-white outline-none focus:ring-2"
            />
          </div>

          <DialogFooter>
            {dialogMetodo ? (
              <Button
                type="button"
                onClick={() => guardar(true, dialogMetodo)}
                disabled={pending}
              >
                Confirmar pago
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => guardar(false, null)}
                  disabled={pending}
                >
                  Marcar como pendiente
                </Button>
                <Button
                  type="button"
                  onClick={() => guardar(true, metodoPago)}
                  disabled={pending}
                >
                  Guardar nota
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
