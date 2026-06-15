"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Square } from "lucide-react";
import { toast } from "sonner";

import { marcarPago } from "@/actions/apuestas";
import { cn } from "@/lib/utils";

/** Control que valida si el admin recibió el pago de una apuesta. */
export function PagoToggle({ id, pagado }: { id: string; pagado: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const r = await marcarPago(id, !pagado);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={pagado}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition-colors disabled:opacity-50",
        pagado
          ? "bg-polla-gold/15 text-polla-gold ring-polla-gold/40"
          : "bg-polla-red/10 text-polla-red ring-polla-red/30",
      )}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded border",
          pagado ? "border-polla-gold" : "border-polla-red/60",
        )}
      >
        {pagado ? <Check className="size-3" /> : <Square className="size-2.5 opacity-0" />}
      </span>
      {pagado ? "Pago recibido" : "Validar pago"}
    </button>
  );
}
