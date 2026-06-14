"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";

import { marcarPremioPagado } from "@/actions/partidos";
import { cn } from "@/lib/utils";

/** Chip para marcar si el premio ya se le pagó al ganador. */
export function PremioPagoToggle({
  partidoId,
  pagado,
}: {
  partidoId: string;
  pagado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const r = await marcarPremioPagado(partidoId, !pagado);
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
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors disabled:opacity-50",
        pagado
          ? "bg-polla-gold/15 text-polla-gold ring-polla-gold/40"
          : "bg-polla-red/10 text-polla-red ring-polla-red/30",
      )}
    >
      {pagado ? <Check className="size-3.5" /> : <Clock className="size-3.5" />}
      {pagado ? "Premio pagado" : "Premio pendiente"}
    </button>
  );
}
