"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { confirmarCobro } from "@/actions/cobros";
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
