"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { marcarPremioApuestaPagado } from "@/actions/apuestas";

/**
 * Botón rápido para marcar un premio como pagado desde una lista (ej. el modal
 * de premios pendientes), sin abrir diálogo. Al confirmar, la fila desaparece
 * de la lista de pendientes tras revalidar.
 */
export function MarcarPremioPagadoButton({ apuestaId }: { apuestaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function marcar() {
    startTransition(async () => {
      const r = await marcarPremioApuestaPagado(apuestaId, true);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Premio marcado como pagado");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={marcar}
      disabled={pending}
      className="bg-polla-gold/15 text-polla-gold ring-polla-gold/40 hover:bg-polla-gold/25 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors disabled:opacity-50"
    >
      <Check className="size-3.5" />
      Pagado
    </button>
  );
}
