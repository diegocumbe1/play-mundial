"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { anularCobro, confirmarCobro } from "@/actions/cobros";
import { Button } from "@/components/ui/button";

/** Confirma un cobro pendiente (activa la rifa o extiende la suscripción). */
export function ConfirmarCobroButton({ cobroId }: { cobroId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await confirmarCobro(cobroId);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          toast.success("Cobro confirmado");
          router.refresh();
        })
      }
    >
      <Check className="size-3.5" /> Confirmar pago
    </Button>
  );
}

/** Anula un cobro pendiente (registrado por error o que no se va a pagar). */
export function AnularCobroButton({ cobroId }: { cobroId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("¿Anular este cobro pendiente?")) return;
        startTransition(async () => {
          const r = await anularCobro(cobroId);
          if (!r.success) {
            toast.error(r.error);
            return;
          }
          toast.success("Cobro anulado");
          router.refresh();
        });
      }}
    >
      <X className="size-3.5" /> Anular
    </Button>
  );
}
