"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, CreditCard, Square } from "lucide-react";
import { toast } from "sonner";

import { marcarPago } from "@/actions/apuestas";
import { cn } from "@/lib/utils";
import type { MetodoPago } from "@/types";

/** Control que valida si el admin recibió el pago de una apuesta. */
export function PagoToggle({
  id,
  pagado,
  metodoPago,
}: {
  id: string;
  pagado: boolean;
  metodoPago: MetodoPago | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function actualizar(nuevoPagado: boolean, nuevoMetodo: MetodoPago | null = null) {
    startTransition(async () => {
      const r = await marcarPago(id, nuevoPagado, nuevoMetodo);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  if (!pagado) {
    return (
      <div className="inline-flex items-center overflow-hidden rounded-lg ring-1 ring-polla-red/30">
        <button
          type="button"
          onClick={() => actualizar(true, "efectivo")}
          disabled={pending}
          className="bg-polla-red/10 text-polla-red hover:bg-polla-red/15 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <Banknote className="size-3.5" />
          Efectivo
        </button>
        <button
          type="button"
          onClick={() => actualizar(true, "transferencia")}
          disabled={pending}
          className="bg-polla-red/10 text-polla-red hover:bg-polla-red/15 border-polla-red/25 inline-flex items-center gap-1.5 border-l px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <CreditCard className="size-3.5" />
          Transfer.
        </button>
      </div>
    );
  }

  const metodoLabel =
    metodoPago === "efectivo"
      ? "Efectivo"
      : metodoPago === "transferencia"
        ? "Transferencia"
        : "Pago recibido";

  return (
    <button
      type="button"
      onClick={() => actualizar(false)}
      disabled={pending}
      aria-pressed
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition-colors disabled:opacity-50",
        "bg-polla-gold/15 text-polla-gold ring-polla-gold/40",
      )}
      title="Click para marcar como pendiente"
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded border",
          "border-polla-gold",
        )}
      >
        {pagado ? <Check className="size-3" /> : <Square className="size-2.5 opacity-0" />}
      </span>
      {metodoLabel}
    </button>
  );
}
